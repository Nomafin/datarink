var express = require("express");
var apicache = require("apicache");
var _ = require("lodash");
var constants = require("../helpers/analysis-constants.json");
var db = require("../helpers/db");
var ah = require("../helpers/analysis-helpers");

var router = express.Router();
var cache = apicache.middleware;

//
// Handle GET request for highlights
//

router.get("/", cache("24 hours"), function(request, response) {

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
		db.query(queryStr, [season], function(err, rows) {
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
		db.query(queryStr, [season], function(err, rows) {
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

		// Structure skater data as an array of objects:
		// [ { playerId: 123, data: [rows for player 123] }, { playerId: 234, data: [rows for player 234] } ]
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

		// Structure team data as an array of objects:
		// [ { team: tor, data: [rows for tor] }, { team: edm, data: [rows for edm] } ]
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
		ah.aggregateScoreSituations(skaters, stats);
		var stats = ["toi", "gf", "ga", "sf", "sa", "cf", "ca", "cf_adj", "ca_adj"];
		ah.aggregateScoreSituations(teams, stats);

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

module.exports = router;