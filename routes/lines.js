"use strict"

var express = require("express");
var _ = require("lodash");
var constants = require("../helpers/analysis-constants.json");
var db = require("../helpers/db");
var ah = require("../helpers/analysis-helpers");
var combinations = require("../helpers/combinations");

var router = express.Router();

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
};

// 'f_or_d' is 'f' or 'd'
// 'players' is an array of player objects: [ { player_id: ... }, { player_id: ... }] - contains player properties used to generate lines
// 'lines' is an array of player id arrays: [ [111, 222, 333], [222, 333, 444] ] - we'll loop through these lines and increment the stats
// 'lineResults' is an array of line objects that will be send in the api response
// 'lineTeam' is the tricode of the line's team
function initLine(f_or_d, players, lines, lineResults, lineTeam) {
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
			team: lineTeam,
			all: { toi: 0, cf: 0, ca: 0, cf_adj: 0, ca_adj: 0, gf: 0, ga: 0 },
			ev5: { toi: 0, cf: 0, ca: 0, cf_adj: 0, ca_adj: 0, gf: 0, ga: 0 },
			pp:  { toi: 0, cf: 0, ca: 0, cf_adj: 0, ca_adj: 0, gf: 0, ga: 0 },
			sh:  { toi: 0, cf: 0, ca: 0, cf_adj: 0, ca_adj: 0, gf: 0, ga: 0 }
		});
	}
};

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
};

//
// Handle GET requests for a particular player's linemates, or a particular team's lines
// Specify a player using a player id 8471675; specify a team using a tricode 'tor'
//

router.get("/:id", function(request, response) {

	var season = 2016;
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
		// 'sh' contains all player shifts, including player names and all of a player's positions ('r' used string_agg to combine all of a player's positions)
		// Join 'p' with 'sh' to get all shifts belonging to the specified player and his teammates
		// Also use this to get all positions the player has played
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

		var lineResults = [];

		// Convert the raw timerange data in shiftRows and strSitRows into an array of timepoints
		shiftRows.forEach(function(s) {
			s.shifts = getTimepointArray(s.shifts);
		});
		strSitRows.forEach(function(s) {
			s.timeranges = getTimepointArray(s.timeranges);
		});

		// Get each player's f_or_d value and store it in fdVals
		// Use player id as keys, f/d as values - will be used when incrementing stats
		var fdVals = {}; 
		shiftRows.forEach(function(s) {
			var val = ah.isForD(s.positions.split(","));
			s.f_or_d = val;
			fdVals[s.player_id] = val;
		});

		// Determine if we need to get results for forward lines, defense lines, or both
		var fdToLoop;
		if (scope === "team") {
			fdToLoop = ["f", "d"];
		} else {
			fdToLoop = [fdVals[id]];
		}

		//
		// Loop through each game and period and calculate line toi
		//

		// Store all f/d combinations that have been generated for a particular *roster*
		// 		key: roster player ids in ascending order: 123,234,345,... - the key will contain *all* f/d players in a roster
		// 		value: all generated combinations for those player ids
		var generatedShiftCombos = {};

		// Similar to generatedShiftCombos, but the combos are generated for the on-ice skaters of an event
		// 		as a result, 'key' will be shorter than in generatedShiftCombos
		var generatedEvCombos = {};

		var gIds = _.uniqBy(shiftRows, "game_id").map(function(d) { return d.game_id; });
		gIds.forEach(function(gId) {

			var gShiftRows = shiftRows.filter(function(d) { return d.game_id === gId; });

			// Loop through forward and/or defense lines
			fdToLoop.forEach(function(fd) {

				// Generate combinations
				// Each entry in 'combos' is an array of player objects
				var posShiftRows = gShiftRows.filter(function(d) { return d.f_or_d === fd; });
				var uniqLinemates = _.uniqBy(posShiftRows, "player_id");

				var lineKey = uniqLinemates.map(function(d) { return d.player_id; });
				lineKey = lineKey.sort(function(a, b) { return a - b; });
				lineKey = lineKey.toString();

				var lines = [];

				if (generatedShiftCombos.hasOwnProperty(lineKey)) {
					lines = generatedShiftCombos[lineKey];
				} else {
					var numLinemates = fd === "f" ? 3 : 2;
					var combos = combinations.k_combinations(uniqLinemates, numLinemates);
					var lineTeam = gShiftRows[0].team;
					combos.forEach(function(combo) {
						initLine(fd, combo, lines, lineResults, lineTeam);
					});
					generatedShiftCombos[lineKey] = lines;
				}

				// Get period numbers in the current game
				var prds = _.uniqBy(gShiftRows, "period").map(function(d) { return d.period; });

				// Loop through each line and increment its toi for each period in the current game
				lines.forEach(function(l) {
					var lineObj = lineResults.find(function(d) { return d.player_ids.toString() === l.toString(); });

					prds.forEach(function(prd) {

						// Get intersecting timepoints for all players
						// Ensure we have the expected number of linemate rows before populating playerIntersection
						var playerIntersection;
						var linemateRows = gShiftRows.filter(function(d) { return l.indexOf(d.player_id) >= 0 && d.period === prd; });
						if (fd === "f" && linemateRows.length === 3) {
							playerIntersection = _.intersection(linemateRows[0].shifts, linemateRows[1].shifts, linemateRows[2].shifts);
						} else if (fd === "d" && linemateRows.length === 2) {
							playerIntersection = _.intersection(linemateRows[0].shifts, linemateRows[1].shifts);
						}

						// Increment toi for all situations and ev5/sh/pp
						if (playerIntersection) {
							lineObj.all.toi += playerIntersection.length;
							var prdSsRows = strSitRows.filter(function(d) { return d.game_id === gId && d.period === prd; });
							prdSsRows.forEach(function(sr) {
								lineObj[sr.strength_sit].toi += _.intersection(playerIntersection, sr.timeranges).length;
							});
						}
					});
				});
			}); // End of f/d loop
		}); // End of game id loop

		//
		// Append event stats to lineResults
		//

		eventRows.forEach(function(ev) {

			// Combine the database home/away skater columns into an array, removing null values
			ev["a_sIds"] = [ev.a_s1, ev.a_s2, ev.a_s3, ev.a_s4, ev.a_s5, ev.a_s6].filter(function(d) { return d; });
			ev["h_sIds"] = [ev.h_s1, ev.h_s2, ev.h_s3, ev.h_s4, ev.h_s5, ev.h_s6].filter(function(d) { return d; });

			// Get isHome: true or false to indicate if the player or team was at home
			// Get suffix: 'f' or 'a' to indicate if the event was for/against the team or player
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

			// Generate combinations and increment their stats
			var skaters = isHome ? ev["h_sIds"] : ev["a_sIds"];
			if (scope === "team") {
				// Get the forwards and defense for which to increment stats	
				var fwds = skaters.filter(function(sid) { return fdVals[sid] === "f"; });
				var defs = skaters.filter(function(sid) { return fdVals[sid] === "d"; });
				// Get combinations of linemates for which to increment stats
				// This handles events with more than 2 defense or more than 3 forwards on the ice
				["f", "d"].forEach(function(fd) {
					// Generate key to check if we've already generated combinations for the combination of players
					var key = fd === "f" ? fwds : defs;
					key = key.sort(function(a, b) { return a - b; });
					key = key.toString();
					// Reuse or generate combos
					var combos;
					if (generatedEvCombos.hasOwnProperty(key)) {
						combos = generatedEvCombos[key];
					} else {
						combos = fd === "f" ? combinations.k_combinations(fwds, 3) : combinations.k_combinations(defs, 2);
						generatedEvCombos[key] = combos;
					}
					incrementLineShotStats(lineResults, combos, ev, isHome, suffix);				
				});			
				
			} else if (scope === "player") {
				// Get the skaters for which to increment stats (same f/d value)
				skaters = skaters.filter(function(sid) { return fdVals[sid] === fdVals[id]; });
				// Generate key to check if we've already generated combinations for the combination of players
				var key = skaters.sort(function(a, b) { return a - b; });
				key = key.toString();
				// Reuse or generate combos combinations of linemates for which to increment stats
				// This handles events with more than 2 defense or more than 3 forwards on the ice
				var combos;
				if (generatedEvCombos.hasOwnProperty(key)) {
					combos = generatedEvCombos[key];
				} else {
					var numLinemates = fdVals[id] === "d" ? 2 : 3;
					combos = combinations.k_combinations(skaters, numLinemates);
					generatedEvCombos[key] = combos;
				}
				incrementLineShotStats(lineResults, combos, ev, isHome, suffix);
			}
		}); // End of events loop

		//
		// For a specified team, no further analysis is needed
		// Filter lines by toi before returning results
		//

		if (scope === "team") {
			return response.status(200).send({
				lines: lineResults.filter(function(d) { return d.all.toi >= 300; })
			});
		}

		//
		// For a specified player, return only lines they played on
		// Before returning the line results, filter by toi and remove the specified player's id and name
		// Create new objects 'obj' to store the player's line results because
		// 		we need the original line result objects (that contain the full list of player ids) to calculate wowy stats
		//

		var playerLineResults = [];
		lineResults.forEach(function(l) {
			// Filter out lines that don't meet the minimum toi or don't contain the specified player
			var playerIdx = l.player_ids.indexOf(id);
			if (l.all.toi < 300 || playerIdx < 0) {
				return;
			}
			// Remove the specified player's properties from the response
			var pids = l.player_ids.filter(function(d, i) { return i !== playerIdx; });
			var firsts = l.firsts.filter(function(d, i) { return i !== playerIdx; });
			var lasts = l.lasts.filter(function(d, i) { return i !== playerIdx; });		
			var obj = {
				player_ids: pids,
				firsts: firsts,
				lasts: lasts,
				all: l.all,
				ev5: l.ev5,
				pp: l.pp,
				sh: l.sh
			}
			playerLineResults.push(obj);
		});

		//
		// For a specified player, calculate wowy stats
		//

		var wowyResults = [];

		// Initialize partner objects by looping through each player id of each line
		lineResults.forEach(function(l) {
			l.player_ids.forEach(function(pid, idx) {
				var existingObj = wowyResults.find(function(d) { return d.player_id === pid; });
				// Create partner object - ignore the specified player
				if (!existingObj && pid !== id) {
					wowyResults.push({
						player_id: pid,
						first: l.firsts[idx],
						last: l.lasts[idx],
						teams: [l.team]
					});
				} else if (existingObj) {
					// If the partner already has an object, record if the player and partner played together on a different team
					if (existingObj.teams.indexOf(l.team) < 0) {
						existingObj.teams.push(l.team);
					}
				}
			});
		});

		// Initialize stat counts
		wowyResults.forEach(function(p) {
			["together", "self_only", "mate_only"].forEach(function(context) {
				p[context] = {};
				["all", "ev5", "pp", "sh"].forEach(function(sit) {
					p[context][sit] = { toi: 0, cf: 0, ca: 0, cf_adj: 0, ca_adj: 0, gf: 0, ga: 0 };
				});
			});
		});

		// Increment stats with/without each partner by looping through each line's results
		wowyResults.forEach(function(p) {
			lineResults.forEach(function(l) {
				// Determine wowy context
				var hasSelf = l.player_ids.indexOf(id) >= 0 ? true: false; 			// Whether or not the player is in the line
				var hasMate = l.player_ids.indexOf(p.player_id) >= 0 ? true: false;	// Whether or not the linemate is in the line
				var context = "";
				if (!hasSelf && !hasMate) {
					return; // Skip line if it doesn't contain either player
				} else if (hasSelf && hasMate) {
					context = "together";
				} else if (hasSelf && !hasMate) {
					context = "self_only";
				} else if (!hasSelf && hasMate) {
					context = "mate_only";
				}
				// Increment stats for the context
				if (context) {
					["all", "ev5", "pp", "sh"].forEach(function(sit) {
						p[context][sit].toi += l[sit].toi;
						p[context][sit].cf += l[sit].cf;
						p[context][sit].ca += l[sit].ca;
						p[context][sit].cf_adj += l[sit].cf_adj;
						p[context][sit].ca_adj += l[sit].ca_adj;
						p[context][sit].gf += l[sit].gf;
						p[context][sit].ga += l[sit].ga;
					});
				}
			});
		});

		// Return results for the specified player
		return response.status(200).send({
			lines: playerLineResults,
			wowy: wowyResults
		});
	}
});

module.exports = router;