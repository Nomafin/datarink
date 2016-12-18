"use strict"

var pg = require("pg");
var _ = require("lodash");
var url = require("url");
var auth = require("http-auth");
var throng = require("throng");
var compression = require("compression");
var constants = require("./analysis-constants.json");

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

	//
	// Handle GET request for players api
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

			// Group rows by playerId:
			//	{ 123: [rows for player 123], 234: [rows for player 234] }
			statRows = _.groupBy(statRows, "player_id");

			// Structure results as an array of objects:
			// [ { playerId: 123, data: [rows for player 123] }, { playerId: 234, data: [rows for player 234] } ]
			var result = { players: [] };
			for (var pId in statRows) {
				if (!statRows.hasOwnProperty(pId)) {
					continue;
				}

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
			}

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

			return response.status(200).send(result);
		}
	});

	//
	// Handle GET request for a particular player id
	//

	server.get("/api/players/:id", function(request, response) {

		var pId = +request.params.id;
		var season = 2016;
		var result = {
			player: {},
			breakpoints: {}
		};
		var players = []; // An array of player objects

		//
		// Get the specified player's data and calculate breakpoints
		// Also prepare data (e.g., player positions) used for subsequent analyses
		//

		var statRows;
		query(skaterStatQueryString, [season], function(err, rows) {
			if (err) { return response.status(500).send("Error running query: " + err); }
			statRows = rows;
			getBreakpoints();
		});

		// Process query results
		function getBreakpoints() {

			// Group rows by playerId:
			//	{ 123: [rows for player 123], 234: [rows for player 234] }
			statRows = _.groupBy(statRows, "player_id");

			// Structure results as an array of objects:
			// [ { playerId: 123, data: [rows for player 123] }, { playerId: 234, data: [rows for player 234] } ]
			for (var sId in statRows) {
				if (!statRows.hasOwnProperty(sId)) {
					continue;
				}

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
			}

			// To calculate breakpoints, only consider players with the same position as the specified player
			// Remove players with less than 10 games played
			var breakpointPlayers = players.filter(function(d) { return d.f_or_d === result.player.f_or_d; });
			breakpointPlayers = breakpointPlayers.filter(function(d) { return d.gp >= 10; });

			// Postgres aggregate functions like SUM return strings, so cast them as ints
			// Calculate score-adjusted corsi
			breakpointPlayers.forEach(function(p) {
				p.data.forEach(function(r) {
					["toi", "ig", "is", "ic", "ia1", "ia2", "gf", "ga", "sf", "sa", "cf", "ca", "cf_off", "ca_off"].forEach(function(col) {
						r[col] = +r[col];
					});
					r.cf_adj = constants.cfWeights[r.score_sit] * r.cf;
					r.ca_adj = constants.cfWeights[-1 * r.score_sit] * r.ca;
				});
			});

			// Get breakpoints
			["all_toi", "ev5_cf_adj_per60", "ev5_ca_adj_per60", "ev5_p1_per60", "pp_p1_per60"].forEach(function(s) {

				// Initialize result
				result.breakpoints[s] = { breakpoints: [], player: null };

				// Get the datapoints for which we want a distribution
				var datapoints = [];
				breakpointPlayers.forEach(function(p) {
					var datapoint;
					if (s === "all_toi") {
						datapoint = _.sumBy(p.data, "toi") / p.gp;
					} else if (s === "ev5_cf_adj_per60" || s === "ev5_ca_adj_per60" || s === "ev5_p1_per60") {
						var rows = p.data.filter(function(d) { return d.strength_sit === "ev5"; });
						if (s === "ev5_cf_adj_per60") {
							datapoint = _.sumBy(rows, "cf_adj");
						} else if (s === "ev5_ca_adj_per60") {
							datapoint = _.sumBy(rows, "ca_adj");
						} else if (s === "ev5_p1_per60") {
							datapoint = _.sumBy(rows, "ig") + _.sumBy(rows, "ia1");
						}
						datapoint = 60 * 60 * (datapoint / _.sumBy(rows, "toi"));
					} else if (s === "pp_p1_per60") {
						var rows = p.data.filter(function(d) { return d.strength_sit === "pp"; });
						datapoint = _.sumBy(rows, "ig") + _.sumBy(rows, "ia1");
						datapoint = 60 * 60 * (datapoint / _.sumBy(rows, "toi"));
					}
					// Only calculate powerplay breakpoints for players with at least 20 minutes of pp time
					if (datapoint) {
						if (s !== "pp_p1_per60" || (s === "pp_p1_per60" && _.sumBy(rows, "toi") >= 20 * 60)) {
							datapoints.push(datapoint);
						}
					}
					// Store the player's datapoint
					if (p.player_id === pId) {
						if (_.sumBy(p.data, "toi") === 0) {
							result.breakpoints[s].player = 0;
						} else {
							result.breakpoints[s].player = datapoint;
						}
					}
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
			});

			queryLinemates();
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

			//
			// Loop through each of the players' period rows and calculate toi with linemates
			//

			var lineResults = [];
			shiftRows.filter(function(d) { return d.player_id === pId; })
				.forEach(function(pr) {

					// Select the strSitRow rows that have the same game and period
					var ssRows = strSitRows.filter(function(sr) { 
						return sr.game_id === pr.game_id && sr.period === pr.period;
					});

					// Select teammates' period rows that have the same game and period, and play the same position (f or d)
					var tmRows = shiftRows.filter(function(tr) {
						return tr.player_id !== pId && tr.game_id === pr.game_id && tr.period === pr.period
							&& result.player.f_or_d === isForD([tr.position]);
					});

					// Generate linemate combinations (pairs for defense, triplets for forwards)
					var uniqLinemates = _.uniqBy(tmRows, "player_id");
					var linesInPeriod = [];
					uniqLinemates.forEach(function(lm1) {
						if (result.player.f_or_d === "d") {
							createLineObject([lm1]);
						} else {		
							uniqLinemates.forEach(function(lm2) {
								if (lm1.player_id !== lm2.player_id) {
									createLineObject([lm1, lm2]);
								}
							});
						}
					});

					// Create an object in lineResults to store a line's players and stats
					// Record all lines in the period
					function createLineObject(linemates) {
						var pIds = [];
						var firsts = [];
						var lasts = [];
						// Sort player ids in ascending order
						linemates = linemates.sort(function(a, b) { return a.player_id - b.player_id; });
						linemates.forEach(function(lm) {
							pIds.push(lm.player_id);
							firsts.push(lm.first);
							lasts.push(lm.last);
						});
						// Record line as playing in the period
						if (!linesInPeriod.find(function(d) { return d.toString() === pIds.toString(); })) {
							linesInPeriod.push(pIds);
						}
						// Check if the combination already exists before creating the object
						if (!lineResults.find(function(d) { return d.player_ids.toString() === pIds.toString(); })) {
							lineResults.push({
								player_ids: pIds,
								firsts: firsts,
								lasts: lasts,
								all: { toi: 0, cf: 0, ca: 0, cf_adj: 0, ca_adj: 0, gf: 0, ga: 0 },
								ev5: { toi: 0, cf: 0, ca: 0, cf_adj: 0, ca_adj: 0, gf: 0, ga: 0 },
								pp:  { toi: 0, cf: 0, ca: 0, cf_adj: 0, ca_adj: 0, gf: 0, ga: 0 },
								sh:  { toi: 0, cf: 0, ca: 0, cf_adj: 0, ca_adj: 0, gf: 0, ga: 0 }
							});
						}
					};

					// Loop through each line that played in the period and increment toi
					// 'linesInPeriod' is an array of [playerId, playerId] (or [playerId] for defense)
					linesInPeriod.forEach(function(l) {
						// Get shift rows for each linemate
						var linemateRows = tmRows.filter(function(d) { return l.indexOf(d.player_id) >= 0; });
						// Get intersection of all linemate shifts and strSits
						var lineObj = lineResults.find(function(d) { return d.player_ids.toString() === l.toString(); });
						ssRows.forEach(function(sr) {
							if (linemateRows.length === 2) {
								lineObj[sr.strength_sit].toi += _.intersection(pr.shifts, linemateRows[0].shifts, linemateRows[1].shifts, sr.timeranges).length;			
							} else {
								lineObj[sr.strength_sit].toi += _.intersection(pr.shifts, linemateRows[0].shifts, sr.timeranges).length;
							}
						});
						// Get toi for all situations
						if (linemateRows.length === 2) {
							lineObj.all.toi += _.intersection(pr.shifts, linemateRows[0].shifts, linemateRows[1].shifts).length;
						} else {
							lineObj.all.toi += _.intersection(pr.shifts, linemateRows[0].shifts).length;
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

				// Get strength situation for the player
				var strSit;
				if (ev["a_g"] && ev["h_g"]) {
					if (ev["a_skaters"] === 5 && ev["h_skaters"] === 5) {
						strSit = "ev5";
					} else if (ev["a_skaters"] > ev["h_skaters"] && ev["h_skaters"] >= 3) {
						strSit = isHome ? "sh" : "pp";
					} else if (ev["h_skaters"] > ev["a_skaters"] && ev["a_skaters"] >= 3) {
						strSit = isHome ? "pp" : "sh";
					}
				}

				// Get the score situation and score adjustment factor for the player
				var scoreSit = Math.max(-3, Math.min(3, ev["a_score"] - ev["h_score"])).toString();
				if (isHome) {
					scoreSit = Math.max(-3, Math.min(3, ev["h_score"] - ev["a_score"])).toString();
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
				// If there are 2 forwards or less (e.g., in 3-on-3), combos will be empty
				var combos = [];
				skaters.forEach(function(s1) {
					if (result.player.f_or_d === "d") {
						combos.push([s1]);
					} else if (result.player.f_or_d === "f") {
						// For forwards, loop through 2 player combinations
						var skaters2 = skaters.filter(function(s2) { return s2 !== s1; });
						skaters2.forEach(function(s2) {
							// Sort player ids in ascending order
							var pair = [s1, s2];
							pair = pair.sort(function(a, b) { return a - b; });
							// Only record combination if it doesn't already exist
							if (!combos.find(function(d) { return d.toString() === pair.toString(); })) {
								combos.push(pair);
							}
						});
					}
				});

				// Increment stats for each combo
				combos.forEach(function(c) {
					var lineObj = lineResults.find(function(d) { return d.player_ids.toString() === c.toString(); });
					// Increment for "all" situations
					lineObj["all"]["c" + suffix]++;
					if (suffix === "f") {
						lineObj["all"]["c" + suffix + "_adj"] += constants.cfWeights[scoreSit];
					} else if (suffix === "a") {
						lineObj["all"]["c" + suffix + "_adj"] += constants.cfWeights[-1 * scoreSit];
					}
					if (ev.type === "goal") {
						lineObj["all"]["g" + suffix]++;
					}
					// Increment for ev5, sh, pp
					if (strSit) {
						lineObj[strSit]["c" + suffix]++;
						if (suffix === "f") {
							lineObj[strSit]["c" + suffix + "_adj"] += constants.cfWeights[scoreSit];
						} else if (suffix === "a") {
							lineObj[strSit]["c" + suffix + "_adj"] += constants.cfWeights[-1 * scoreSit];
						}
						if (ev.type === "goal") {
							lineObj[strSit]["g" + suffix]++;
						}
					}
				});
			});

			// Remove lines with less than 1min total toi before returning results
			lineResults = lineResults.filter(function(d) { return d.all.toi >= 60; });
			result.lines = lineResults;
			returnResult();
		}

		//
		// Only return response when all results are ready
		//

		function returnResult() {	
			if (result.breakpoints && result.player && result.lines) {
				return response.status(200).send(result);
			}
		}

		// Get the most-played position from an array of positions [l,l,c,c,c]
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
	});

	//
	// Handle GET request for teams api
	//

	server.get("/api/teams/", function(request, response) {

		var season = 2016;

		// Query for stats by game
		var statQueryString = "SELECT result1.*, result2.gp"
			+ " FROM "
			+ " ( "
				+ " SELECT team, score_sit, strength_sit, SUM(toi) AS toi,"
				+ "		SUM(gf) AS gf, SUM(ga) AS ga, SUM(sf) AS sf, SUM(sa) AS sa, (SUM(sf) + SUM(bsf) + SUM(msf)) AS cf, (SUM(sa) + SUM(bsa) + SUM(msa)) AS ca"
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
		var statRows;
		query(statQueryString, [season], function(err, rows) {
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

			// Group rows by team:
			// { "edm": [rows for edm], "tor": [rows for tor] }
			statRows = _.groupBy(statRows, "team");

			//
			// Calculate the number of points won
			//

			// Initialize points counter
			for (var tricode in statRows) {
				if (statRows.hasOwnProperty(tricode)) {
					statRows[tricode].pts = 0;
				}
			}

			// Loop through game_result rows and increment points
			resultRows.forEach(function(r) {
				var winner = r.a_final > r.h_final ? "a_team" : "h_team";
				statRows[r[winner]].pts += 2;
				if (r.periods > 3) {
					var loser = r.a_final < r.h_final ? "a_team" : "h_team";
					statRows[r[loser]].pts += 1;
				}
			});

			// Structure results as an array of objects:
			// [ { team: "edm", data: [rows for edm] }, { team: "tor", data: [rows for tor] } ]
			var result = { teams: [] };
			for (var tricode in statRows) {
				if (!statRows.hasOwnProperty(tricode)) {
					continue;
				}
				result.teams.push({
					team: tricode,
					pts: statRows[tricode].pts,
					gp: statRows[tricode][0].gp,
					data: statRows[tricode]
				});
			}

			// Set redundant properties in 'data' to be undefined - this removes them from the response
			result.teams.forEach(function(t) {
				t.data.forEach(function(r) {
					r.team = undefined;
					r.gp = undefined;
				});
			});
			
			return response.status(200).send(result);
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