"use strict"

var request = require("request");
var express = require("express");
var apicache = require("apicache");
var _ = require("lodash");
var constants = require("../helpers/analysis-constants.json");
var db = require("../helpers/db");
var ah = require("../helpers/analysis-helpers");
var combinations = require("../helpers/combinations");

var router = express.Router();
var cache = apicache.middleware;

// arr0 and arr1 are arrays of timeranges: [[start, end], [start, end]]
// Return an array of overlapping timeranges: [[start, end], [start, end]]
function getRangeOverlaps(arr0, arr1) {
	var overlaps = [];
	for (var i = 0; i < arr0.length; i++) {
		for (var j = 0; j < arr1.length; j++) {
			var start = Math.max(arr0[i][0], arr1[j][0]);
			var end = Math.min(arr0[i][1], arr1[j][1]);
			if (start < end) {
				overlaps.push([start, end]);
			}
		}
	}
	return overlaps;
}

//
// Handle GET requests for all teams' lines
//

/*
router.get("/all", cache("24 hours"), function(req, res) {

	// Call the lines api for each team and store the results
	var teamResults = [];
	var linesRoute;
	if (process.env.NODE_ENV === "development") {
		linesRoute = req.protocol + "://" + req.get("host") + "/api/lines/";
	} else {
		linesRoute = "http://www.datarink.com/api/lines/";
	}
	var teams = ["car", "cbj", "njd", "nyi", "nyr", "phi",
		"pit", "wsh", "bos", "buf", "det", "fla",
		"mtl", "ott", "tbl", "tor", "chi", "col",
		"dal", "min", "nsh", "stl", "wpg", "ana",
		"ari", "cgy", "edm", "lak", "sjs", "van"];
	teams.forEach(function(team) {
		var reqUrl = linesRoute + team;
		request(reqUrl, function (error, lineResponse, body) {
			teamResults.push(JSON.parse(body));
			formatResult();
		});
	});

	// Combine all team's lines into a flat array of line objects
	function formatResult() {
		if (teamResults.length === teams.length) {
			var result = [];
			teamResults.forEach(function(team) {
				result = result.concat(team.lines);
			});
			res.status(200).send({ lines: result.filter(function(d) { return d.all.toi >= 1200 || d.sh.toi >= 1200; }) });
		}
	}
});
*/

//
// Handle GET requests for a particular player's linemates, or a particular team's lines
// Specify a player using a player id 8471675; specify a team using a tricode 'tor'
//

router.get("/:id", cache("24 hours"), function(request, response) {

	var season = 2016;
	var minToi = 600; 			// Minimum toi in seconds
	var scope;					// 'team' or 'player'
	var id = request.params.id;	// the team tricode or player id
	if (id.length === 7) {
		scope = "player";
		id = +id;
	} else if (id.length === 3) {
		scope = "team";
		id = id.toLowerCase();
	} else {
		return response.status(200).send("Invalid id");
	}

	var shiftRows;
	var eventRows;
	var strSitRows;

	//
	// Query for shift rows
	//

	var shiftQueryStr;
	if (scope === "player") {
		// Query for shifts belonging to the player and his teammates
		// 'p' contains all of the specified player's game_rosters rows (i.e., all games they played in, regardless of team)
		// 'sh' contains all player shifts, including player names and all of a player's positions
		// 		('r' used string_agg to combine all of a player's positions)
		// Join 'p' with 'sh' to get all shifts belonging to the specified player and his teammates
		shiftQueryStr = "SELECT sh.*"
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
	} else if (scope === "team") {
		// Query for shifts belonging to the team's players
		shiftQueryStr = "SELECT s.game_id, s.team, s.player_id, s.period, s.shifts, r.\"first\", r.\"last\", r.\"positions\""
			+ " FROM game_shifts AS s"
			+ " INNER JOIN ("
				+ " SELECT player_id, \"first\", \"last\", string_agg(position, ',') as positions"
				+ " FROM game_rosters"
				+ " WHERE position != 'na' AND position != 'g' AND season = $1 AND team = $2"
				+ " GROUP BY player_id, \"first\", \"last\""
			+ " ) AS r"
			+ " ON s.player_id = r.player_id"
			+ " WHERE s.season = $1 AND s.team = $2";
	}
	db.query(shiftQueryStr, [season, id], function(err, rows) {
		if (err) { return response.status(500).send("Error running query: " + err); }
		shiftRows = rows;
		getLineResults();
	});

	//
	// Query for strength situation rows
	//

	var sitQueryStr;
	if (scope === "player") {
		sitQueryStr = "SELECT s.*"
			+ " FROM game_rosters AS p"
			+ " LEFT JOIN game_strength_situations AS s"
			+ " ON p.season = s.season AND p.game_id = s.game_id AND p.team = s.team"
			+ " WHERE p.season = $1 AND p.\"position\" != 'na' AND p.player_id = $2";
	} else if (scope === "team") {
		sitQueryStr = "SELECT *"
			+ " FROM game_strength_situations"
			+ " WHERE season = $1 AND team = $2";
	}
	db.query(sitQueryStr, [season, id], function(err, rows) {
		if (err) { return response.status(500).send("Error running query: " + err); }
		strSitRows = rows;
		getLineResults();
	});

	//
	// Query for event rows
	//

	var eventQueryStr;
	if (scope === "player") {
		// Query for all events that occurred in games the player was in
		// 'p' contains all of the specified player's game_rosters row (i.e., all games they played in, regardless of team)
		// Join the game ids in 'p' with the game ids in 'e' to get all of those games' events
		eventQueryStr = "SELECT e.*, p.team AS p_team"
			+ " FROM game_rosters AS p"
			+ " LEFT JOIN game_events AS e"
			+ " ON p.season = e.season AND p.game_id = e.game_id"
			+ " WHERE (e.type = 'goal' OR e.type = 'shot' OR e.type = 'missed_shot' OR e.type = 'blocked_shot')"
				+ " AND p.season = $1 AND p.player_id = $2";
	} else if (scope === "team") {
		eventQueryStr = "SELECT e.*"
			+ " FROM game_events AS e"
			+ " LEFT JOIN game_results AS r"
			+ " ON e.season = r.season AND e.game_id = r.game_id"
			+ " WHERE (e.type = 'goal' OR e.type = 'shot' OR e.type = 'missed_shot' OR e.type = 'blocked_shot')"
				+ " AND e.season = $1 AND (r.a_team = $2 OR r.h_team = $2)";
	}
	db.query(eventQueryStr, [season, id], function(err, rows) {
		if (err) { return response.status(500).send("Error running query: " + err); }
		eventRows = rows;
		getLineResults();
	});

	//
	// Calculate line stats
	//

	function getLineResults() {

		if (!shiftRows || !strSitRows || !eventRows) {
			return;
		}

		var lineResults = {};

		// Take raw timerange strings: 'start-end;start-end;...'
		// and return an array of pairs: [[start, end], [start, end]]
		function rangeStringToArray(rangeString) {
			return rangeString.split(";")
				.map(function(tmRange) {
					return tmRange.split("-")
						.map(function(tmPt) { return +tmPt; });
				});
		}
		shiftRows.forEach(function(row) {
			row.shifts = rangeStringToArray(row.shifts);
		});
		strSitRows.forEach(function(row) {
			row.timeranges = rangeStringToArray(row.timeranges);
		});

		// Store the f_or_d value for each player id
		var fdVals = {};
		shiftRows.forEach(function(s) {
			var val = ah.isForD(s.positions.split(","));
			s.f_or_d = val;
			fdVals[s.player_id] = val;
		});

		// Store all forward lines or defender lines that have been generated for a particular roster
		// key: a string of comma-delimited player ids (all forwards or defenders that played in a particular game)
		// value: an array of lines, where each line is an array of player ids
		var rosterLines = {};
		var rosterShLines = {};

		//
		// Increment lines' toi, one game at a time
		//

		var gIds = _.uniqBy(shiftRows, "game_id").map(function(d) { return d.game_id; });
		gIds.forEach(function(gId) {

			// Store shifts and period numbers for current game
			var gmShifts = shiftRows.filter(function(d) { return d.game_id === gId; });
			var prds = _.uniqBy(gmShifts, "period").map(function(d) { return d.period; });

			// Loop through forward and/or defense
			(scope === "team" ? ["f", "d"] : [fdVals[id]]).forEach(function(fd) {

				// Get roster and corresponding shifts
				var posShifts = gmShifts.filter(function(d) { return d.f_or_d === fd; });
				var roster = _.uniqBy(posShifts, "player_id");

				// Generate lines for this roster if we haven't done so previously
				// Create id for the roster by sorting the array of player ids and converting to a string
				var rosterId = roster.map(function(d) { return d.player_id; })
					.sort(function(a, b) { return a - b; })
					.toString();
				if (!rosterLines.hasOwnProperty(rosterId)) {

					// Create array in rosterLines to store 3f lines and 2d lines
					// Create array in rosterShLines to store 2f lines
					rosterLines[rosterId] = [];
					if (fd === "f") {
						rosterShLines[rosterId] = [];
					}

					// For forwards, generate 2 and 3 player lines. For defenders, generate 2 player lines
					var lineSizes = fd === "f" ? [3, 2] : [2];
					lineSizes.forEach(function(lineSize) {

						// Generate and loop through combinations of players
						combinations.k_combinations(roster, lineSize).forEach(function(line) {

							// 'line' is an array of player objects
							// Sort players by ascending id and store the line as an array of player ids
							line = line.sort(function(a, b) { return a.player_id - b.player_id; });
							if (fd === "f" && lineSize === 2) {
								rosterShLines[rosterId].push(line.map(function(d) { return d.player_id; }));
							} else {
								rosterLines[rosterId].push(line.map(function(d) { return d.player_id; }));
							}

							// For new lines, create an object to store results
							var lineId = line.map(function(d) { return d.player_id; }).toString();
							if (!lineResults.hasOwnProperty(lineId)) {
								lineResults[lineId] = {
									player_ids: line.map(function(d) { return d.player_id; }),
									firsts: line.map(function(d) { return d.first; }),
									lasts: line.map(function(d) { return d.last; }),
									f_or_d: line[0].f_or_d,
									team: line[0].team,
									all: { toi: 0, cf: 0, ca: 0, cf_adj: 0, ca_adj: 0, gf: 0, ga: 0 },
									ev5: { toi: 0, cf: 0, ca: 0, cf_adj: 0, ca_adj: 0, gf: 0, ga: 0 },
									pp:  { toi: 0, cf: 0, ca: 0, cf_adj: 0, ca_adj: 0, gf: 0, ga: 0 },
									sh:  { toi: 0, cf: 0, ca: 0, cf_adj: 0, ca_adj: 0, gf: 0, ga: 0 }
								}
							}
						});
					});
				}

				// Loop through each line and increment its toi
				// For forwards, loop through 3f and 2f lines
				var toLoop = fd === "f" ? [rosterLines[rosterId], rosterShLines[rosterId]] : [rosterLines[rosterId]];
				toLoop.forEach(function(lines) {
					lines.forEach(function(l) {

						// Get reference to the line's result object, and flag if it's a sh forward line
						var line = lineResults[l.toString()];
						var isShFwd = !!(line.f_or_d === "f" && line.player_ids.length === 2);

						// Loop through each period of the current game
						prds.forEach(function(prd) {

							// Get overlap of linemates' shifts
							var mateOverlaps = [];
							var linemateShifts = posShifts.filter(function(d) {
									return l.indexOf(d.player_id) >= 0 && d.period === prd;
								});
							if (!isShFwd && fd === "f" && linemateShifts.length === 3) {
								mateOverlaps = getRangeOverlaps(linemateShifts[2].shifts,
										getRangeOverlaps(linemateShifts[0].shifts, linemateShifts[1].shifts)
									);
							} else if ((isShFwd || fd === "d") && linemateShifts.length === 2) {
								mateOverlaps = getRangeOverlaps(linemateShifts[0].shifts, linemateShifts[1].shifts);
							}

							// Increment toi for all situations play
							if (!isShFwd) {
								mateOverlaps.forEach(function(timerange) {
									line.all.toi += timerange[1] - timerange[0];
								});
							}

							// Increment toi for ev5, sh, and pp play
							// For sh forward lines, only increment sh toi
							if (mateOverlaps.length === 0) {
								return;
							}
							var prdSitRows = strSitRows.filter(function(d) { return d.game_id === gId && d.period === prd; });
							if (isShFwd) {
								prdSitRows = prdSitRows.filter(function(d) { return d.strength_sit === "sh"; });
							}
							prdSitRows.forEach(function(sr) {
								getRangeOverlaps(sr.timeranges, mateOverlaps).forEach(function(timerange) {
									line[sr.strength_sit].toi += timerange[1] - timerange[0];
								});
							});
						}); // End of period loop
					}); // End of lines loop
				}); // End of rosterLines/rosterShLines loop
			}); // End of f/d loop
		}); // End of game id loop

		//
		// Increment lines' event stats
		//

		eventRows.forEach(function(ev) {

			// Convert the database home/away skater columns into arrays, removing null values
			ev["a_sIds"] = [ev.a_s1, ev.a_s2, ev.a_s3, ev.a_s4, ev.a_s5, ev.a_s6].filter(function(d) { return d; });
			ev["h_sIds"] = [ev.h_s1, ev.h_s2, ev.h_s3, ev.h_s4, ev.h_s5, ev.h_s6].filter(function(d) { return d; });

			// Get isHome: true/false to indicate if the player or team was at home
			// Get suffix: 'f'/'a' to indicate if the event was for/against the team or player
			var isHome;
			var suffix;
			if (scope === "team") {
				suffix = ev.team === id ? "f" : "a";
				if (ev.venue === "home") {
					isHome = ev.team === id ? true : false;
				} else if (ev.venue === "away") {
					isHome = ev.team === id ? false : true;
				}
			} else if (scope === "player") {
				suffix = ev.team === ev.p_team ? "f" : "a";
				if (ev.venue === "home") {
					isHome = ev.team === ev.p_team ? true : false;
				} else if (ev.venue === "away") {
					isHome = ev.team === ev.p_team ? false : true;
				}
			}

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

			// Get the score adjustment factor for the line
			var scoreSit = isHome ?
				Math.max(-3, Math.min(3, ev.h_score - ev.a_score)) :
				Math.max(-3, Math.min(3, ev.a_score - ev.h_score));

			// Generate lines for which to increment stats
			// Each entry in 'linesToUpdate' is an array of player ids
			var linesToUpdate = [];
			var skaters = isHome ? ev["h_sIds"] : ev["a_sIds"];
			if (scope === "team") {
				var fwds = skaters.filter(function(sid) { return fdVals[sid] === "f"; });
				var defs = skaters.filter(function(sid) { return fdVals[sid] === "d"; });
				linesToUpdate = combinations.k_combinations(fwds, 3)
					.concat(
						combinations.k_combinations(fwds, 2),
						combinations.k_combinations(defs, 2)
					);
			} else if (scope === "player") {
				// Get skaters with the same fd value as the specified player
				// For forwards, generate 2f lines for sh situations
				skaters = skaters.filter(function(sid) { return fdVals[sid] === fdVals[id]; });
				linesToUpdate = combinations.k_combinations(skaters, 2);
				if (fdVals[id] === "f") {
					linesToUpdate = linesToUpdate.concat(combinations.k_combinations(skaters, 3));
				}
			}

			// Increment stats for the generated lines
			linesToUpdate.forEach(function(l) {

				// Get line object to update
				var lineId = l.sort(function(a, b) { return a - b; }).toString();
				if (!lineResults.hasOwnProperty(lineId)) {
					return;
				}
				var line = lineResults[lineId];

				// Get strength situations to update
				// For sh 2f lines, only update sh stats
				var strSitsToUpdate = [];
				if (line.f_or_d === "f" && line.player_ids.length === 2) {
					if (strSit === "sh") {
						strSitsToUpdate = ["sh"];
					}
				} else {
					strSitsToUpdate = strSit ? ["all", strSit] : ["all"];
				}

				// Increment stats for each situation
				strSitsToUpdate.forEach(function(strSit) {
					line[strSit]["c" + suffix]++;
					if (suffix === "f") {
						line[strSit]["cf_adj"] += constants.cfWeights[scoreSit];
					} else if (suffix === "a") {
						line[strSit]["ca_adj"] += constants.cfWeights[-scoreSit];
					}
					if (ev.type === "goal") {
						line[strSit]["g" + suffix]++;
					}
				});
			}); // End of line loop
		}); // End of event loop

		//
		// Convert the lineResults associative array into an array of line objects
		//

		var associativeResults = lineResults;
		lineResults = [];
		Object.keys(associativeResults).forEach(function(lineKey) {
			lineResults.push(associativeResults[lineKey]);
		});

		//
		// For a specified team, return results
		//

		if (scope === "team") {
			return response.status(200).send({
				lines: lineResults.filter(function(d) { return d.all.toi >= minToi || d.sh.toi >= minToi; })
			});
		}

		//
		// For a specified player, return only lines they played on
		//

		var playerLineResults = [];
		lineResults.forEach(function(l) {
			var idxToRemove = l.player_ids.indexOf(id);
			// Filter out lines that don't contain the specified player
			if (idxToRemove < 0) {
				return;
			}
			// Remove the specified player's properties from the response
			playerLineResults.push({
				player_ids: l.player_ids.filter(function(d, i) { return i !== idxToRemove; }),
				firsts: l.firsts.filter(function(d, i) { return i !== idxToRemove; }),
				lasts: l.lasts.filter(function(d, i) { return i !== idxToRemove; }),
				all: l.all,
				ev5: l.ev5,
				pp: l.pp,
				sh: l.sh
			});
		});

		//
		// For a specified player, calculate wowy stats
		//

		var wowyResults = [];

		// Create objects to store wowy stats for each partner
		_.uniqBy(shiftRows, "player_id").forEach(function(d) {

			if (d.player_id === id) {
				return;
			}
			var wowyObj = {
				player_id: d.player_id,
				first: d.first,
				last: d.last
			};

			// Initialize counters for wowy stats
			["together", "self_only", "mate_only"].forEach(function(context) {
				wowyObj[context] = {};
				["all", "ev5", "pp", "sh"].forEach(function(sit) {
					wowyObj[context][sit] = { toi: 0, cf: 0, ca: 0, cf_adj: 0, ca_adj: 0, gf: 0, ga: 0 };
				});
			});

			wowyResults.push(wowyObj);
		});

		// Calculate wowy stats for each partner
		wowyResults.forEach(function(wowy) {
			lineResults.forEach(function(l) {

				// Determine wowy context
				// Flag whether the line contains the specified player and/or wowy partner
				var hasSelf = l.player_ids.indexOf(id) >= 0 ? true: false;
				var hasMate = l.player_ids.indexOf(wowy.player_id) >= 0 ? true: false;
				var context;
				if (hasSelf && hasMate) {
					context = "together";
				} else if (hasSelf && !hasMate) {
					context = "self_only";
				} else if (!hasSelf && hasMate) {
					context = "mate_only";
				} else {
					return;
				}

				// Increment stats for the context
				["all", "ev5", "pp", "sh"].forEach(function(sit) {
					wowy[context][sit].toi += l[sit].toi;
					wowy[context][sit].cf += l[sit].cf;
					wowy[context][sit].ca += l[sit].ca;
					wowy[context][sit].cf_adj += l[sit].cf_adj;
					wowy[context][sit].ca_adj += l[sit].ca_adj;
					wowy[context][sit].gf += l[sit].gf;
					wowy[context][sit].ga += l[sit].ga;
				});
			});
		});

		// For a specified player, return results
		return response.status(200).send({
			lines: playerLineResults.filter(function(d) { return d.all.toi >= minToi || d.sh.toi >= minToi; }),
			wowy: wowyResults
		});
	} // End of getLineResults()
});

module.exports = router;
