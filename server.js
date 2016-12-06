"use strict"

var pg = require("pg");
var _ = require("lodash");
var url = require("url");
var auth = require("http-auth");
var throng = require("throng");
var constants = require("./server-constants.json");

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
	server.use(express.static("node_modules/vue/dist"));
	server.use(express.static("node_modules/vue-router/dist"));
	server.use(express.static("node_modules/lodash"));

	//
	// Handle GET request for players api
	//

	server.get("/api/players/", function(request, response) {

		// Create query string
		var queryString = "SELECT result1.*, result2.gp"
			+ " FROM "
			+ " ( "
				+ " SELECT s.team, s.player_id, r.first, r.last, r.position, s.score_sit, s.strength_sit,"
				+ "		SUM(toi) AS toi, SUM(ig) AS ig, SUM(\"is\") AS \"is\", (SUM(\"is\") + SUM(ibs) + SUM(ims)) AS ic, SUM(ia1) AS ia1, SUM(ia2) AS ia2,"
				+ "		SUM(gf) AS gf, SUM(ga) AS ga, SUM(sf) AS sf, SUM(sa) AS sa, (SUM(sf) + SUM(bsf) + SUM(msf)) AS cf, (SUM(sa) + SUM(bsa) + SUM(msa)) AS ca,"
				+ "		SUM(cf_off) AS cf_off, SUM(ca_off) AS ca_off " 
				+ " FROM game_stats AS s"
				+ " 	LEFT JOIN game_rosters AS r"
				+ " 	ON s.player_id = r.player_id AND s.season = r.season AND s.game_id = r.game_id"
				+ " WHERE s.player_id > 2 AND r.position <> 'na' AND r.position <> 'g'"
				+ " GROUP BY s.team, s.player_id, r.first, r.last, r.position, s.score_sit, s.strength_sit"
			+ " ) AS result1"
			+ " LEFT JOIN"
			+ " ( "
				+ " SELECT player_id, COUNT(DISTINCT game_id) AS gp"
				+ " FROM game_rosters"
				+ " WHERE position != 'na'"
				+ " GROUP BY player_id"
			+ " ) AS result2"
			+ " ON result1.player_id = result2.player_id";

		// Run query
		pool.connect(function(err, client, done) {
			if (err) { return response.status(500).send("Error fetching client from pool: " + err); }
			client.query(queryString, function(err, result) {
				done(); // Return client to pool
				if (err) { return response.status(500).send("Error running query: " + err); }
				processResults(result.rows);
			});
		});

		// Process query results
		function processResults(rows) {

			// rows is an array of Anonymous objects - use stringify and parse to convert it to json
			rows = JSON.parse(JSON.stringify(rows));

			// Postgres aggregate functions like SUM return strings, so cast them as ints
			rows.forEach(function(r) {
				["gp", "toi", "ig", "is", "ic", "ia1", "ia2", "gf", "ga", "sf", "sa", "cf", "ca", "cf_off", "ca_off"].forEach(function(col) {
					r[col] = +r[col];
				});
			});

			// Calculate score-adjusted corsi for each row
			rows.forEach(function(r) {
				r["cf_adj"] = constants["cfWeights"][r["score_sit"]] * r["cf"];
				r["ca_adj"] = constants["cfWeights"][-1 * r["score_sit"]] * r["ca"];
			});

			// Group rows by playerId:
			//	{ 123: [rows for player 123], 234: [rows for player 234] }
			var groupedRows = _.groupBy(rows, "player_id");

			// Structure results as an array of objects:
			// [ { playerId: 123, data: [rows for player 123] }, { playerId: 234, data: [rows for player 234] } ]
			var result = { players: [] };
			for (var pId in groupedRows) {
				if (!groupedRows.hasOwnProperty(pId)) {
					continue;
				}

				// Get all teams and positions the player has been on
				var teams = _.uniqBy(groupedRows[pId], "teams").map(function(d) { return d.team; });
				var positions = _.uniqBy(groupedRows[pId], "teams").map(function(d) { return d.position; });

				result["players"].push({
					player_id: +pId,
					teams: teams,
					positions: positions,
					first: groupedRows[pId][0]["first"],
					last: groupedRows[pId][0]["last"],
					gp: groupedRows[pId][0]["gp"],
					data: groupedRows[pId]
				});

				// Set redundant properties in 'data' to be undefined - this removes them from the response
				// Setting the properties to undefined is ~10sec faster than deleting the properties completely
				result["players"].forEach(function(p) {
					p.data.forEach(function(r) {
						r.team = undefined;
						r.player_id = undefined;
						r.first = undefined;
						r.last = undefined;
						r.position = undefined;
						r.gp = undefined;
					});
				});
			}

			return response.status(200).send(result);
		}
	});

	//
	// Handle GET request for teams api
	//

	server.get("/api/teams/", function(request, response) {

		// Create query strings
		var statsQueryString = "SELECT result1.*, result2.gp"
			+ " FROM "
			+ " ( "
				+ " SELECT team, score_sit, strength_sit, SUM(toi) AS toi,"
				+ "		SUM(gf) AS gf, SUM(ga) AS ga, SUM(sf) AS sf, SUM(sa) AS sa, (SUM(sf) + SUM(bsf) + SUM(msf)) AS cf, (SUM(sa) + SUM(bsa) + SUM(msa)) AS ca"
				+ " FROM game_stats"
				+ " WHERE player_id < 2 "
				+ " GROUP BY team, score_sit, strength_sit"
			+ " ) AS result1"
			+ " LEFT JOIN"
			+ " ( "
				+ " SELECT team, COUNT(DISTINCT game_id) AS gp"
				+ " FROM game_rosters" 
				+ " GROUP BY team"
			+ " ) AS result2"
			+ " ON result1.team = result2.team";

		var resultsQueryString = "SELECT * FROM game_results WHERE game_id < 30000"; // Exclude playoff games from points calculation

		// Run queries
		pool.connect(function(err, client, done) {
			if (err) { returnError("Error fetching client from pool: " + err); }
			// Run 1st query
			client.query(statsQueryString, function(err, gameStats) {
				if (err) { return response.status(500).send("Error running query: " + err); }
				// Run 2nd query
				client.query(resultsQueryString, function(err, gameResults) {
					done();
					if (err) { return response.status(500).send("Error running query: " + err); }
					processResults(gameStats.rows, gameResults.rows);
				});
			});
		});

		// Process query results
		function processResults(statRows, resultRows) {

			// rows is an array of Anonymous objects - use stringify and parse to convert it to json
			statRows = JSON.parse(JSON.stringify(statRows));

			// Postgres aggregate functions like SUM return strings, so cast them as ints
			statRows.forEach(function(r) {
				["gp", "toi", "gf", "ga", "sf", "sa", "cf", "ca"].forEach(function(col) {
					r[col] = +r[col];
				});
			});

			// Calculate score-adjusted corsi for each row
			statRows.forEach(function(r) {
				r["cf_adj"] = constants["cfWeights"][r["score_sit"]] * r["cf"];
				r["ca_adj"] = constants["cfWeights"][-1 * r["score_sit"]] * r["ca"];
			});

			// Group rows by team:
			// { "edm": [rows for edm], "tor": [rows for tor] }
			var groupedRows = _.groupBy(statRows, "team");

			//
			// Calculate the number of points won
			//

			// Initialize points counter
			for (var tricode in groupedRows) {
				if (groupedRows.hasOwnProperty(tricode)) {
					groupedRows[tricode]["pts"] = 0;
				}
			}

			// Loop through game_result rows and increment points
			resultRows = JSON.parse(JSON.stringify(resultRows));
			resultRows.forEach(function(r) {
				if (r["a_final"] > r["h_final"]) {
					groupedRows[r["a_team"]].pts += 2;
					if (r["periods"] > 3) {
						groupedRows[r["h_team"]].pts += 1;
					}
				} else if (r["h_final"] > r["a_final"]) {
					groupedRows[r["h_team"]].pts += 2;
					if (r["periods"] > 3) {
						groupedRows[r["a_team"]].pts += 1;
					}
				}
			});

			// Structure results as an array of objects:
			// [ { team: "edm", data: [rows for edm] }, { team: "tor", data: [rows for tor] } ]
			var result = { teams: [] };
			for (var tricode in groupedRows) {
				if (!groupedRows.hasOwnProperty(tricode)) {
					continue;
				}
				result["teams"].push({
					team: tricode,
					pts: groupedRows[tricode]["pts"],
					gp: groupedRows[tricode][0]["gp"],
					data: groupedRows[tricode]
				});
				// Set redundant properties in 'data' to be undefined - this removes them from the response
				result["teams"].forEach(function(t) {
					t.data.forEach(function(r) {
						r.team = undefined;
						r.gp = undefined;
					});
				});
			}

			return response.status(200).send(result);
		}
	});

	// Start listening for requests
	server.listen(PORT, function(error) {
		if (error) { throw error; }
		console.log("Listening on " + PORT);
	});
}