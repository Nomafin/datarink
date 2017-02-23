"use strict"

//
// analysis-helpers.js contains common functions for formatting and analyzing datarink query results
//

var _ = require("lodash");
var constants = require("./analysis-constants.json");

var exports = {};

// Each team, player, or game object originally has a data property that contains an array of results, aggregated by strength and score situations:
//		data: [ {score_sit: 0, strength_sit: 'pp', cf: 10, ... }, {score_sit: 0, strength_sit: 'sh', cf: 5, ... } ]
// aggregateScoreSituations() will create a new property 'stats' that aggregates the original data by score situation, and uses the strength situation as keys
//		stats: { pp: { cf: 20, ... }, sh: { cf: 10, ... } }
// 'list' is an array of objects (teams or players)
// 'stats' is an array of property names to be summed
exports.aggregateScoreSituations = function(list, stats) {

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
};

// 'historyRows' is an array of game_stats rows for particular player or team (joined with game_results)
// The output 'historyResults' is ready to be returned in the api response
exports.getHistoryResults = function(historyRows) {

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
	exports.aggregateScoreSituations(historyResults, stats);
	return historyResults;
};

// Get the most-played position (f or d) from an array of positions [l,l,c,c,c]
exports.isForD = function(positions) {
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
};

//
// Structure query results for skater stats
//

exports.structureSkaterStatRows = function(rows) {
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
			f_or_d: exports.isForD(positions),
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
	exports.aggregateScoreSituations(resultRows, stats);
	return resultRows;
};

//
// Structure query results for team stats
//

exports.structureTeamStatRows = function(rows) {
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
	exports.aggregateScoreSituations(resultRows, stats);
	return resultRows;
};

module.exports = exports;

