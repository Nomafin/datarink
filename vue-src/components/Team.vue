<template>
	<div>
		<div class="loader" v-if="!data.team"></div>
		<div v-if="data.team">
			<div class="section section-header">
				<h1>{{ data.team.team_name }}: 2016-2017</h1>
			</div>
			<div class="section" style="padding-left: 0; padding-right: 0; margin-bottom: 8px;">
				<bulletchart :label="'score adj. CF/60, 5 on 5'" :data="data.breakpoints.ev5_cf_adj_per60" :isInverted="false"></bulletchart>
				<bulletchart :label="'score adj. CA/60, 5 on 5'" :data="data.breakpoints.ev5_ca_adj_per60" :isInverted="true"></bulletchart>
				<bulletchart :label="'GF/60, 5 on 5'" :data="data.breakpoints.ev5_gf_per60" :isInverted="false"></bulletchart>
				<bulletchart :label="'GA/60, 5 on 5'" :data="data.breakpoints.ev5_ga_per60" :isInverted="true"></bulletchart>
				<bulletchart :label="'GF/60, power play'" :data="data.breakpoints.pp_gf_per60" :isInverted="false"></bulletchart>
				<bulletchart :label="'GA/60, short handed'" :data="data.breakpoints.sh_ga_per60" :isInverted="true"></bulletchart>
			</div>
			<div class="section legend">
				<div><span :style="{ background: colours.green8 }"></span><span>Top 6 teams</span></div
				><div><span :style="{ background: colours.green6 }"></span><span>7-12</span></div
				><div><span :style="{ background: colours.green4 }"></span><span>13-18</span></div
				><div><span :style="{ background: colours.green2 }"></span><span>19-24</span></div
				><div><span :style="{ background: colours.green1 }"></span><span>25-30</span></div>
			</div>
			<div class="section section-control" style="border-top-width: 1px; border-bottom-width: 1px; padding-top: 23px; padding-bottom: 15px; margin-bottom: 24px;">
				<div class="toggle" style="display: inline-block; vertical-align: top;">
					<button :class="tabs.active === 'games' ? 'selected' : null" @click="tabs.active = 'games'">Games</button
					><button :class="tabs.active === 'self' ? 'selected' : null" @click="tabs.active = 'self'">Team</button
					><button :class="tabs.active === 'lines' ? 'selected' : null" @click="tabs.active = 'lines'">Lines</button>
				</div
				><select v-model="strengthSit">
					<option value="all">All situations</option>
					<option value="ev5">5 on 5</option>
					<option value="sh">Short handed</option>
					<option value="pp">Power play</option>
				</select>
			</div>
			<div class="section section-table" v-show="tabs.active === 'lines'">
				<div class="loader" v-if="data.team && !lineData.lines"></div>
				<select v-if="lineData.lines" v-model="search.positions">
					<option value="all">All lines</option>
					<option value="f">Forwards</option>
					<option value="d">Defense</option>
				</select
				><div v-if="lineData.lines" class="search-with-menu" style="margin-bottom: 24px;">
					<select v-model="search.condition">
						<option value="includes">With:</option>
						<option value="excludes">Without:</option>
					</select
					><input v-model="search.query" type="text" @keyup.enter="blurInput($event);">
				</div>
				<table v-if="lineData.lines">
					<thead>
						<tr>
							<th class="left-aligned">Linemates</th>
							<th class="left-aligned"></th>
							<th class="left-aligned"></th>
							<th @click="sortBy('toi')" @keyup.enter="sortBy('toi')" tabindex="0"
								:class="[ sort.col === 'toi' ? (sort.order === -1 ? 'sort-desc' : 'sort-asc') : '' ]"
							>Mins</th>
							<th @click="sortBy('g_diff')" @keyup.enter="sortBy('g_diff')" tabindex="0"
								:class="[ sort.col === 'g_diff' ? (sort.order === -1 ? 'sort-desc' : 'sort-asc') : '' ]"
							>Goal diff</th>
							<th @click="sortBy('cf_pct_adj')" @keyup.enter="sortBy(cf_pct_adj)" tabindex="0"
								:class="[ sort.col === 'cf_pct_adj' ? (sort.order === -1 ? 'sort-desc' : 'sort-asc') : '' ]"
							>CF% score-adj</th>
							<th @click="sortBy('cf_pct')" @keyup.enter="sortBy(cf_pct)" tabindex="0"
								:class="[ sort.col === 'cf_pct' ? (sort.order === -1 ? 'sort-desc' : 'sort-asc') : '' ]"
							>CF%</th>
							<th @click="sortBy('cf')" @keyup.enter="sortBy(cf)" tabindex="0"
								:class="[ sort.col === 'cf' ? (sort.order === -1 ? 'sort-desc' : 'sort-asc') : '' ]"
							>CF/60</th>
							<th @click="sortBy('ca')" @keyup.enter="sortBy(ca)" tabindex="0"
								:class="[ sort.col === 'ca' ? (sort.order === -1 ? 'sort-desc' : 'sort-asc') : '' ]"
							>CA/60</th>
						</tr>
					</thead>
					<tbody>
						<tr v-for="l in filteredLines">
							<td class="left-aligned">{{ l.firsts[0] + " " + l.lasts[0] }}</td>
							<td class="left-aligned">{{ l.firsts[1] + " " + l.lasts[1] }}</td>
							<td class="left-aligned">{{ l.firsts[2] + " " + l.lasts[2] }}</td>
							<td>{{ Math.round(l[strengthSit].toi) }}</td>
							<td>{{ l[strengthSit].g_diff | signed }}</td>
							<td>{{ l[strengthSit].cf_pct_adj | percentage(false) }}<span class="pct">%</span></td>
							<td>{{ l[strengthSit].cf_pct | percentage(false) }}<span class="pct">%</span></td>
							<td>{{ l[strengthSit].cf | rate(true, l[strengthSit].toi, false) }}</td>
							<td>{{ l[strengthSit].ca | rate(true, l[strengthSit].toi, false) }}</td>
						</tr>
						<tr v-if="filteredLines.length === 0">
							<td class="left-aligned" colspan="9">No lines with at least 5 minutes together</td>
						</tr>
					</tbody>
				</table>
			</div>
			<div class="section" v-show="tabs.active === 'self'">
				<table class="left-aligned">
					<tr>
						<th colspan="3">Record</th>
					</tr>
					<tr>
						<td>Points</td>
						<td>{{ data.team.points }}</td>
						<td>{{ data.team.points_pct | percentage(false) }}<span class="pct">%</span></td>
					</tr>
					<tr>
						<td>Record</td>
						<td>{{ data.team.record[0] + "-" + data.team.record[1] + "-" + data.team.record[2] }}</td>
						<td>{{ data.team.gp }} games</td>
					</tr>
					<tr>
						<td>Wins by 1 goal, OT, SO</td>
						<td colspan="2">{{ data.team.record1g[0] }}</td>
					</tr>
					<tr>
						<td>Losses by 1 goal, OT, SO</td>
						<td colspan="2">{{ data.team.record1g[1] + data.team.record1g[2] }}</td>
					</tr>
					<tr>
						<th colspan="3">Goals</th>
					</tr>
					<tr v-if="strengthSit !== 'pp' && strengthSit !== 'sh'">
						<td>GF%</td>
						<td colspan="2">{{ data.team.stats[strengthSit].gf_pct | percentage(false) }}<span class="pct">%</span></td>
					</tr>
					<tr v-if="strengthSit !== 'pp' && strengthSit !== 'sh'">
						<td>Differential</td>
						<td>{{ data.team.stats[strengthSit].g_diff | signed }}</td>
						<td><span v-if="data.team.stats[strengthSit].g_diff !== 0">{{ data.team.stats[strengthSit].g_diff | rate(true, data.team.stats[strengthSit].toi, true) }} per 60</span></td>
					</tr>
					<tr>
						<td>GF</td>
						<td>{{ data.team.stats[strengthSit].gf }}</td>
						<td><span v-if="data.team.stats[strengthSit].gf !== 0">{{ data.team.stats[strengthSit].gf | rate(true, data.team.stats[strengthSit].toi, false) }} per 60</span></td>
					</tr>
					<tr>
						<td>GA</td>
						<td>{{ data.team.stats[strengthSit].ga }}</td>
						<td><span v-if="data.team.stats[strengthSit].ga !== 0">{{ data.team.stats[strengthSit].ga | rate(true, data.team.stats[strengthSit].toi, false) }} per 60</span></td>
					</tr>
					<tr>
						<td>Sh%</td>
						<td colspan="2">{{ data.team.stats[strengthSit].sh_pct | percentage(false) }}<span class="pct">%</span></td>
					</tr>
					<tr>
						<td>Sv%</td>
						<td colspan="2">{{ data.team.stats[strengthSit].sv_pct | percentage(false) }}<span class="pct">%</span></td>
					</tr>
					<tr>
						<th colspan="3">Corsi</th>
					</tr>
					<tr v-if="strengthSit !== 'pp' && strengthSit !== 'sh'">
						<td>CF%</td>
						<td colspan="2">{{ data.team.stats[strengthSit].cf_pct | percentage(false) }}<span class="pct">%</span></td>
					</tr>
					<tr v-if="strengthSit !== 'pp' && strengthSit !== 'sh'">
						<td>CF% score-adj</td>
						<td colspan="2">{{ data.team.stats[strengthSit].cf_pct_adj | percentage(false) }}<span class="pct">%</span></td>
					</tr>
					<tr v-if="strengthSit !== 'pp' && strengthSit !== 'sh'">
						<td>Differential</td>
						<td>{{ data.team.stats[strengthSit].c_diff | signed }}</td>
						<td><span v-if="data.team.stats[strengthSit].c_diff !== 0">{{ data.team.stats[strengthSit].c_diff | rate(true, data.team.stats[strengthSit].toi, true) }} per 60</span></td>
					</tr>
					<tr>
						<td>CF</td>
						<td>{{ data.team.stats[strengthSit].cf }}</td>
						<td><span v-if="data.team.stats[strengthSit].cf !== 0">{{ data.team.stats[strengthSit].cf | rate(true, data.team.stats[strengthSit].toi, false) }} per 60</span></td>
					</tr>
					<tr>
						<td>CA</td>
						<td>{{ data.team.stats[strengthSit].ca }}</td>
						<td><span v-if="data.team.stats[strengthSit].ca !== 0">{{ data.team.stats[strengthSit].ca | rate(true, data.team.stats[strengthSit].toi, false) }} per 60</span></td>
					</tr>
				</table>
			</div>
			<div class="section section-table" v-show="tabs.active === 'games'">
				<table>
					<thead>
						<tr>
							<th class="left-aligned">Date</th>
							<th class="left-aligned">Opponent</th>
							<th class="left-aligned">Result</th>
							<th>Mins</th>
							<th>GF</th>
							<th>GA</th>
							<th>G diff</th>
							<th>CF</th>
							<th>CA</th>
							<th>C diff</th>
							<th>C diff, score-adj</th>
						</tr>
					</thead>
					<tbody>
						<tr v-for="g in data.history">
							<td class="left-aligned">{{ g.date }}</td>
							<td class="left-aligned">{{ g.opp.toUpperCase() }}</td>
							<td class="left-aligned">{{ g.result }}</td>
							<td>{{ Math.round(g.stats[strengthSit].toi) }}</td>
							<td>{{ g.stats[strengthSit].gf }}</td>
							<td>{{ g.stats[strengthSit].ga }}</td>
							<td>{{ g.stats[strengthSit].g_diff | signed }}</td>
							<td>{{ g.stats[strengthSit].cf }}</td>
							<td>{{ g.stats[strengthSit].ca }}</td>
							<td>{{ g.stats[strengthSit].c_diff | signed }}</td>
							<td>{{ g.stats[strengthSit].c_diff_adj | signed }}</td>
						</tr>
					</tbody>
				</table>
			</div>
		</div>
	</div>
</template>

<script>
var Bulletchart = require("./Bulletchart.vue");
var _ = require("lodash");
var constants = require("./../app-constants.js");
module.exports = {
	name: "Team",
	data: function() {
		return {
			tricode: null,
			data: {},
			lineData: {},
			strengthSit: "ev5",
			colours: constants.colours,
			tabs: { active: "games" },
			sort: { col: "toi", order: -1 },
			search: { col: "names", condition: "includes", query: "", positions: "all" }
		};
	},
	components: {
		"bulletchart": Bulletchart
	},
	computed: {
		sortedLines: function() {
			var col = this.sort.col;
			var order = this.sort.order < 0 ? "desc" : "asc";
			var sit = this.strengthSit;
			if (col === "cf" || col === "ca") {
				this.lineData.lines.map(function(p) {
					p.sort_val = p[sit].toi === 0 ? 0 : p[sit][col] / p[sit].toi;
					return p;
				});	
			} else {
				this.lineData.lines.map(function(p) {
					p.sort_val = p[sit][col];
					return p;
				});						
			}
			return _.orderBy(this.lineData.lines, "sort_val", order);
		},
		filteredLines: function() {
			var query = this.search.query.toLowerCase();
			var sit = this.strengthSit;
			var positions = this.search.positions === "all" ? ["f", "d"] : [this.search.positions];
			var data = this.sortedLines
				.filter(function(d) { return d[sit].toi >= 5; })
				.filter(function(d) { return positions.indexOf(d.f_or_d) >= 0 });
			if (query) {
				if (this.search.condition === "includes") {
					data = data.filter(function(d) { return (d.name1.indexOf(query) >= 0 || d.name2.indexOf(query) >= 0 || d.name3.indexOf(query) >= 0); });
				} else if (this.search.condition === "excludes") {
					data = data.filter(function(d) { return d.name1.indexOf(query) < 0 && d.name2.indexOf(query) < 0 && d.name3.indexOf(query) < 0; });
				}
			}
			return data;
		}		
	},
	filters: {
		pluralize: function(value, unit) {
			var unitStr = value === 1 ? unit : unit + "s";
			return value + " " + unitStr;
		},
		rate: function(value, isRatesEnabled, toi, isSigned) {
			var output = value;
			if (isRatesEnabled) {
				output = toi === 0 ? 0 : 60 * value / toi;
				output = output.toFixed(1);
			}
			if (isSigned && value > 0) {
				output = "+" + output;
			}
			return output;
		},
		percentage: function(value, isSigned) {
			var output = value.toFixed(1);
			if (isSigned && value > 0) {
				output = "+" + output;
			}
			return output;
		},
		signed: function(value) {
			return value > 0 ? "+" + value : value;
		}
	},
	created: function() {
		this.tricode = this.$route.params.tricode;
		this.fetchData();
		this.fetchLineData();
		// Google Analytics
		if (window.location.hostname.toLowerCase() !== "localhost") {
			ga("set", "page", "/team");
			ga("send", "pageview");
		}
	},
	methods: {
		fetchData: function() {
			var self = this;
			var xhr = new XMLHttpRequest();
			xhr.open("GET", "./api/teams/" + this.tricode);
			xhr.onload = function() {
				self.data = JSON.parse(xhr.responseText);
				self.data.team.team_name = constants.teamNames[self.data.team.team];
				// Get point percentage
				self.data.team.points_pct = 100 * self.data.team.points / (2 * self.data.team.gp);
				// Process/append additional stats for the team
				["all", "ev5", "pp", "sh"].forEach(function(strSit) {
					var s = self.data.team.stats[strSit];
					s.toi /= 60;
					s.g_diff = s.gf - s.ga;
					s.gf_pct = s.gf + s.ga === 0 ? 0 : 100 * s.gf / (s.gf + s.ga);
					s.sh_pct = s.sf === 0 ? 0 : 100 * s.gf / s.sf;
					s.sv_pct *= 100;
					s.c_diff = s.cf - s.ca;
					s.cf_pct = s.cf + s.ca === 0 ? 0 : 100 * s.cf / (s.cf + s.ca);
					s.cf_pct_adj = s.cf_adj + s.ca_adj === 0 ? 0 : 100 * s.cf_adj / (s.cf_adj + s.ca_adj);
				});
				// Process history data
				self.data.history = _.orderBy(self.data.history, "datetime", "desc");
				self.data.team.record = [0, 0, 0];		// [wins, losses, OT/SO losses]
				self.data.team.record1g = [0, 0, 0]; 	// record in 1 goal games
				self.data.history.forEach(function(g) {
					g.opp = g.is_home ? g.opp : "@" + g.opp;
					var datetime = new Date(g.datetime);
					g.date = constants.monthNames[datetime.getMonth()] + " " + datetime.getDate();
					// Create string to describe the game result
					var resultString = g.team_final > g.opp_final ? "W" : "L";
					resultString += ", " + g.team_final + "-" + g.opp_final;
					if (g.game_id < 30000 && g.periods > 3) {
						if (g.periods === 4) {
							resultString += " (OT)";
						} else if (g.periods === 5) {
							resultString += " (SO)";
						}
					}
					g.result = resultString;
					// Process/append additional stats for game
					["all", "ev5", "pp", "sh"].forEach(function(strSit) {
						var s = g.stats[strSit];
						s.toi /= 60;
						s.g_diff = s.gf - s.ga;
						s.c_diff = s.cf - s.ca;
						s.c_diff_adj = (s.cf_adj - s.ca_adj).toFixed(1);
					});
					// Update record
					if (g.team_final > g.opp_final) {
						self.data.team.record[0]++;
						if (g.team_final - g.opp_final === 1) {
							self.data.team.record1g[0]++;
						}
					} else if (g.game_id < 30000 && g.periods <= 3) {
						self.data.team.record[1]++;
						if (g.opp_final - g.team_final === 1) {
							self.data.team.record1g[1]++;
						}
					} else if (g.game_id < 30000 && g.periods > 3) {
						self.data.team.record[2]++;
						self.data.team.record1g[2]++;
					}
				});
			}
			xhr.send();
		},
		fetchLineData: function() {
			var self = this;
			var xhr = new XMLHttpRequest();
			xhr.open("GET", "./api/teams/" + this.tricode + "/lines");
			xhr.onload = function() {
				self.lineData = JSON.parse(xhr.responseText);
				// Process/append additional stats for the team's lines
				self.lineData.lines.forEach(function(l) {
					l.name1 = (l.firsts[0] + " " + l.lasts[0]).toLowerCase();
					l.name2 = (l.firsts[1] + " " + l.lasts[1]).toLowerCase();
					if (l.f_or_d === "d") {
						l.firsts[2] = "";
						l.lasts[2] = "";
					}
					l.name3 = (l.firsts[2] + " " + l.lasts[2]).toLowerCase();
					["all", "ev5", "pp", "sh"].forEach(function(strSit) {
						var s = l[strSit];
						s.toi /= 60;
						s.g_diff = s.gf - s.ga;
						s.cf_pct = s.cf + s.ca === 0 ? 0 : 100 * s.cf / (s.cf + s.ca);
						s.cf_pct_adj = s.cf_adj + s.ca_adj === 0 ? 0 : 100 * s.cf_adj / (s.cf_adj + s.ca_adj);
					});
				});
			}
			xhr.send();
		},
		sortBy: function(newSortCol) {
			this.sort.order = newSortCol === this.sort.col ? -this.sort.order : -1;
			this.sort.col = newSortCol;
		},
		blurInput: function(event) {
			event.target.blur();
		}
	}
};
</script>