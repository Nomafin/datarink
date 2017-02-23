"use strict"

var express = require("express");
var apicache = require("apicache");
var _ = require("lodash");
var constants = require("../helpers/analysis-constants.json");
var db = require("../helpers/db");
var ah = require("../helpers/analysis-helpers");

var router = express.Router();
var cache = apicache.middleware;

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
// Handle GET request for teams list
//

router.get("/", cache("24 hours"), function(request, response) {

	var season = 2016;

	// Query for stats by game
	var statRows;
	db.query(teamStatQueryString, [season], function(err, rows) {
		if (err) { return response.status(500).send("Error running query: " + err); }
		statRows = rows;
		processResults();
	});

	// Query for game results to calculate points - exclude playoff games
	var resultRows;
	var resultQueryString = "SELECT *"
		+ " FROM game_results"
		+ " WHERE game_id < 30000 AND season = $1";
	db.query(resultQueryString, [season], function(err, rows) {
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
		var teamStats = ah.structureTeamStatRows(statRows);
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

router.get("/:tricode", cache("24 hours"), function(request, response) {

	var tricode = request.params.tricode;
	var season = 2016;
	var result = {};

	//
	// Calculate breakpoints
	//

	db.query(teamStatQueryString, [season], function(err, rows) {
		if (err) { return response.status(500).send("Error running query: " + err); }
		getBreakpoints(rows);
	});

	function getBreakpoints(rows) {
		var teams = ah.structureTeamStatRows(rows);
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

	db.query(queryStr, [season, tricode], function(err, rows) {
		if (err) { return response.status(500).send("Error running query: " + err); }
		result.history = ah.getHistoryResults(rows);
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

module.exports = router;
