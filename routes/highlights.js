"use strict"

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

	queryStats("recent");
	queryStats("season");

	// This is a more complicated query than the ones used to get the team and player lists because for the "recent" query,
	// we need to get the last 10 games for each team, then get the team and player stats corresponding to those games.
	// For simplicity (and because we can cache these results), reuse the "recent" query to get the season-long dashboard stats as well
	function queryStats(mode) {
		var limit;
		if (mode === "recent") {
			limit = "LIMIT 10";
		} else if (mode === "season") {
			limit = "";
		}
		var queryStr = "SELECT stats.*, positions.first, positions.last, positions.positions, positions.game_ids"
			+ " FROM ("
			+ " SELECT s.team, s.player_id, s.strength_sit, s.score_sit,"
				+ " SUM(toi) AS toi, SUM(ig) AS ig, SUM(\"is\") AS \"is\", (SUM(\"is\") + SUM(ibs) + SUM(ims)) AS ic, SUM(ia1) AS ia1, SUM(ia2) AS ia2,"
				+ " SUM(gf) AS gf, SUM(ga) AS ga, SUM(sf) AS sf, SUM(sa) AS sa, (SUM(sf) + SUM(bsf) + SUM(msf)) AS cf, (SUM(sa) + SUM(bsa) + SUM(msa)) AS ca,"
				+ " SUM(cf_off) AS cf_off, SUM(ca_off) AS ca_off"
			+ " FROM ("
				// Get the last 10 game ids for each team, l10g
				+ " SELECT *"
				+ " FROM ("
					+ " SELECT DISTINCT(team) AS team"
					+ " FROM game_rosters"
					+ " WHERE season = $1"
				+ " ) AS t"
				+ " JOIN LATERAL ("
					+ " SELECT season, game_id"
					+ " FROM game_results"
					+ " WHERE season = $1 AND (a_team = t.team OR h_team = t.team)"
					+ " ORDER BY datetime DESC"
					+ " " + limit
				+ " ) AS gids ON true"
			+ " ) AS l10g"
			// Get all game stats rows for teams and players for each team's last 10 game ids
			+ " LEFT JOIN game_stats AS s"
			+ " ON l10g.season = s.season AND l10g.game_id = s.game_id AND l10g.team = s.team"
			+ " GROUP BY s.team, s.player_id, s.strength_sit, s.score_sit"
		+ " ) AS stats"
		+ " LEFT JOIN ("
			+ " SELECT r.team, r.player_id, r.first, r.last, string_agg(r.position, ',') as positions, string_agg(to_char(r.game_id, '99999'), ',') AS game_ids"
			+ " FROM ("
				// Get the last 10 game ids for each team, l10g
				+ " SELECT *"
				+ " FROM ("
					+ " SELECT DISTINCT(team) AS team"
					+ " FROM game_rosters"
					+ " WHERE season = $1"
				+ " ) AS t"
				+ " JOIN LATERAL ("
					+ " SELECT season, game_id"
					+ " FROM game_results"
					+ " WHERE season = $1 AND (a_team = t.team OR h_team = t.team)"
					+ " ORDER BY datetime DESC"
					+ " " + limit
				+ " ) AS gids ON true"
			+ " ) AS l10g"
			+ " LEFT JOIN ("
				// Get all the game roster rows correponding to the l10g game ids
				+ " SELECT *"
				+ " FROM game_rosters"
				+ " WHERE position != 'na' AND position != 'g'"
			+ " ) AS r"
			+ " ON l10g.season = r.season AND l10g.game_id = r.game_id AND l10g.team = r.team"
			+ " GROUP BY r.team, r.player_id, r.first, r.last"
		+ " ) AS positions"
		+ " ON stats.team = positions.team AND stats.player_id = positions.player_id";
		db.query(queryStr, [season], function(err, rows) {
			if (err) { return response.status(500).send("Error running query: " + err); }
			processRows(rows, mode);
		});
	}

	// Process stat rows from the recent and season queries
	// 'rows' are the query results
	// 'mode' values: recent, season
	function processRows(rows, mode) {

		// Cast Postgres SUMs as ints, and calculate score-adjusted corsi
		// Separate team and skater rows
		var teamRows = [];
		var skaterRows = [];
		rows.forEach(function(r) {
			["toi", "ig", "is", "ic", "ia1", "ia2", "gf", "ga", "sf", "sa", "cf", "ca", "cf_off", "ca_off"].forEach(function(col) {
				r[col] = +r[col];
			});
			r.cf_adj = constants.cfWeights[r.score_sit] * r.cf;
			r.ca_adj = constants.cfWeights[-1 * r.score_sit] * r.ca;
			if (r.player_id < 2) {
				teamRows.push(r);
			} else if (r.positions) {
				skaterRows.push(r);
			}
		});

		// Apply standard structure to skater and team rows
		var skaters = ah.structureSkaterStatRows(skaterRows);
		var teams = ah.structureTeamStatRows(teamRows);

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
			var leaders = [];
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
			// Add players to leader results until the cutoff value is passed
			var i = 0;
			var isCutoffExceeded = false;
			while (i < objects.length && !isCutoffExceeded) {
				if (objects[i].sort_val >= cutoff) {
					leaders.push(objects[i]);
				} else {
					isCutoffExceeded = true;
				}
				i++;
			}
			objects.forEach(function(p) {
				p.sort_val = undefined;
			});
			return leaders;
		}

		// Send response when recent and season results are ready
		if (result.recent && result.season) {
			return response.status(200).send(result);
		}
	}
});

module.exports = router;
