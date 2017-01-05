var express = require("express");
var _ = require("lodash");
var constants = require("../helpers/analysis-constants.json");
var db = require("../helpers/db");
var ah = require("../helpers/analysis-helpers");
var combinations = require("../helpers/combinations");

var router = express.Router();

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
	ah.aggregateScoreSituations(resultRows, stats);
	return resultRows;
}

//
// Handle GET request for teams list
//

router.get("/", function(request, response) {

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

router.get("/:tricode", function(request, response) {

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

//
// Handle GET request for a particular team's lines
//

router.get("/:tricode/lines", function(request, response) {

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
		db.query(queryStr, [season, tricode], function(err, rows) {
			if (err) { return response.status(500).send("Error running query: " + err); }
			shiftRows = rows;
			getLineResults();
		});

		// Query for the strength situations the team was in
		var queryStr = "SELECT *"
			+ " FROM game_strength_situations"
			+ " WHERE season = $1 AND team = $2";
		db.query(queryStr, [season, tricode], function(err, rows) {
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
		db.query(queryStr, [season, tricode], function(err, rows) {
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
			s.shifts = ah.getTimepointArray(s.shifts);
		});
		strSitRows.forEach(function(s) {
			s.timeranges = ah.getTimepointArray(s.timeranges);
		});

		// Get each player's f_or_d value
		var fdVals = {}; // Use player id as keys, f/d as values - will be used when increment event stats
		shiftRows.forEach(function(s) {
			var val = ah.isForD(s.positions.split(","));
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
					ah.initLine(f_or_d, combo, lines, lineResults);
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
				ah.incrementLineShotStats(lineResults, combos, ev, isHome, suffix);				
			});
		});

		// Filter lines by toi before responding
		result.lines = lineResults.filter(function(d) { return d.all.toi >= 300; });
		return response.status(200).send(result);
	}
});

module.exports = router;