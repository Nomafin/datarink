"use strict"

var express = require("express");
var apicache = require("apicache");
var _ = require("lodash");
var constants = require("../helpers/analysis-constants.json");
var db = require("../helpers/db");
var ah = require("../helpers/analysis-helpers");

var router = express.Router();
var cache = apicache.middleware;

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

//
// Handle GET request for players list
//

router.get("/", cache("24 hours"), function(request, response) {
	var season = 2016;
	db.query(skaterStatQueryString, [season], function(err, rows) {
		if (err) { return response.status(500).send("Error running query: " + err); }
		var result = { players: ah.structureSkaterStatRows(rows) };
		response.status(200).send(result);
	});
});

//
// Handle GET request for player breakpoints
//

router.get("/breakpoints", cache("24 hours"), function(request, response) {
	var season = 2016;
	var result = { f_breakpoints: {}, d_breakpoints: {} };
	db.query(skaterStatQueryString, [season], function(err, rows) {
		if (err) { return response.status(500).send("Error running query: " + err + skaterStatQueryString); }
		getBreakpoints(rows);
	});
	function getBreakpoints(rows) {
		var players = ah.structureSkaterStatRows(rows);
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

router.get("/:id", cache("24 hours"), function(request, response) {

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
		db.query(statQuery, [season, pId], function(err, rows) {
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
		player.f_or_d = ah.isForD(positions);
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
		ah.aggregateScoreSituations([player], stats);
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
		db.query(queryStr, [season, pId], function(err, rows) {
			if (err) { return response.status(500).send("Error running query: " + err); }
			historyRows = rows;
			result.history = ah.getHistoryResults(historyRows);
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

module.exports = router;
