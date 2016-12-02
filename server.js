"use strict"

var constants = require("./server-constants.json");
var mysql = require("mysql");
var _ = require("lodash");

// Define mysql connection
var connection = mysql.createConnection({
	host: process.env.DB_HOST,
	user: process.env.DB_USER,
	password: process.env.DB_PASS,
	database: process.env.DB
});

// Create an Express server
var express = require("express");
var server = express();

// Serve static files, including the Vue application in public/index.html
server.use(express.static("public"));
server.use(express.static("node_modules/vue/dist"));
server.use(express.static("node_modules/vue-router/dist"));
server.use(express.static("node_modules/lodash"));

// Handle GET request for players api
server.get("/api/players/", function(request, response) {

	var queryString = "SELECT s.team, s.playerId, first, last, position, scoreSit, strengthSit,"
		+ "		SUM(toi) AS toi, SUM(ig) AS ig, SUM(`is`) AS `is`, (SUM(`is`) + SUM(ibs) + SUM(ims)) AS ic, SUM(ia1) AS ia1, SUM(ia2) AS ia2,"
		+ "		SUM(gf) AS gf, SUM(ga) AS ga, SUM(sf) AS sf, SUM(sa) AS sa, (SUM(sf) + SUM(bsf) + SUM(msf)) AS cf, (SUM(sa) + SUM(bsa) + SUM(msa)) AS ca,"
		+ "		SUM(cfOff) AS cfOff, SUM(caOff) AS caOff " 
		+ " FROM game_stats AS s"
		+ " 	LEFT JOIN game_rosters AS r"
		+ " 	ON s.playerId = r.playerId AND s.season = r.season AND s.gameId = r.gameId"
		+ " WHERE s.playerId > 0 AND r.position <> 'na' AND r.position <> 'g'"
		+ " GROUP BY playerId, scoreSit, strengthSit";
	// queryString += "AND s.team=" + connection.escape(request.params.team);

	connection.query(queryString, function(error, rows, fields) {

		if (error) {
			connection.end();
			return response
				.status(500)
				.send(error);
		}

		// rows is an array of RowDataPacket objects - use stringify then parse to convert it to json
		rows = JSON.parse(JSON.stringify(rows));

		// Calculate score-adjusted corsi for each row
		rows.forEach(function(r) {
			r["cfAdj"] = constants["cfWeights"][r["scoreSit"]] * r["cf"];
			r["caAdj"] = constants["cfWeights"][-1 * r["scoreSit"]] * r["ca"];
		});

		// Group rows by playerId:
		//	{ 123: [rows for player 123], 234: [rows for player 234] }
		var groupedRows = _.groupBy(rows, "playerId");

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
				playerId: +pId,
				teams: teams,
				positions: positions,
				first: groupedRows[pId][0]["first"],
				last: groupedRows[pId][0]["last"],
				data: groupedRows[pId]
			});
		}

		return response
			.status(200)
			.send(result);
	});
});

// Handle GET request for teams api
server.get("/api/teams/", function(request, response) {

	var queryString = "SELECT s.team, scoreSit, strengthSit, SUM(toi) AS toi,"
		+ "		SUM(gf) AS gf, SUM(ga) AS ga, SUM(sf) AS sf, SUM(sa) AS sa, (SUM(sf) + SUM(bsf) + SUM(msf)) AS cf, (SUM(sa) + SUM(bsa) + SUM(msa)) AS ca"
		+ " FROM game_stats AS s"
		+ " WHERE s.playerId = 0 "
		+ " GROUP BY team, scoreSit, strengthSit";
	
	connection.query(queryString, function(error, rows, fields) {

		if (error) {
			connection.end();
			return response
				.status(500)
				.send(error);
		}

		// rows is an array of RowDataPacket objects - use stringify then parse to convert it to json
		rows = JSON.parse(JSON.stringify(rows));

		// Calculate score-adjusted corsi for each row
		rows.forEach(function(r) {
			r["cfAdj"] = constants["cfWeights"][r["scoreSit"]] * r["cf"];
			r["caAdj"] = constants["cfWeights"][-1 * r["scoreSit"]] * r["ca"];
		});

		// Group rows by team:
		// { "edm": [rows for edm], "tor": [rows for tor] }
		var groupedRows = _.groupBy(rows, "team");

		// Structure results as an array of objects:
		// [ { team: "edm", data: [rows for edm] }, { team: "tor", data: [rows for tor] } ]
		var result = { teams: [] };
		for (var tricode in groupedRows) {
			if (!groupedRows.hasOwnProperty(tricode)) {
				continue;
			}
			result["teams"].push({
				team: tricode,
				data: groupedRows[tricode]
			});
		}

		return response
			.status(200)
			.send(result);
	});
});

// Listen on port 5000
server.listen(process.env.PORT || 5000, function(error) {
	if (error) { throw error; }
	console.log("Server is running at localhost:5000");
});