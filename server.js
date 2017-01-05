"use strict"

var pg = require("pg");
var _ = require("lodash");
var url = require("url");
var throng = require("throng");
var compression = require("compression");
var apicache = require("apicache");
var constants = require("./analysis-constants.json");
var combinations = require("./combinations");

var PORT = process.env.PORT || 5000;
var WORKERS = process.env.WEB_CONCURRENCY || 1;

throng({
	workers: WORKERS,
	lifetime: Infinity,
	start: start
});

// By default, node-postgres interprets incoming timestamps in the local timezone
// Force node-postgres to interpret the incoming timestamps without any offsets (since our queries will select timestamps in the desired timezone)
pg.types.setTypeParser(1114, function(stringValue) {
	return new Date(Date.parse(stringValue + "+0000"));
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
	var cache = apicache.middleware;
	server.use(compression({ filter: shouldCompress }));

	// Determine whether or not responses should be compressed
	// Due to a limitation with apicache, do not compress responses that we want cached
	function shouldCompress(request, response) {
		if (request.headers["x-no-compression"]) {
			return false;
		}
		return compression.filter(request, response);
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
				+ "	SUM(cf_off) AS cf_off, SUM(ca_off) AS ca_off" 
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
	// Handle GET request for highlights
	//

	server.get("/api/highlights/", cache("24 hours"), function(request, response) {

		var season = 2016;
		var result = {};

		queryRecentStats();
		querySeasonStats();

		// Query for teams' and players' stats in their last 10 games
		function queryRecentStats() {
			// "t" is a list of all teams
			// For each team, get their last 10 games, "g"
			var queryStr = "SELECT p.first, p.last, p.position, s.player_id, s.team, s.strength_sit, s.score_sit,"
					+ "	SUM(toi) AS toi, SUM(ig) AS ig, SUM(\"is\") AS \"is\", (SUM(\"is\") + SUM(ibs) + SUM(ims)) AS ic, SUM(ia1) AS ia1, SUM(ia2) AS ia2,"
					+ "	SUM(gf) AS gf, SUM(ga) AS ga, SUM(sf) AS sf, SUM(sa) AS sa, (SUM(sf) + SUM(bsf) + SUM(msf)) AS cf, (SUM(sa) + SUM(bsa) + SUM(msa)) AS ca,"
					+ "	SUM(cf_off) AS cf_off, SUM(ca_off) AS ca_off,"
					+ " string_agg(to_char(s.game_id, '99999'), ',') AS game_ids"
				+ " FROM ("
					+ " SELECT *"
					+ " FROM (SELECT DISTINCT(team) AS \"team\" FROM game_rosters WHERE season = $1) AS t"
					+ " JOIN LATERAL ("
						+ " SELECT *"
						+ " FROM game_results"
						+ " WHERE season = $1 AND (a_team = t.team OR h_team = t.team)"
						+ " ORDER BY datetime DESC"
						+ " LIMIT 10"
					+ " ) AS g"
					+ " ON true"
				+ " ) AS r"
				+ " LEFT JOIN game_stats AS s"
				+ " ON r.season = s.season AND r.game_id = s.game_id AND r.team = s.team"
				+ " LEFT JOIN game_rosters AS p"
				+ " ON s.season = p.season AND s.game_id = p.game_id AND s.player_id = p.player_id"
				+ " GROUP BY p.first, p.last, p.position, s.player_id, s.team, s.strength_sit, s.score_sit";
			query(queryStr, [season], function(err, rows) {
				if (err) { return response.status(500).send("Error running query: " + err); }
				processRows(rows, "recent");
			});
		}

		// Query for teams' and players' season stats
		function querySeasonStats() {
			var queryStr = "SELECT p.first, p.last, p.position, s.player_id, s.team, s.strength_sit, s.score_sit,"
					+ "	SUM(toi) AS toi, SUM(ig) AS ig, SUM(\"is\") AS \"is\", (SUM(\"is\") + SUM(ibs) + SUM(ims)) AS ic, SUM(ia1) AS ia1, SUM(ia2) AS ia2,"
					+ "	SUM(gf) AS gf, SUM(ga) AS ga, SUM(sf) AS sf, SUM(sa) AS sa, (SUM(sf) + SUM(bsf) + SUM(msf)) AS cf, (SUM(sa) + SUM(bsa) + SUM(msa)) AS ca,"
					+ "	SUM(cf_off) AS cf_off, SUM(ca_off) AS ca_off,"
					+ " string_agg(to_char(s.game_id, '99999'), ',') AS game_ids"
				+ " FROM game_stats AS s"
				+ " LEFT JOIN game_rosters AS p"
				+ " ON s.season = p.season AND s.game_id = p.game_id AND s.player_id = p.player_id"
				+ " WHERE s.season = $1"
				+ " GROUP BY p.first, p.last, p.position, s.player_id, s.team, s.strength_sit, s.score_sit";
			query(queryStr, [season], function(err, rows) {
				if (err) { return response.status(500).send("Error running query: " + err); }
				processRows(rows, "season");
			});
		}

		// Process stat rows from the recent and season queries
		// 'rows' are the query results
		// 'mode' values: recent, season
		function processRows(rows, mode) {

			// Cast Postgres SUMs as ints, and calculate score-adjusted corsi
			// Separate team and skater rows
			var teams = [];
			var skaters = [];
			rows.forEach(function(r) {
				["toi", "ig", "is", "ic", "ia1", "ia2", "gf", "ga", "sf", "sa", "cf", "ca", "cf_off", "ca_off"].forEach(function(col) {
					r[col] = +r[col];
				});
				r.cf_adj = constants.cfWeights[r.score_sit] * r.cf;
				r.ca_adj = constants.cfWeights[-1 * r.score_sit] * r.ca;
				if (r.player_id < 2) {
					teams.push(r);
				} else if (r.position !== "g" && r.position !== "na") {
					skaters.push(r);
				}
			});

			// Group skater rows by playerId: { 123: [rows for player 123], 234: [rows for player 234] }
			// Group team rows by tricode
			skaters = _.groupBy(skaters, "player_id");
			teams = _.groupBy(teams, "team");

			// Structure skater data as an array of objects: [ { playerId: 123, data: [rows for player 123] }, { playerId: 234, data: [rows for player 234] } ]
			var tmpSkaters = [];
			Object.keys(skaters).forEach(function(pId) {
				// Combine all the string_agg(game_id) values: [ [111, 222], [111], [111, 222] ] 
				var gameIds = skaters[pId].map(function(d) {
					return d.game_ids.split(",").map(function(gId) { return +gId; });
				});
				gameIds = gameIds.toString()				// Flatten the nested array into a string: 111, 222, 111, 111, 222
					.split(",") 							// Split the string into a flat array 
					.map(function(gId) { return +gId; });	// Convert values to integers
				gameIds = _.uniq(gameIds); 					// Get the unique game ids
				tmpSkaters.push({
					player_id: +pId,
					positions: _.uniqBy(skaters[pId], "position").map(function(d) { return d.position; }),
					teams: _.uniqBy(skaters[pId], "team").map(function(d) { return d.team; }),
					first: skaters[pId][0].first,
					last: skaters[pId][0].last,
					gp: gameIds.length,
					data: skaters[pId]
				});
			});
			skaters = tmpSkaters;

			// Structure team data as an array of objects: [ { team: tor, data: [rows for tor] }, { team: edm, data: [rows for edm] } ]
			var tmpTeams = [];
			Object.keys(teams).forEach(function(tricode) {
				var gameIds = teams[tricode].map(function(d) {
					return d.game_ids.split(",").map(function(gId) { return +gId; });
				});
				gameIds = gameIds.toString()
					.split(",")
					.map(function(gId) { return +gId; });
				gameIds = _.uniq(gameIds);
				tmpTeams.push({
					team: tricode,
					gp: gameIds.length,
					data: teams[tricode]
				});
			});
			teams = tmpTeams;

			// Aggregate score situations for teams and skaters
			var stats = ["toi", "ig", "is", "ic", "ia1", "ia2", "gf", "ga", "sf", "sa", "cf", "ca", "cf_off", "ca_off", "cf_adj", "ca_adj"];
			aggregateScoreSituations(skaters, stats);
			var stats = ["toi", "gf", "ga", "sf", "sa", "cf", "ca", "cf_adj", "ca_adj"];
			aggregateScoreSituations(teams, stats);

			// Get the top X players
			// 'objects' is an array of skater or teamobjects
			// 'sit' is the strength situation: all, ev5, pp, sh
			// 'stat' is the property name by which to rank players
			// 'limit' is the number of players to return (if there are ties, more players will be returned)
			function getLeaders(objects, sit, stat, limit) {
				// Return an empty array if 'objects' is empty after filtering
				if (objects.length === 0) {
					return [];
				}
				var returnedSkaters = [];
				// Store the sort value
				objects.forEach(function(s) {
					if (stat === "i_sh_pct") {
						s.sort_val = s.stats[sit].is < 10 ? 0 : s.stats[sit].ig / s.stats[sit].is; // Make sure shots > 0 (or use a higher threshold)
					} else if (stat === "ip") {
						s.sort_val = s.stats[sit].ig + s.stats[sit].ia1 + s.stats[sit].ia2;
					} else if (stat === "c_diff_adj") {
						s.sort_val = s.stats[sit].cf_adj - s.stats[sit].ca_adj;
					} else if (stat === "g_diff") {
						s.sort_val = s.stats[sit].gf - s.stats[sit].ga;
					} else if (stat === "sh_pct") {
						s.sort_val = s.stats[sit].sf <= 0 ? 0 : s.stats[sit].gf / s.stats[sit].sf;
					} else {
						s.sort_val = s.stats[sit][stat];
					}
					s["sorted_" + stat] = s.sort_val;
				});
				// For cf_pct_rel, apply a minimum toi
				if (stat === "cf_pct_rel") {
					objects = objects.filter(function(d) { return d.stats[sit].toi >= 60 * 60; });
				}
				// Get the 5th ranked player's stat value - if there are fewer than 5 players, then get the last player's value
				objects = objects.sort(function(a, b) { return b.sort_val - a.sort_val; });
				var cutoff = objects[limit - 1] ? objects[limit - 1].sort_val : objects[objects.length - 1].sort_val;
				// Add players to returnedSkaters until the cutoff value is passed
				var i = 0;
				var isCutoffExceeded = false;
				while (i < objects.length && !isCutoffExceeded) {
					if (objects[i].sort_val >= cutoff) {
						returnedSkaters.push(objects[i]);
					} else {
						isCutoffExceeded = true;
					}
					i++;
				}
				objects.forEach(function(p) {
					p.sort_val = undefined;
				});
				return returnedSkaters;
			}
			// Add results to response
			result[mode] = {
				ig: getLeaders(skaters, "all", "ig", 5),
				ip: getLeaders(skaters, "all", "ip", 5),
				ev5_ic: getLeaders(skaters, "ev5", "ic", 5),
				i_ev5_c_diff_adj: getLeaders(skaters, "ev5", "c_diff_adj", 5),
				i_sh_pct: getLeaders(skaters, "all", "i_sh_pct", 5),
				tm_g_diff: getLeaders(teams, "all", "g_diff", 5),
				tm_ev5_c_diff_adj: getLeaders(teams, "ev5", "c_diff_adj", 5),
				tm_sh_pct: getLeaders(teams, "all", "sh_pct", 5),
				tm_sv_pct: getLeaders(teams, "all", "sv_pct", 5)
			};
			// Send response when recent and season results are ready
			if (result.recent && result.season) {
				return response.status(200).send(result);
			}
		}
	});

	//
	// Structure query results for team stats
	//


	function structureTeamStatRows(rows) {
		var resultRows = [];
		// Postgres aggregate functions like SUM return strings, so cast them as ints
		// Calculate score-adjusted corsi
		rows.forEach(function(r) {
			["gp", "toi", "gf", "ga", "sf", "sa", "cf", "ca"].forEach(function(col) {
				r[col] = +r[col];
			});
			r.cf_adj = constants.cfWeights[r.score_sit] * r.cf;
			r.ca_adj = constants.cfWeights[-1 * r.score_sit] * r.ca;
		});
		// Group rows by team: { "edm": [rows for edm], "tor": [rows for tor] }
		rows = _.groupBy(rows, "team");
		// Structure results as an array of objects: [ { team: "edm", data: [rows for edm] }, { team: "tor", data: [rows for tor] } ]
		Object.keys(rows).forEach(function(tricode) {
			resultRows.push({
				team: tricode,
				gp: rows[tricode][0].gp,
				data: rows[tricode]
			});
		});
		// Set redundant properties in 'data' to be undefined - this removes them from the response
		resultRows.forEach(function(t) {
			t.data.forEach(function(r) {
				r.team = undefined;
				r.gp = undefined;
			});
		});
		// Aggregate score situations
		var stats = ["toi", "gf", "ga", "sf", "sa", "cf", "ca", "cf_adj", "ca_adj"];
		aggregateScoreSituations(resultRows, stats);
		return resultRows;
	}

	//
	// Structure query results for skater stats
	//

	function structureSkaterStatRows(rows) {
		var resultRows = [];
		// Postgres aggregate functions like SUM return strings, so cast them as ints
		// Calculate score-adjusted corsi
		rows.forEach(function(r) {
			["toi", "ig", "is", "ic", "ia1", "ia2", "gf", "ga", "sf", "sa", "cf", "ca", "cf_off", "ca_off"].forEach(function(col) {
				r[col] = +r[col];
			});
			r.cf_adj = constants.cfWeights[r.score_sit] * r.cf;
			r.ca_adj = constants.cfWeights[-1 * r.score_sit] * r.ca;
		});
		// Group rows by playerId: { 123: [rows for player 123], 234: [rows for player 234] }
		rows = _.groupBy(rows, "player_id");
		// Structure results as an array of objects: [ { playerId: 123, data: [rows for player 123] }, { playerId: 234, data: [rows for player 234] } ]
		Object.keys(rows).forEach(function(pId) {
			// Get all teams and positions the player has been on, as well as games played
			var positions = rows[pId][0].positions.split(",");	
			resultRows.push({
				player_id: +pId,
				teams: _.uniqBy(rows[pId], "team").map(function(d) { return d.team; }),
				gp: positions.length,
				positions: _.uniq(positions),
				f_or_d: isForD(positions),
				first: rows[pId][0].first,
				last: rows[pId][0].last,
				data: rows[pId]
			});
		});
		// Set redundant properties in each player's data rows to be undefined - this removes them from the response
		// Setting the properties to undefined is faster than deleting the properties completely
		resultRows.forEach(function(p) {
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
		aggregateScoreSituations(resultRows, stats);
		return resultRows;
	}

	//
	// Handle GET request for players list
	//

	server.get("/api/players/", cache("24 hours"), function(request, response) {
		var season = 2016;
		query(skaterStatQueryString, [season], function(err, rows) {
			if (err) { return response.status(500).send("Error running query: " + err); }
			var result = { players: structureSkaterStatRows(rows) };
			response.status(200).send(result);
		});
	});

	//
	// Handle GET request for player breakpoints
	//

	server.get("/api/players/breakpoints", cache("24 hours"), function(request, response) {
		var season = 2016;
		var result = { f_breakpoints: {}, d_breakpoints: {} };
		query(skaterStatQueryString, [season], function(err, rows) {
			if (err) { return response.status(500).send("Error running query: " + err); }
			getBreakpoints(rows);
		});
		function getBreakpoints(rows) {
			var players = structureSkaterStatRows(rows);
			["f", "d"].forEach(function(f_or_d) {
				["all_toi", "ev5_cf_adj_per60", "ev5_ca_adj_per60", "ev5_p1_per60", "pp_p1_per60"].forEach(function(s) {
					result[f_or_d + "_breakpoints"][s] = [];
					// To calculate breakpoints, only consider players with the same position as the specified player, and with at least 10gp
					// For powerplay breakpoints, only consider players with at least 20 minutes of pp time
					var breakpointPlayers = players.filter(function(d) { return d.f_or_d === f_or_d && d.gp >= 10; });
					if (s === "pp_p1_per60") {
						breakpointPlayers = breakpointPlayers.filter(function(p) { return p.stats.pp.toi >= 20 * 60; });
					}
					// Get the datapoints for which we want a distribution
					var datapoints = [];
					breakpointPlayers.forEach(function(p) {
						datapoints.push(getDatapoint(p, s));
					});
					// Sort datapoints
					if (s === "ev5_ca_adj_per60") {
						datapoints.sort(function(a, b) { return a - b; }); // Ascending order
					} else {
						datapoints.sort(function(a, b) { return b - a; }); // Descending order
					}
					// Get value for each rank
					var ranks = f_or_d === "f" ? [0, 89, 179, 269, 359] : [0, 59, 119, 179];
					var i = 0;
					var done = false;
					while (!done && i < ranks.length) {
						var rank = ranks[i];
						if (datapoints[rank]) {
							result[f_or_d + "_breakpoints"][s].push(datapoints[rank]);
						} else {
							result[f_or_d + "_breakpoints"][s].push(datapoints[datapoints.length - 1]);
							done = true;
						}				
						i++;	
					}
				});
			});
			return response.status(200).send(result);
		}
		// Get datapoints for calculating breakpoints
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
	});

	//
	// Handle GET request for a particular player id
	//

	server.get("/api/players/:id", function(request, response) {

		var pId = +request.params.id;
		var season = 2016;
		var result = {};
		var player = {};

		var statQuery = "SELECT result1.*, result2.positions"
			+ " FROM "
			+ " ( "
				+ " SELECT s.team, s.player_id, r.first, r.last, s.score_sit, s.strength_sit, r.position,"
					+ "	SUM(toi) AS toi, SUM(ig) AS ig, SUM(\"is\") AS \"is\", (SUM(\"is\") + SUM(ibs) + SUM(ims)) AS ic, SUM(ia1) AS ia1, SUM(ia2) AS ia2,"
					+ "	SUM(gf) AS gf, SUM(ga) AS ga, SUM(sf) AS sf, SUM(sa) AS sa, (SUM(sf) + SUM(bsf) + SUM(msf)) AS cf, (SUM(sa) + SUM(bsa) + SUM(msa)) AS ca,"
					+ "	SUM(cf_off) AS cf_off, SUM(ca_off) AS ca_off " 
				+ " FROM game_stats AS s"
					+ " LEFT JOIN game_rosters AS r"
					+ " ON s.player_id = r.player_id AND s.season = r.season AND s.game_id = r.game_id"
				+ " WHERE s.player_id = $2 AND r.position != 'na' AND r.position != 'g' AND s.season = $1"
				+ " GROUP BY s.team, s.player_id, r.first, r.last, r.position, s.score_sit, s.strength_sit"
			+ " ) AS result1"
			+ " LEFT JOIN"
			+ " ( "
				+ " SELECT player_id, string_agg(position, ',') as positions"
				+ " FROM game_rosters"
				+ " WHERE position != 'na' AND position != 'g' AND season = $1 AND player_id = $2"
				+ " GROUP BY player_id"
			+ " ) AS result2"
			+ " ON result1.player_id = result2.player_id";

		queryHistory();
		queryStats();

		//
		// Get the specified player's data and calculate breakpoints
		// Also prepare data (e.g., player positions) used for subsequent analyses
		//

		var statRows;
		function queryStats() {
			query(statQuery, [season, pId], function(err, rows) {
				if (err) { return response.status(500).send("Error running query: " + err); }
				statRows = rows;
				getStats();
			});
		}

		// Process query results
		function getStats() {

			// Postgres aggregate functions like SUM return strings, so cast them as ints
			// Calculate score-adjusted corsi
			statRows.forEach(function(r) {
				["toi", "ig", "is", "ic", "ia1", "ia2", "gf", "ga", "sf", "sa", "cf", "ca", "cf_off", "ca_off"].forEach(function(col) {
					r[col] = +r[col];
				});
				r.cf_adj = constants.cfWeights[r.score_sit] * r.cf;
				r.ca_adj = constants.cfWeights[-1 * r.score_sit] * r.ca;
			});

			// Create player object in response
			player.player_id = pId;
			var positions = statRows[0].positions.split(",");
			player.gp = positions.length;
			player.f_or_d = isForD(positions);
			player.first = statRows[0].first;
			player.last = statRows[0].last;
			player.data = statRows;
			player.data.forEach(function(d) {
				d.team = undefined;
				d.player_id = undefined;
				d.first = undefined;
				d.last = undefined;
				d.positions = undefined;
			});

			// Aggregate stats and respond
			var stats = ["toi", "ig", "is", "ic", "ia1", "ia2", "gf", "ga", "sf", "sa", "cf", "ca", "cf_off", "ca_off", "cf_adj", "ca_adj"];
			aggregateScoreSituations([player], stats);
			result.player = player;
			returnResult();
		}

		//
		// Query and process game-by-game history
		//

		var historyRows;
		function queryHistory() {
			var queryStr = "SELECT r.game_id, r.team, g.h_team, g.a_team, g.h_final, g.a_final, g.periods, g.datetime AT TIME ZONE 'America/New_York' AS datetime, r.position, s.strength_sit, s.score_sit, s.toi, s.ig,"
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
			if (result.player && result.history) {
				return response.status(200).send(result);
			}
		}
	});

	//
	// Handle GET requests for a particular player's linemates
	//

	server.get("/api/players/:id/lines", function(request, response) {

		var pId = +request.params.id;
		var season = 2016;
		var result = {};

		var shiftRows;
		var strSitRows;
		var eventRows;
		
		queryLinemates();

		function queryLinemates() {

			// Query for shifts belonging to the player and his teammates
			// 'p' contains all of the specified player's game_rosters rows (i.e., all games they played in, regardless of team)
			// 'sh' contains all player shifts, including player names and all of a player's positions ('r' used string_agg to combine all of a player's positions)
			// Join 'p' with 'sh' to get all shifts belonging to the specified player and his teammates
			// Also use this to get all positions the player has played
			var queryStr = "SELECT sh.*"
				+ " FROM game_rosters AS p"
				+ " LEFT JOIN ("
					+ " SELECT s.game_id, s.team, s.player_id, s.period, s.shifts, r.\"first\", r.\"last\", r.positions"
					+ " FROM game_shifts AS s"
					+ " INNER JOIN ("
						+ " SELECT player_id, \"first\", \"last\", string_agg(position, ',') as positions"
						+ " FROM game_rosters"
						+ " WHERE position != 'na' AND position != 'g' AND season = $1"
						+ " GROUP BY player_id, \"first\", \"last\""
					+ " ) as r"
					+ " ON s.player_id = r.player_id"
					+ " WHERE s.season = $1"
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

				// Only consider players with the same f/d value as the specified player
				[fdVals[pId]].forEach(function(f_or_d) {

					// Generate combinations and create objects to store each line's results
					var posShiftRows = gShiftRows.filter(function(d) { return d.f_or_d === f_or_d; });
					var uniqLinemates = _.uniqBy(posShiftRows, "player_id").filter(function(d) { return d.player_id !== pId; });
					var numLinemates = f_or_d === "f" ? 2 : 1;
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
							var ownRow = gShiftRows.find(function(d) { return d.player_id === pId && d.period === prd; });
							if (ownRow) { // Ensure the player has a shift row, as they might not have played in the period
								var linemateRows = gShiftRows.filter(function(d) { return l.indexOf(d.player_id) >= 0 && d.period === prd; });
								var prdSsRows = strSitRows.filter(function(d) { return d.game_id === gId && d.period === prd; });
								// Get intersecting timepoints for all players
								var playerIntersection;
								if (f_or_d === "f" && linemateRows.length === 2) {
									playerIntersection = _.intersection(ownRow.shifts, linemateRows[0].shifts, linemateRows[1].shifts);
								} else if (f_or_d === "d" && linemateRows.length === 1) {
									playerIntersection = _.intersection(ownRow.shifts, linemateRows[0].shifts);
								}
								// Increment toi for all situations and ev5/sh/pp
								if (playerIntersection) {
									lineObj.all.toi += playerIntersection.length;
									prdSsRows.forEach(function(sr) {
										lineObj[sr.strength_sit].toi += _.intersection(playerIntersection, sr.timeranges).length;
									});
								}
							}
						});
					});
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
				skaters = skaters
					.filter(function(sid) { return sid !== pId; })
					.filter(function(sid) { return fdVals[sid] === fdVals[pId]; });

				// Get combinations of linemates for which to increment stats
				// This handles events with more than 2 defense or more than 3 forwards on the ice
				var numLinemates = fdVals[pId] === "d" ? 1 : 2;
				var combos = combinations.k_combinations(skaters, numLinemates);
				incrementLineShotStats(lineResults, combos, ev, isHome, suffix);
			});

			// Filter lines by toi before responding
			result.lines = lineResults.filter(function(d) { return d.all.toi >= 300; });
			return response.status(200).send(result);
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
		var resultRows;
		var resultQueryString = "SELECT *"
			+ " FROM game_results"
			+ " WHERE game_id < 30000 AND season = $1";
		query(resultQueryString, [season], function(err, rows) {
			if (err) { return response.status(500).send("Error running query: " + err); }
			resultRows = rows;
			processResults();
		});

		// Process query results when both queries are finished
		function processResults() {
			if (!statRows || !resultRows) {
				return;
			}
			// Structure stats
			var teamStats = structureTeamStatRows(statRows);
			// Initialize points counter
			teamStats.forEach(function(r) {
				r.pts = 0;
			});
			// Loop through game_result rows and increment points
			resultRows.forEach(function(r) {
				var winner = r.a_final > r.h_final ? r.a_team : r.h_team;
				teamStats.find(function(d) { return d.team === winner; }).pts += 2;
				if (r.periods > 3) {
					var loser = r.a_final < r.h_final ? r.a_team : r.h_team;
					teamStats.find(function(d) { return d.team === loser; }).pts += 1;
				}
			});
			return response.status(200).send({ teams: teamStats });
		}
	});

	//
	// Handle GET request for a particular team
	//

	server.get("/api/teams/:tricode", function(request, response) {

		var tricode = request.params.tricode;
		var season = 2016;
		var result = {};

		//
		// Calculate breakpoints
		//

		query(teamStatQueryString, [season], function(err, rows) {
			if (err) { return response.status(500).send("Error running query: " + err); }
			getBreakpoints(rows);
		});

		function getBreakpoints(rows) {
			var teams = structureTeamStatRows(rows);
			// Include the specified team's data in the response
			result.team = teams.find(function(d) { return d.team === tricode; });
			// Get breakpoints
			result.breakpoints = {};
			var team = teams.find(function(d) { return d.team === tricode; });
			["ev5_cf_adj_per60", "ev5_ca_adj_per60", "ev5_gf_per60", "ev5_ga_per60", "pp_gf_per60", "sh_ga_per60"].forEach(function(s) {
				result.breakpoints[s] = { breakpoints: [], self: null, isSelfInDistribution: true };
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
				result.breakpoints[s].self = getDatapoint(team, s);
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

		//
		// Get game-by-game history and calculate points
		//

		var queryStr = "SELECT s.game_id, s.team, r.h_team, r.a_team, r.h_final, r.a_final, r.periods, r.datetime AT TIME ZONE 'America/New_York' AS datetime, s.strength_sit, s.score_sit, s.toi,"
				+ " s.gf, s.ga, s.sf, s.sa, (s.sf + s.bsf + s.msf) AS cf, (s.sa + s.bsa + s.msa) AS ca"
			+ " FROM game_stats AS s"
			+ " LEFT JOIN game_results AS r"
				+ " ON s.season = r.season AND s.game_id = r.game_id"
			+ " WHERE s.season = $1 AND s.team = $2 AND s.player_id < 2";

		query(queryStr, [season, tricode], function(err, rows) {
			if (err) { return response.status(500).send("Error running query: " + err); }
			result.history = getHistoryResults(rows);
			// result.team might not exist yet, so store points as a sibling property
			result.points = 0;
			result.history.filter(function(r) { return r.game_id < 30000; })
				.forEach(function(r) {
					if (r.team_final > r.opp_final) {
						result.points += 2;
					} else if (r.team_final < r.opp_final && r.periods > 3) {
						result.points += 1;
					}
				});
			returnResult();
		});

		//
		// When all results are ready, reorganize the 'points' property and send response
		//
		
		function returnResult() {
			if (result.team && result.history && result.breakpoints && result.points) {	
				result.team.points = result.points;
				result.points = undefined;
				return response.status(200).send(result);
			}
		}
	});

	//
	// Handle GET request for a particular team's lines
	//

	server.get("/api/teams/:tricode/lines", function(request, response) {

		var tricode = request.params.tricode;
		var season = 2016;

		var shiftRows;
		var strSitRows;
		var eventRows;
		var result = {};

		queryLines();

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

			// Filter lines by toi before responding
			result.lines = lineResults.filter(function(d) { return d.all.toi >= 300; });
			return response.status(200).send(result);
		}
	});

	//
	// Route to manually clear cached responses
	//

	server.get("/api/cache/clear", function(request, response) {
		response.json(apicache.clear());
	});

	//
	// Start listening for requests
	//

	server.listen(PORT, function(error) {
		if (error) { throw error; }
		console.log("Listening on " + PORT);
	});

	// Query the database and return result rows in json format
	// 'values' is an array of values for parameterized queries
	function query(text, values, cb) {
		pool.connect(function(err, client, done) {
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
	var stats = ["toi", "ig", "ia1", "ia2", "ic", "gf", "ga", "sf", "sa", "cf", "ca", "cf_adj", "ca_adj"];
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