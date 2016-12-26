"use strict"

var pg = require("pg");
var _ = require("lodash");
var url = require("url");
var auth = require("http-auth");
var throng = require("throng");
var compression = require("compression");
var constants = require("./analysis-constants.json");
var combinations = require("./combinations");

var PORT = process.env.PORT || 5000;
var WORKERS = process.env.WEB_CONCURRENCY || 1;

throng({
	workers: WORKERS,
	lifetime: Infinity,
	start: start
});

function start() {
	// Configure and initialize the Postgres connection pool
	// Get the DATABASE_URL config var and parse it into its components
	var params = url.parse(process.env.HEROKU_POSTGRESQL_COPPER_URL);
	var authParams = params.auth.split(":");
	var pgConfig = {
		user: authParams[0],
		password: authParams[1],
		host: params.hostname,
		port: params.port,
		database: params.pathname.split("/")[1],
		ssl: true,
		max: 16 / WORKERS,			// Maximum number of clients in the pool
		idleTimeoutMillis: 30000	// Duration a client can remain idle before being closed
	};
	var pool = new pg.Pool(pgConfig);

	// Create an Express server
	var express = require("express");
	var server = express();
	server.use(compression());

	// Add user authentication if AUTHENTICATION isn't set to 'off'
	if (process.env.AUTHENTICATION.toLowerCase() !== "off") {
		var basic = auth.basic(
			{ },
			(username, password, callback) => { 
		        callback(username === process.env.AUTHENTICATION_USER && password === process.env.AUTHENTICATION_PASSWORD);
		    }
		);
		server.use(auth.connect(basic));
	}

	// Serve static files, including the Vue application in public/index.html
	server.use(express.static("public"));
	
	//
	// Common queries
	//

	// result1 combines all games for a player
	// result2 returns a list of positions played per game (e.g., c,l,l,l)
	var skaterStatQueryString = "SELECT result1.*, result2.positions"
		+ " FROM "
		+ " ( "
			+ " SELECT s.team, s.player_id, r.first, r.last, s.score_sit, s.strength_sit, r.position,"
				+ "	SUM(toi) AS toi, SUM(ig) AS ig, SUM(\"is\") AS \"is\", (SUM(\"is\") + SUM(ibs) + SUM(ims)) AS ic, SUM(ia1) AS ia1, SUM(ia2) AS ia2,"
				+ "	SUM(gf) AS gf, SUM(ga) AS ga, SUM(sf) AS sf, SUM(sa) AS sa, (SUM(sf) + SUM(bsf) + SUM(msf)) AS cf, (SUM(sa) + SUM(bsa) + SUM(msa)) AS ca,"
				+ "	SUM(cf_off) AS cf_off, SUM(ca_off) AS ca_off " 
			+ " FROM game_stats AS s"
				+ " LEFT JOIN game_rosters AS r"
				+ " ON s.player_id = r.player_id AND s.season = r.season AND s.game_id = r.game_id"
			+ " WHERE s.player_id > 2 AND r.position != 'na' AND r.position != 'g' AND s.season = $1"
			+ " GROUP BY s.team, s.player_id, r.first, r.last, r.position, s.score_sit, s.strength_sit"
		+ " ) AS result1"
		+ " LEFT JOIN"
		+ " ( "
			+ " SELECT player_id, string_agg(position, ',') as positions"
			+ " FROM game_rosters"
			+ " WHERE position != 'na' AND position != 'g' AND season = $1"
			+ " GROUP BY player_id"
		+ " ) AS result2"
		+ " ON result1.player_id = result2.player_id";

	var teamStatQueryString = "SELECT result1.*, result2.gp"
		+ " FROM "
		+ " ( "
			+ " SELECT team, score_sit, strength_sit, SUM(toi) AS toi,"
				+ "	SUM(gf) AS gf, SUM(ga) AS ga, SUM(sf) AS sf, SUM(sa) AS sa, (SUM(sf) + SUM(bsf) + SUM(msf)) AS cf, (SUM(sa) + SUM(bsa) + SUM(msa)) AS ca"
			+ " FROM game_stats"
			+ " WHERE player_id < 2 AND season = $1"
			+ " GROUP BY team, score_sit, strength_sit"
		+ " ) AS result1"
		+ " LEFT JOIN"
		+ " ( "
			+ " SELECT team, COUNT(DISTINCT game_id) AS gp"
			+ " FROM game_rosters" 
			+ " WHERE season = $1"
			+ " GROUP BY team"
		+ " ) AS result2"
		+ " ON result1.team = result2.team";

	//
	// Handle GET request for players list
	//

	server.get("/api/players/", function(request, response) {

		var season = 2016;

		// Query for player stats
		var statRows;
		query(skaterStatQueryString, [season], function(err, rows) {
			if (err) { return response.status(500).send("Error running query: " + err); }
			statRows = rows;
			processResults();
		});

		// Process query results
		function processResults() {

			// Postgres aggregate functions like SUM return strings, so cast them as ints
			// Calculate score-adjusted corsi
			statRows.forEach(function(r) {
				["toi", "ig", "is", "ic", "ia1", "ia2", "gf", "ga", "sf", "sa", "cf", "ca", "cf_off", "ca_off"].forEach(function(col) {
					r[col] = +r[col];
				});
				r.cf_adj = constants.cfWeights[r.score_sit] * r.cf;
				r.ca_adj = constants.cfWeights[-1 * r.score_sit] * r.ca;
			});

			// Group rows by playerId: { 123: [rows for player 123], 234: [rows for player 234] }
			statRows = _.groupBy(statRows, "player_id");

			// Structure results as an array of objects: [ { playerId: 123, data: [rows for player 123] }, { playerId: 234, data: [rows for player 234] } ]
			var result = { players: [] };
			Object.keys(statRows).forEach(function(pId) {
				// Get all teams and positions the player has been on, as well as games played
				var positions = statRows[pId][0].positions.split(",");	
				result.players.push({
					player_id: +pId,
					teams: _.uniqBy(statRows[pId], "team").map(function(d) { return d.team; }),
					gp: positions.length,
					positions: _.uniq(positions),
					first: statRows[pId][0].first,
					last: statRows[pId][0].last,
					data: statRows[pId]
				});
			});

			// Set redundant properties in each player's data rows to be undefined - this removes them from the response
			// Setting the properties to undefined is faster than deleting the properties completely
			result.players.forEach(function(p) {
				p.data.forEach(function(r) {
					r.team = undefined;
					r.player_id = undefined;
					r.first = undefined;
					r.last = undefined;
					r.positions = undefined;
				});
			});

			// Aggregate score situations
			var stats = ["toi", "ig", "is", "ic", "ia1", "ia2", "gf", "ga", "sf", "sa", "cf", "ca", "cf_off", "ca_off", "cf_adj", "ca_adj"];
			aggregateScoreSituations(result.players, stats);
			return response.status(200).send(result);
		}
	});

	//
	// Handle GET request for a particular player id
	//

	server.get("/api/players/:id", function(request, response) {

		var pId = +request.params.id;
		var season = 2016;
		var result = {};
		var players = []; // An array of player objects

		// Start querying and processing the player's game history in parallel with breakpoint calculations
		// These 2 analyses don't depend on each other
		queryHistory();
		queryBreakpoints();

		//
		// Get the specified player's data and calculate breakpoints
		// Also prepare data (e.g., player positions) used for subsequent analyses
		//

		var statRows;
		function queryBreakpoints() {
			query(skaterStatQueryString, [season], function(err, rows) {
				if (err) { return response.status(500).send("Error running query: " + err); }
				statRows = rows;
				getBreakpoints();
			});
		}

		// Process query results
		function getBreakpoints() {

			// Postgres aggregate functions like SUM return strings, so cast them as ints
			// Calculate score-adjusted corsi
			statRows.forEach(function(r) {
				["toi", "ig", "is", "ic", "ia1", "ia2", "gf", "ga", "sf", "sa", "cf", "ca", "cf_off", "ca_off"].forEach(function(col) {
					r[col] = +r[col];
				});
				r.cf_adj = constants.cfWeights[r.score_sit] * r.cf;
				r.ca_adj = constants.cfWeights[-1 * r.score_sit] * r.ca;
			});

			// Group rows by playerId: { 123: [rows for player 123], 234: [rows for player 234] }
			statRows = _.groupBy(statRows, "player_id");

			// Structure results as an array of objects: [ { playerId: 123, data: [rows for player 123] }, { playerId: 234, data: [rows for player 234] } ]
			Object.keys(statRows).forEach(function(sId) {

				// Store player data, including their position and games played
				var positions = statRows[sId][0].positions.split(",");
				players.push({
					player_id: +sId,
					gp: positions.length,
					f_or_d: isForD(positions),
					first: statRows[sId][0].first,
					last: statRows[sId][0].last,
					data: statRows[sId]
				});	

				// Store a reference to the specified player's data. Remove redundant properties to reduce response size
				if (+sId === pId) {
					result.player = players[players.length - 1];
					result.player.data.forEach(function(d) {
						d.team = undefined;
						d.player_id = undefined;
						d.first = undefined;
						d.last = undefined;
						d.positions = undefined;
					});
				}
			});

			// Aggregate score situations
			var stats = ["toi", "ig", "is", "ic", "ia1", "ia2", "gf", "ga", "sf", "sa", "cf", "ca", "cf_off", "ca_off", "cf_adj", "ca_adj"];
			aggregateScoreSituations(players, stats);

			// Get breakpoints
			result.breakpoints = {};
			var player = players.find(function(d) { return d.player_id === pId; });
			["all_toi", "ev5_cf_adj_per60", "ev5_ca_adj_per60", "ev5_p1_per60", "pp_p1_per60"].forEach(function(s) {
				result.breakpoints[s] = { breakpoints: [], player: null, isPlayerInDistribution: null };
				// To calculate breakpoints, only consider players with the same position as the specified player, and with at least 10gp
				// For powerplay breakpoints, only consider players with at least 20 minutes of pp time
				var breakpointPlayers = players.filter(function(d) { return (d.f_or_d === result.player.f_or_d && d.gp >= 10); });
				if (s === "pp_p1_per60") {
					breakpointPlayers = breakpointPlayers.filter(function(p) { return p.stats.pp.toi >= 20 * 60; });
				}
				// Get the datapoints for which we want a distribution
				var datapoints = [];
				breakpointPlayers.forEach(function(p) {
					datapoints.push(getDatapoint(p, s));
				});
				// Sort datapoints in descending order and find breakpoints
				datapoints.sort(function(a, b) { return b - a; });
				var ranks = result.player.f_or_d === "f" ? [0, 89, 179, 269, 359] : [0, 59, 119, 179];
				var i = 0;
				var done = false;
				while (!done && i < ranks.length) {
					var rank = ranks[i];
					if (datapoints[rank]) {
						result.breakpoints[s].breakpoints.push(datapoints[rank]);
					} else {
						result.breakpoints[s].breakpoints.push(datapoints[datapoints.length - 1]);
						done = true;
					}				
					i++;	
				}
				// Store the player's datapoint
				result.breakpoints[s].player = getDatapoint(player, s);
				if (breakpointPlayers.find(function(d) { return d.player_id === pId; })) {
					result.breakpoints[s].isPlayerInDistribution = true;
				} else {
					result.breakpoints[s].isPlayerInDistribution = false;
				}
			});

			// Start querying and processing linemates
			queryLinemates();
		}

		// 'p' is a player object; 's' is the stat to be calculated
		function getDatapoint(p, s) {
			var datapoint;
			if (s === "all_toi") {
				datapoint = p.stats.all.toi / p.gp;
			} else if (s.indexOf("ev5_") >= 0) {
				if (s === "ev5_cf_adj_per60") {
					datapoint = p.stats.ev5.cf_adj;
				} else if (s === "ev5_ca_adj_per60") {
					datapoint = p.stats.ev5.ca_adj;
				} else if (s === "ev5_p1_per60") {
					datapoint = p.stats.ev5.ig + p.stats.ev5.ia1;
				}
				datapoint = p.stats.ev5.toi === 0 ? 0 : 60 * 60 * (datapoint / p.stats.ev5.toi);
			} else if (s === "pp_p1_per60") {
				datapoint = p.stats.pp.ig + p.stats.pp.ia1;
				datapoint = p.stats.pp.toi === 0 ? 0 : 60 * 60 * (datapoint / p.stats.pp.toi);
			}
			return datapoint;
		}

		//
		// Query linemate data and get results
		//

		var shiftRows;
		var strSitRows;
		var eventRows;

		function queryLinemates() {

			// Query for shifts belonging to the player and his teammates
			// 'p' contains all of the specified player's game_rosters rows (i.e., all games they played in, regardless of team)
			// 'sh' contains all player shifts, including player names
			// Join 'p' with 'sh' to get all shifts belonging to the specified player and his teammates
			// Also use this to get all positions the player has played
			var queryStr = "SELECT sh.*"
				+ " FROM game_rosters AS p"
				+ " LEFT JOIN ("
					+ " SELECT s.game_id, s.team, s.player_id, s.period, s.shifts, r.\"first\", r.\"last\", r.\"position\""
					+ " FROM game_shifts AS s"
					+ " LEFT JOIN game_rosters as r"
					+ " ON s.season = r.season AND s.game_id = r.game_id AND s.player_id = r.player_id"
					+ " WHERE r.\"position\" != 'g' AND r.\"position\" != 'na' AND s.season = $1"
				+ " ) AS sh"
				+ " ON p.game_id = sh.game_id AND p.team = sh.team"
				+ " WHERE p.season = $1 AND p.\"position\" != 'na' AND p.player_id = $2";
			query(queryStr, [season, pId], function(err, rows) {
				if (err) { return response.status(500).send("Error running query: " + err); }
				shiftRows = rows;
				getLineResults();
			});

			// Query for the strength situations the player's team was in
			var queryStr = "SELECT s.*"
				+ " FROM game_rosters AS p"
				+ " LEFT JOIN game_strength_situations AS s"
				+ " ON p.season = s.season AND p.game_id = s.game_id AND p.team = s.team" 
				+ " WHERE p.season = $1 AND p.\"position\" != 'na' AND p.player_id = $2";
			query(queryStr, [season, pId], function(err, rows) {
				if (err) { return response.status(500).send("Error running query: " + err); }
				strSitRows = rows;
				getLineResults();
			});			

			// Query for events the player was on-ice for
			var queryStr = "SELECT *"
				+ " FROM game_events"
				+ " WHERE season = $1"
				+ " AND (type = 'goal' OR type = 'shot' OR type = 'missed_shot' OR type = 'blocked_shot')"
				+ " AND ("
					+ " a_s1 = $2 OR a_s2 = $2 OR a_s3 = $2 OR a_s4 = $2 OR a_s5 = $2 OR a_s6 = $2 OR a_g = $2 OR"
					+ " h_s1 = $2 OR h_s2 = $2 OR h_s3 = $2 OR h_s4 = $2 OR h_s5 = $2 OR h_s6 = $2 OR h_g = $2"
				+ ")"
			query(queryStr, [season, pId], function(err, rows) {
				if (err) { return response.status(500).send("Error running query: " + err); }
				eventRows = rows;
				getLineResults();
			});			
		}

		function getLineResults() {

			// Only start processing once all linemate-related queries are finished
			if (!shiftRows || !strSitRows || !eventRows) {
				return;
			}

			// Convert the raw timerange data in shiftRows and strSitRows into an array of timepoints
			shiftRows.forEach(function(s) {
				s.shifts = getTimepointArray(s.shifts);
			});
			strSitRows.forEach(function(s) {
				s.timeranges = getTimepointArray(s.timeranges);
			});

			//
			// Loop through each of the players' period rows and calculate toi with linemates
			//

			var lineResults = [];
			shiftRows.filter(function(d) { return d.player_id === pId; })
				.forEach(function(pr) {

					// Select the strSitRow rows that have the same game and period
					var ssRows = strSitRows.filter(function(sr) { return sr.game_id === pr.game_id && sr.period === pr.period; });

					// Select teammates' period rows that have the same game and period, and play the same position (f or d)
					var tmRows = shiftRows.filter(function(tr) {
						return tr.player_id !== pId && tr.game_id === pr.game_id && tr.period === pr.period
							&& result.player.f_or_d === isForD([tr.position]);
					});

					// Generate linemate combinations (pairs for defense, triplets for forwards) and create object to store line results
					var uniqLinemates = _.uniqBy(tmRows, "player_id");
					var numLinemates = result.player.f_or_d === "d" ? 1 : 2;
					var combos = combinations.k_combinations(uniqLinemates, numLinemates);
					var lines = [];
					combos.forEach(function(combo) {
						initLine(result.player.f_or_d, combo, lines, lineResults);
					});

					// Loop through each line that played in the period and increment toi
					// 'linesInPeriod' is an array of [playerId, playerId] (or [playerId] for defense)
					lines.forEach(function(l) {
						// Get shift rows for each linemate
						var linemateRows = tmRows.filter(function(d) { return l.indexOf(d.player_id) >= 0; });
						// Get intersection of all linemate shifts
						var playerIntersection;
						if (result.player.f_or_d === "f" && linemateRows.length === 2) {
							playerIntersection = _.intersection(pr.shifts, linemateRows[0].shifts, linemateRows[1].shifts);
						} else if (result.player.f_or_d === "d" && linemateRows.length === 1) {
							playerIntersection = _.intersection(pr.shifts, linemateRows[0].shifts);
						}
						// Increment toi for all situations and ev5/sh/pp
						var lineObj = lineResults.find(function(d) { return d.player_ids.toString() === l.toString(); });
						if (playerIntersection) {
							lineObj.all.toi += playerIntersection.length;
							ssRows.forEach(function(sr) {
								lineObj[sr.strength_sit].toi += _.intersection(playerIntersection, sr.timeranges).length;
							});
						}
					});
				});

			//
			// Append event stats to lineResults
			//

			eventRows.forEach(function(ev) {

				// Combine the database home/away skater columns into an array, removing null values
				ev["a_sIds"] = [ev.a_s1, ev.a_s2, ev.a_s3, ev.a_s4, ev.a_s5, ev.a_s6].filter(function(d) { return d; });
				ev["h_sIds"] = [ev.h_s1, ev.h_s2, ev.h_s3, ev.h_s4, ev.h_s5, ev.h_s6].filter(function(d) { return d; });		

				// Get the player's venue, and whether the event was for or against the player
				var isHome = ev["h_sIds"].indexOf(pId) >= 0 ? true : false;
				var suffix = "f";
				if ((isHome && ev.venue === "away") || (!isHome && ev.venue === "home"))  {
					suffix = "a";
				}

				// Get the skaters for which to increment stats - remove the specified player
				// Only include skaters with the same f/d classification as the specified player
				var skaters = isHome ? ev["h_sIds"] : ev["a_sIds"];
				skaters = skaters.filter(function(d) { return d !== pId; });
				skaters = skaters.filter(function(d) { 
					var linemateObj = players.find(function(p) { return p.player_id === d; });
					return linemateObj.f_or_d === result.player.f_or_d ? true : false;
				});

				// Get combinations of linemates for which to increment stats
				// This handles events with more than 2 defense or more than 3 forwards on the ice
				var numLinemates = result.player.f_or_d === "d" ? 1 : 2;
				var combos = combinations.k_combinations(skaters, numLinemates);
				incrementLineShotStats(lineResults, combos, ev, isHome, suffix);
			});

			// Remove lines with less than 1min total toi before returning results
			lineResults = lineResults.filter(function(d) { return d.all.toi >= 60; });
			result.lines = lineResults;
			returnResult();
		}

		//
		// Query and process game-by-game history
		//

		var historyRows;
		function queryHistory() {
			var queryStr = "SELECT r.game_id, r.team, g.h_team, g.a_team, g.h_final, g.a_final, g.periods, g.datetime, r.position, s.strength_sit, s.score_sit, s.toi, s.ig,"
					+ " (s.is + s.ibs + s.ims) AS ic, s.ia1, s.ia2, s.gf, s.ga, s.sf, s.sa, (s.sf + s.bsf + s.msf) AS cf, (s.sa + s.bsa + s.msa) AS ca"
				+ " FROM game_rosters AS r"
				+ " LEFT JOIN game_stats AS s"
					+ " ON r.season = s.season AND r.game_id = s.game_id AND r.player_id = s.player_id"
				+ " LEFT JOIN game_results AS g"
					+ " ON r.season = g.season AND r.game_id = g.game_id"
				+ " WHERE r.season = $1 AND r.player_id = $2"
			query(queryStr, [season, pId], function(err, rows) {
				if (err) { return response.status(500).send("Error running query: " + err); }
				historyRows = rows;
				result.history = getHistoryResults(historyRows);
				returnResult();
			});
		}

		//
		// Only return response when all results are ready
		//

		function returnResult() {	
			if (result.breakpoints && result.player && result.lines && result.history) {
				return response.status(200).send(result);
			}
		}
	});

	//
	// Handle GET request for teams list
	//

	server.get("/api/teams/", function(request, response) {

		var season = 2016;

		// Query for stats by game
		var statRows;
		query(teamStatQueryString, [season], function(err, rows) {
			if (err) { return response.status(500).send("Error running query: " + err); }
			statRows = rows;
			processResults();
		});

		// Query for game results to calculate points - exclude playoff games
		var resultQueryString = "SELECT *"
			+ " FROM game_results"
			+ " WHERE game_id < 30000 AND season = $1";
		var resultRows;
		query(resultQueryString, [season], function(err, rows) {
			if (err) { return response.status(500).send("Error running query: " + err); }
			resultRows = rows;
			processResults();
		});

		// Process query results
		function processResults() {

			// Only start processing once all queries are finished
			if (!statRows || !resultRows) {
				return;
			}

			// Postgres aggregate functions like SUM return strings, so cast them as ints
			// Calculate score-adjusted corsi
			statRows.forEach(function(r) {
				["gp", "toi", "gf", "ga", "sf", "sa", "cf", "ca"].forEach(function(col) {
					r[col] = +r[col];
				});
				r.cf_adj = constants.cfWeights[r.score_sit] * r.cf;
				r.ca_adj = constants.cfWeights[-1 * r.score_sit] * r.ca;
			});

			// Group rows by team: { "edm": [rows for edm], "tor": [rows for tor] }
			statRows = _.groupBy(statRows, "team");

			//
			// Calculate the number of points won
			//

			// Initialize points counter
			Object.keys(statRows).forEach(function(tricode) {
				statRows[tricode].pts = 0;
			});

			// Loop through game_result rows and increment points
			resultRows.forEach(function(r) {
				var winner = r.a_final > r.h_final ? "a_team" : "h_team";
				statRows[r[winner]].pts += 2;
				if (r.periods > 3) {
					var loser = r.a_final < r.h_final ? "a_team" : "h_team";
					statRows[r[loser]].pts += 1;
				}
			});

			// Structure results as an array of objects: [ { team: "edm", data: [rows for edm] }, { team: "tor", data: [rows for tor] } ]
			var result = { teams: [] };
			Object.keys(statRows).forEach(function(tricode) {
				result.teams.push({
					team: tricode,
					pts: statRows[tricode].pts,
					gp: statRows[tricode][0].gp,
					data: statRows[tricode]
				});
			});

			// Set redundant properties in 'data' to be undefined - this removes them from the response
			result.teams.forEach(function(t) {
				t.data.forEach(function(r) {
					r.team = undefined;
					r.gp = undefined;
				});
			});

			// Aggregate score situations
			var stats = ["toi", "gf", "ga", "sf", "sa", "cf", "ca", "cf_adj", "ca_adj"];
			aggregateScoreSituations(result.teams, stats);
			return response.status(200).send(result);
		}
	});

	//
	// Handle GET request for a particular team
	//

	server.get("/api/teams/:tricode", function(request, response) {

		var tricode = request.params.tricode;
		var season = 2016;

		var shiftRows;
		var strSitRows;
		var eventRows;

		var teams = [];
		var result = {};

		queryBreakpoints();
		queryLines();
		queryHistory();

		//
		// Get the specified team's data and calculate breakpoints
		//

		var statRows;
		function queryBreakpoints() {
			query(teamStatQueryString, [season], function(err, rows) {
				if (err) { return response.status(500).send("Error running query: " + err); }
				statRows = rows;
				getBreakpoints();
			});
		}

		// Process query results
		function getBreakpoints() {

			// Postgres aggregate functions like SUM return strings, so cast them as ints
			// Calculate score-adjusted corsi
			statRows.forEach(function(r) {
				["toi", "gf", "ga", "sf", "sa", "cf", "ca"].forEach(function(col) {
					r[col] = +r[col];
				});
				r.cf_adj = constants.cfWeights[r.score_sit] * r.cf;
				r.ca_adj = constants.cfWeights[-1 * r.score_sit] * r.ca;
			});

			// Group rows by team: { "edm": [rows for edm], "tor": [rows for tor] }
			statRows = _.groupBy(statRows, "team");

			// Structure results as an array of objects: [ { team: "edm", data: [rows for edm] }, { team: "tor", data: [rows for tor] } ]
			Object.keys(statRows).forEach(function(tcode) {
				teams.push({
					team: tcode,
					gp: statRows[tcode][0].gp,
					data: statRows[tcode]
				});

				// Store a reference to the specified team's data. Remove redundant properties to reduce response size
				if (tricode === tcode) {
					result.team = teams[teams.length - 1];
					result.team.data.forEach(function(d) {
						d.team = undefined;
						d.gp = undefined;
					});
				}
			});

			// Aggregate score situations
			var stats = ["toi", "gf", "ga", "sf", "sa", "cf", "ca", "cf_adj", "ca_adj"];
			aggregateScoreSituations(teams, stats);

			// Get breakpoints
			result.breakpoints = {};
			var team = teams.find(function(d) { return d.team === tricode; });
			["ev5_cf_adj_per60", "ev5_ca_adj_per60", "ev5_gf_per60", "ev5_ga_per60", "pp_gf_per60", "sh_ga_per60"].forEach(function(s) {
				result.breakpoints[s] = { breakpoints: [], team: null };
				// Get the datapoints for which we want a distribution
				var datapoints = [];
				teams.forEach(function(t) {
					datapoints.push(getDatapoint(t, s));
				});
				// Sort datapoints in descending order and find breakpoints
				datapoints.sort(function(a, b) { return b - a; });
				[0, 5, 11, 17, 23, 29].forEach(function(rank) {
					result.breakpoints[s].breakpoints.push(datapoints[rank]);
				});
				// Store the team's datapoint
				result.breakpoints[s].team = getDatapoint(team, s);
			});

			returnResult();
		}

		// 't' is a team object; 's' is the stat to be calculated
		function getDatapoint(t, s) {
			var datapoint;
			if (s.indexOf("ev5_") >= 0) {
				if (s === "ev5_cf_adj_per60") {
					datapoint = t.stats.ev5.cf_adj;
				} else if (s === "ev5_ca_adj_per60") {
					datapoint = t.stats.ev5.ca_adj;
				} else if (s === "ev5_gf_per60") {
					datapoint = t.stats.ev5.gf;
				} else if (s === "ev5_ga_per60") {
					datapoint = t.stats.ev5.ga;
				}
				datapoint = t.stats.ev5.toi === 0 ? 0 : 60 * 60 * (datapoint / t.stats.ev5.toi);
			} else if (s === "pp_gf_per60") {
				datapoint = t.stats.pp.toi === 0 ? 0 : 60 * 60 * (t.stats.pp.gf / t.stats.pp.toi);
			} else if (s === "sh_ga_per60") {
				datapoint = t.stats.sh.toi === 0 ? 0 : 60 * 60 * (t.stats.sh.ga / t.stats.sh.toi);
			}
			return datapoint;
		}

		function queryLines() {

			// Query for shifts belonging to the team's players
			var queryStr = "SELECT s.game_id, s.team, s.player_id, s.period, s.shifts, r.\"first\", r.\"last\", r.\"positions\""
				+ " FROM game_shifts AS s"
				+ " INNER JOIN ("
					+ " SELECT player_id, \"first\", \"last\", string_agg(position, ',') as positions"
					+ " FROM game_rosters"
					+ " WHERE position != 'na' AND position != 'g' AND season = $1 AND team = $2" 
					+ " GROUP BY player_id, \"first\", \"last\""
				+ " ) AS r"
				+ " ON s.player_id = r.player_id"
				+ " WHERE s.season = $1 AND s.team = $2";
			query(queryStr, [season, tricode], function(err, rows) {
				if (err) { return response.status(500).send("Error running query: " + err); }
				shiftRows = rows;
				getLineResults();
			});

			// Query for the strength situations the team was in
			var queryStr = "SELECT *"
				+ " FROM game_strength_situations"
				+ " WHERE season = $1 AND team = $2";
			query(queryStr, [season, tricode], function(err, rows) {
				if (err) { return response.status(500).send("Error running query: " + err); }
				strSitRows = rows;
				getLineResults();
			});			

			// Query for events in the team's games
			var queryStr = "SELECT e.*"
				+ " FROM game_events AS e"
				+ " LEFT JOIN game_results AS r"
				+ " ON e.season = r.season AND e.game_id = r.game_id"
				+ " WHERE (e.type = 'goal' OR e.type = 'shot' OR e.type = 'missed_shot' OR e.type = 'blocked_shot')"
					+ " AND e.season = $1 AND (r.a_team = $2 OR r.h_team = $2)";
			query(queryStr, [season, tricode], function(err, rows) {
				if (err) { return response.status(500).send("Error running query: " + err); }
				eventRows = rows;
				getLineResults();
			});			
		}

		function getLineResults() {

			if (!shiftRows || !strSitRows || !eventRows) {
				return;
			}

			// Convert the raw timerange data in shiftRows and strSitRows into an array of timepoints
			shiftRows.forEach(function(s) {
				s.shifts = getTimepointArray(s.shifts);
			});
			strSitRows.forEach(function(s) {
				s.timeranges = getTimepointArray(s.timeranges);
			});

			// Get each player's f_or_d value
			var fdVals = {}; // Use player id as keys, f/d as values - will be used when increment event stats
			shiftRows.forEach(function(s) {
				var val = isForD(s.positions.split(","));
				s.f_or_d = val;
				fdVals[s.player_id] = val;
			});

			//
			// Loop through each game and period and calculate line toi
			//

			var lineResults = [];
			var gIds = _.uniqBy(shiftRows, "game_id").map(function(d) { return d.game_id; });
			gIds.forEach(function(gId) {
				var gShiftRows = shiftRows.filter(function(d) { return d.game_id === gId; });

				["f", "d"].forEach(function(f_or_d) {

					// Generate combinations and create objects to store each line's results
					var posShiftRows = gShiftRows.filter(function(d) { return d.f_or_d === f_or_d; });
					var uniqLinemates = _.uniqBy(posShiftRows, "player_id");
					var numLinemates = f_or_d === "f" ? 3 : 2;
					var combos = combinations.k_combinations(uniqLinemates, numLinemates);
					var lines = [];
					combos.forEach(function(combo) {
						initLine(f_or_d, combo, lines, lineResults);
					});

					// Loop through the game's periods to increment toi
					var prds = _.uniqBy(gShiftRows, "period").map(function(d) { return d.period; });
					lines.forEach(function(l) {
						var lineObj = lineResults.find(function(d) { return d.player_ids.toString() === l.toString(); });
						prds.forEach(function(prd) {
							var linemateRows = gShiftRows.filter(function(d) { return l.indexOf(d.player_id) >= 0 && d.period === prd; });
							var prdSsRows = strSitRows.filter(function(d) { return d.game_id === gId && d.period === prd; });
							// Get intersecting timepoints for all players
							var playerIntersection;
							if (f_or_d === "f" && linemateRows.length === 3) {
								playerIntersection = _.intersection(linemateRows[0].shifts, linemateRows[1].shifts, linemateRows[2].shifts);
							} else if (f_or_d === "d" && linemateRows.length === 2) {
								playerIntersection = _.intersection(linemateRows[0].shifts, linemateRows[1].shifts);
							}
							// Increment toi for all situations and ev5/sh/pp
							if (playerIntersection) {
								lineObj.all.toi += playerIntersection.length;
								prdSsRows.forEach(function(sr) {
									lineObj[sr.strength_sit].toi += _.intersection(playerIntersection, sr.timeranges).length;
								});
							}
						});
					});
				});
			});

			//
			// Append event stats to lineResults
			//

			eventRows.forEach(function(ev) {
				// Get whether the event was for or against the team
				var suffix = ev.team === tricode ? "f" : "a";
				// Get whether the team is home or away
				var isHome;
				if (ev.venue === "home") {
					isHome = ev.team === tricode ? true : false;
				} else if (ev.venue === "away") {
					isHome = ev.team === tricode ? false : true;
				}
				// Get the forwards and defense for which to increment stats
				// Combine the database home/away skater columns into an array, removing null values
				var skaters = isHome ? [ev.h_s1, ev.h_s2, ev.h_s3, ev.h_s4, ev.h_s5, ev.h_s6].filter(function(d) { return d; })
					: [ev.a_s1, ev.a_s2, ev.a_s3, ev.a_s4, ev.a_s5, ev.a_s6].filter(function(d) { return d; });
				var fwds = skaters.filter(function(sid) { return fdVals[sid] === "f"; });
				var defs = skaters.filter(function(sid) { return fdVals[sid] === "d"; });
				// Get combinations of linemates for which to increment stats
				// This handles events with more than 2 defense or more than 3 forwards on the ice
				["f", "d"].forEach(function(f_or_d) {
					var combos = f_or_d === "f" ? combinations.k_combinations(fwds, 3)
						: combinations.k_combinations(defs, 2);
					incrementLineShotStats(lineResults, combos, ev, isHome, suffix);				
				});
			});

			// Append line stats to response
			lineResults = lineResults.filter(function(d) { return d.all.toi >= 60; });
			result.lines = lineResults;
			returnResult();
		}

		//
		// Query and process game-by-game history
		//

		var historyRows;
		function queryHistory() {
			var queryStr = "SELECT s.game_id, s.team, r.h_team, r.a_team, r.h_final, r.a_final, r.periods, r.datetime, s.strength_sit, s.score_sit, s.toi,"
					+ " s.gf, s.ga, s.sf, s.sa, (s.sf + s.bsf + s.msf) AS cf, (s.sa + s.bsa + s.msa) AS ca"
				+ " FROM game_stats AS s"
				+ " LEFT JOIN game_results AS r"
					+ " ON s.season = r.season AND s.game_id = r.game_id"
				+ " WHERE s.season = $1 AND s.team = $2 AND s.player_id < 2";
			query(queryStr, [season, tricode], function(err, rows) {
				if (err) { return response.status(500).send("Error running query: " + err); }
				historyRows = rows;
				result.history = getHistoryResults(historyRows);
				returnResult();
			});
		}

		function returnResult() {
			if (result.team && result.lines && result.history && result.breakpoints) {
				return response.status(200).send(result);
			}
		}
	});

	// Start listening for requests
	server.listen(PORT, function(error) {
		if (error) { throw error; }
		console.log("Listening on " + PORT);
	});

	// Query the database and return result rows in json format
	// 'values' is an array of values for parameterized queries
	function query(text, values, cb) {
		pool.connect(function(err, client, done) {
			if (err) { returnError("Error fetching client from pool: " + err); }
			client.query(text, values, function(err, result) {
				done();
				// result.rows is is an array of Anonymous objects
				// Convert it to json using stringify and parse before returning it
				var returnedRows = err ? [] : JSON.parse(JSON.stringify(result.rows));
				cb(err, returnedRows);
			});
		});
	}
}

// Get the most-played position (f or d) from an array of positions [l,l,c,c,c]
function isForD(positions) {
	var position;
	var counts = { fwd: 0, def: 0, last: "" };
	positions.forEach(function(d) {
		if (d === "c" || d === "l" || d === "r") {
			counts.fwd++;
			counts.last = "f";
		} else if (d === "d") {
			counts.def++;
			counts.last = "d";
		}
	});
	if (counts.fwd > counts.def) {
		position = "f";
	} else if (counts.def > counts.fwd) {
		position = "d";
	} else if (counts.def === counts.fwd) {
		position = counts.last;
	}
	return position;	
}

// 'historyRows' is an array of game_stats rows for particular player or team (joined with game_results)
// The output 'historyResults' is ready to be returned in the api response
function getHistoryResults(historyRows) {

	// Calculate score-adjusted corsi
	historyRows.forEach(function(r) {
		r.cf_adj = constants.cfWeights[r.score_sit] * r.cf;
		r.ca_adj = constants.cfWeights[-1 * r.score_sit] * r.ca;
	});

	// Group rows by game_id (each game_id has rows for different strength and score situations): { 123: [rows for game 123], 234: [rows for game 234] }
	historyRows = _.groupBy(historyRows, "game_id");

	// Structure results as an array of objects: [ { game }, { game } ]
	var historyResults = [];
	for (var gId in historyRows) {
		if (!historyRows.hasOwnProperty(gId)) {
			continue;
		}

		// Store game results
		var team = historyRows[gId][0].team;
		var isHome = team === historyRows[gId][0].h_team ? true : false;
		var opp = isHome ? historyRows[gId][0].a_team : historyRows[gId][0].h_team;
		var teamFinal = historyRows[gId][0].h_final;
		var oppFinal = historyRows[gId][0].a_final;
		if (!isHome) {
			var tmp = teamFinal;
			teamFinal = oppFinal;
			oppFinal = tmp;
		}
		historyResults.push({
			game_id: +gId,
			team: team,
			is_home: isHome,
			opp: opp,
			team_final: teamFinal,
			opp_final: oppFinal,
			periods: historyRows[gId][0].periods,
			datetime: historyRows[gId][0].datetime,
			position: historyRows[gId][0].position,
			data: historyRows[gId]
		});
	}

	// Remove redundant properties from each game's data rows
	historyResults.forEach(function(g) {
		g.data.forEach(function(r) {
			r.game_id = undefined,
			r.datetime = undefined,
			r.position = undefined,
			r.team = undefined,
			r.a_team = undefined,
			r.h_team = undefined,
			r.a_final = undefined,
			r.h_final = undefined
		});
	});

	// Aggregate score situations for each game
	var stats = ["toi", "gf", "ga", "sf", "sa", "cf", "ca", "cf_adj", "ca_adj"];
	aggregateScoreSituations(historyResults, stats);
	return historyResults;
}

// 'lineResults' is an array of line objects used to store results
// 'combos' is an array of player id arrays to loop through: [ [111, 222, 333], [111, 222, 444] ]
// 'ev' is the event object
// 'isHome' is whether the team or player is the home team: true/false
// 'suffix' is whether the event was 'f' (for) or 'a' (against) the team or player
function incrementLineShotStats(lineResults, combos, ev, isHome, suffix) {
	// Get strength situation for the team
	var strSit;
	if (ev.a_g && ev.h_g) {
		if (ev.a_skaters === 5 && ev.h_skaters === 5) {
			strSit = "ev5";
		} else if (ev.a_skaters > ev.h_skaters && ev.h_skaters >= 3) {
			strSit = isHome ? "sh" : "pp";
		} else if (ev.h_skaters > ev.a_skaters && ev.a_skaters >= 3) {
			strSit = isHome ? "pp" : "sh";
		}
	}
	// Get the score situation and score adjustment factor for the player
	var scoreSit = isHome ? Math.max(-3, Math.min(3, ev.h_score - ev.a_score)) : 
		Math.max(-3, Math.min(3, ev.a_score - ev.h_score));
	// Increment stats for each combo for all situations, and ev/sh/pp
	combos.forEach(function(c) {
		c.sort(function(a, b) { return a - b; });
		var lineObj = lineResults.find(function(d) { return d.player_ids.toString() === c.toString(); });
		var sits = strSit ? ["all", strSit] : ["all"];
		sits.forEach(function(sit) {
			lineObj[sit]["c" + suffix]++;
			if (suffix === "f") {
				lineObj[sit]["cf_adj"] += constants.cfWeights[scoreSit];
			} else if (suffix === "a") {
				lineObj[sit]["ca_adj"] += constants.cfWeights[-1 * scoreSit];
			}
			if (ev.type === "goal") {
				lineObj[sit]["g" + suffix]++;
			}
		})
	});	
}

// 'timeranges' is a string: "start-end;start-end;..."
// First split the string into an array of intervals: ["start-end", "start-end", ...]
// Then convert each interval into an array of seconds played: [[start, start+1, start+2,..., end], [start, start+1, start+2,..., end]]
// Then flatten the nested arrays: [1,2,3,4,10,11,12,13,...]
function getTimepointArray(timeranges) {
	timeranges = timeranges
		.split(";")					
		.map(function(interval) {
			var times = interval.split("-");
			return _.range(+times[0], +times[1]);
		});
	return [].concat.apply([], timeranges);
}

// 'f_or_d' is 'f' or 'd'
// 'players' is an array of player objects: [ { player_id: ... }, { player_id: ... }] - contains player properties used to generate lines
// 'lines' is an array of player id arrays: [ [111, 222, 333], [222, 333, 444] ] - we'll loop through these lines and increment the stats
// 'lineResults' is an array of line objects that will be send in the api response
function initLine(f_or_d, players, lines, lineResults) {
	var pIds = [];
	var firsts = [];
	var lasts = [];
	// Sort player ids in ascending order
	players = players.sort(function(a, b) { return a.player_id - b.player_id; });
	players.forEach(function(lm) {
		pIds.push(lm.player_id);
		firsts.push(lm.first);
		lasts.push(lm.last);
	});
	// Record line as playing in the period
	if (!lines.find(function(d) { return d.toString() === pIds.toString(); })) {
		lines.push(pIds);
	}
	// Check if the combination already exists before creating the object
	if (!lineResults.find(function(d) { return d.player_ids.toString() === pIds.toString(); })) {
		lineResults.push({
			player_ids: pIds,
			firsts: firsts,
			lasts: lasts,
			f_or_d: f_or_d,
			all: { toi: 0, cf: 0, ca: 0, cf_adj: 0, ca_adj: 0, gf: 0, ga: 0 },
			ev5: { toi: 0, cf: 0, ca: 0, cf_adj: 0, ca_adj: 0, gf: 0, ga: 0 },
			pp:  { toi: 0, cf: 0, ca: 0, cf_adj: 0, ca_adj: 0, gf: 0, ga: 0 },
			sh:  { toi: 0, cf: 0, ca: 0, cf_adj: 0, ca_adj: 0, gf: 0, ga: 0 }
		});
	}
}

// Each team, player, or game object originally has a data property that contains an array of results, aggregated by strength and score situations:
//		data: [ {score_sit: 0, strength_sit: 'pp', cf: 10, ... }, {score_sit: 0, strength_sit: 'sh', cf: 5, ... } ]
// aggregateScoreSituations() will create a new property 'stats' that aggregates the original data by score situation, and uses the strength situation as keys
//		stats: { pp: { cf: 20, ... }, sh: { cf: 10, ... } }
// 'list' is an array of objects (teams or players)
// 'stats' is an array of property names to be summed
function aggregateScoreSituations(list, stats) {
	// For each strength situation, sum stats for all score situations
	list.forEach(function(p) {
		p.stats = {};											// Store the output totals in p.stats
		p.data = _.groupBy(p.data, "strength_sit");				// Group the original rows by strength_sit
		// Loop through each strength_sit and sum all rows
		["ev5", "pp", "sh", "noOwnG", "noOppG", "penShot", "other"].forEach(function(strSit) {
			p.stats[strSit] = {};
			stats.forEach(function(stat) {
				p.stats[strSit][stat] = _.sumBy(p.data[strSit], stat);
			});
			// Calculate on-ice save percentage
			p.stats[strSit].sv_pct = p.stats[strSit].sa === 0 ? 0 : 1 - (p.stats[strSit].ga / p.stats[strSit].sa);
		});
		p.data = undefined; // Remove the original data from the response
	});
	// Create an object for "all" strength situations
	list.forEach(function(p) {
		p.stats.all = {};
		stats.forEach(function(stat) {
			p.stats.all[stat] = 0;
			["ev5", "pp", "sh", "noOwnG", "noOppG", "penShot", "other"].forEach(function(strSit) {
				p.stats.all[stat] += p.stats[strSit][stat];
			});
		});
		// Calculate on-ice save percentage - exclude ga and sa while the player/team's own goalie is pulled
		var noOwnG_ga = p.stats.noOwnG ? p.stats.noOwnG.ga : 0;
		var noOwnG_sa = p.stats.noOwnG ? p.stats.noOwnG.sa : 0;
		p.stats.all.sv_pct = p.stats.all.sa - noOwnG_sa === 0 ? 0 : 1 - ((p.stats.all.ga - noOwnG_ga) / (p.stats.all.sa - noOwnG_sa));
		// Remove unnecessary strength_sits from response
		["noOwnG", "noOppG", "penShot", "other"].forEach(function(strSit) {
			p.stats[strSit] = undefined;
		})
	});
}