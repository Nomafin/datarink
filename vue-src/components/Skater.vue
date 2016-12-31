<template>
	<div>
		<div class="loader" v-if="!data"></div>
		<div v-if="data">
			<div class="section section-header">
				<h1>{{ data.player.first + " " + data.player.last }}: 2016-2017</h1>
			</div>
			<div class="loader" v-if="data && !bulletchartData"></div>
			<div v-if="bulletchartData" class="section" style="padding-left: 0; padding-right: 0; margin-bottom: 8px;">
				<bulletchart :label="'mins/game, total'" :data="bulletchartData.all_toi" :isInverted="false"></bulletchart>
				<bulletchart :label="'score adj. CF/60, 5 on 5'" :data="bulletchartData.ev5_cf_adj_per60" :isInverted="false"></bulletchart>
				<bulletchart :label="'score adj. CA/60, 5 on 5'" :data="bulletchartData.ev5_ca_adj_per60" :isInverted="true"></bulletchart>
				<bulletchart :label="'P1/60, 5 on 5'" :data="bulletchartData.ev5_p1_per60" :isInverted="false"></bulletchart>
				<bulletchart :label="'P1/60, power play'" :data="bulletchartData.pp_p1_per60" :isInverted="false"></bulletchart>
			</div>
			<div v-if="bulletchartData" class="section legend">
				<div><span :style="{ background: colours.green5 }"></span><span v-if="data.player.f_or_d === 'f'">Top 90 forwards</span><span v-if="data.player.f_or_d === 'd'">Top 60 defenders</span></div>
				<div><span :style="{ background: colours.green4 }"></span><span v-if="data.player.f_or_d === 'f'">91-180</span><span v-if="data.player.f_or_d === 'd'">61-120</span></div>
				<div><span :style="{ background: colours.green3 }"></span><span v-if="data.player.f_or_d === 'f'">181-270</span><span v-if="data.player.f_or_d === 'd'">121-180</span></div>
				<div v-if="data.player.f_or_d === 'f'"><span :style="{ background: colours.green2 }"></span><span>261-360</span></div>
			</div>
			<div class="section section-control" style="border-top-width: 1px; border-bottom-width: 1px; padding-top: 23px; padding-bottom: 15px; margin-bottom: 24px;">
				<div class="toggle" style="display: inline-block; vertical-align: top;">
					<button :class="tabs.active === 'games' ? 'selected' : null" @click="tabs.active = 'games'">Games</button
					><button :class="tabs.active === 'self' ? 'selected' : null" @click="tabs.active = 'self'">Player</button
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
				<div class="loader" v-if="data && !lineData"></div>
				<div v-if="lineData" class="search-with-menu" style="margin-bottom: 24px;">
					<select v-model="search.condition">
						<option value="includes">With:</option>
						<option value="excludes">Without:</option>
					</select
					><input v-model="search.query" type="text" @keyup.enter="blurInput($event);">
				</div>
				<table v-if="lineData">
					<thead>
						<tr>
							<th class="left-aligned">Linemates</th>
							<th class="left-aligned" v-if="data.player.f_or_d === 'f'"></th>
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
							<td class="left-aligned" v-if="data.player.f_or_d === 'f'">{{ l.firsts[1] + " " + l.lasts[1] }}</td>
							<td>{{ Math.round(l[strengthSit].toi) }}</td>
							<td>{{ l[strengthSit].g_diff | signed }}</td>
							<td>{{ l[strengthSit].cf_pct_adj | percentage(false) }}<span class="pct">%</span></td>
							<td>{{ l[strengthSit].cf_pct | percentage(false) }}<span class="pct">%</span></td>
							<td>{{ l[strengthSit].cf | rate(true, l[strengthSit].toi, false) }}</td>
							<td>{{ l[strengthSit].ca | rate(true, l[strengthSit].toi, false) }}</td>
						</tr>
						<tr v-if="filteredLines.length === 0">
							<td class="left-aligned" :colspan="data.player.f_or_d === 'f' ? '8' : '7'">No lines with at least 5 minutes together</td>
						</tr>
					</tbody>
				</table>
			</div>
			<div class="section" v-show="tabs.active === 'self'">
				<table class="left-aligned">
					<thead>
						<tr>
							<th colspan="3">Own production</th>
						</tr>
					</thead>
					<tr>
						<td>Playing time</td>
						<td>{{ (data.player.stats[strengthSit].toi / data.player.gp).toFixed(1) }} mins/game</td>
						<td>{{ data.player.gp }} games</td>
					</tr>
					<tr>
						<td>Goals and assists</td>
						<td colspan="2">{{ data.player.stats[strengthSit].ig | pluralize("goal") }}, {{ data.player.stats[strengthSit].ia1 | pluralize("primary assist") }}, {{ data.player.stats[strengthSit].ia2 | pluralize("secondary assist") }}</td>
					</tr>
					<tr>
						<td>Points</td>
						<td>{{ data.player.stats[strengthSit].ip }}</td>
						<td><span v-if="data.player.stats[strengthSit].ip !== 0">{{ data.player.stats[strengthSit].ip | rate(true, data.player.stats[strengthSit].toi, false) }} per 60</span></td>
					</tr>
					<tr>
						<td>Primary points</td>
						<td>{{ data.player.stats[strengthSit].ip1 }}</td>
						<td><span v-if="data.player.stats[strengthSit].ip1 !== 0">{{ data.player.stats[strengthSit].ip1 | rate(true, data.player.stats[strengthSit].toi, false) }} per 60</span></td>
					</tr>
					<tr>
						<td>Corsi</td>
						<td>{{ data.player.stats[strengthSit].ic }}</td>
						<td><span v-if="data.player.stats[strengthSit].ic !== 0">{{ data.player.stats[strengthSit].ic | rate(true, data.player.stats[strengthSit].toi, false) }} per 60</span></td>
					</tr>
					<tr>
						<td>Sh%</td>
						<td colspan="2">{{ data.player.stats[strengthSit].i_sh_pct | percentage(false) }}<span class="pct">%</span></td>
					</tr>
					<tr>
						<th colspan="3">On-ice goals</th>
					</tr>
					<tr v-if="strengthSit !== 'pp' && strengthSit !== 'sh'">
						<td>GF%</td>
						<td colspan="2">{{ data.player.stats[strengthSit].gf_pct | percentage(false) }}<span class="pct">%</span></td>
					</tr>
					<tr v-if="strengthSit !== 'pp' && strengthSit !== 'sh'">
						<td>Differential</td>
						<td>{{ data.player.stats[strengthSit].g_diff | signed }}</td>
						<td><span v-if="data.player.stats[strengthSit].g_diff !== 0">{{ data.player.stats[strengthSit].g_diff | rate(true, data.player.stats[strengthSit].toi, true) }} per 60</span></td>
					</tr>
					<tr>
						<td>GF</td>
						<td>{{ data.player.stats[strengthSit].gf }}</td>
						<td><span v-if="data.player.stats[strengthSit].gf !== 0">{{ data.player.stats[strengthSit].gf | rate(true, data.player.stats[strengthSit].toi, false) }} per 60</span></td>
					</tr>
					<tr>
						<td>GA</td>
						<td>{{ data.player.stats[strengthSit].ga }}</td>
						<td><span v-if="data.player.stats[strengthSit].ga !== 0">{{ data.player.stats[strengthSit].ga | rate(true, data.player.stats[strengthSit].toi, false) }} per 60</span></td>
					</tr>
					<tr>
						<td>Sh%</td>
						<td colspan="2">{{ data.player.stats[strengthSit].sh_pct | percentage(false) }}<span class="pct">%</span></td>
					</tr>
					<tr>
						<td>Sv%</td>
						<td colspan="2">{{ data.player.stats[strengthSit].sv_pct | percentage(false) }}<span class="pct">%</span></td>
					</tr>
					<tr>
						<th colspan="3">On-ice corsi</th>
					</tr>
					<tr v-if="strengthSit !== 'pp' && strengthSit !== 'sh'">
						<td>CF%</td>
						<td colspan="2">{{ data.player.stats[strengthSit].cf_pct | percentage(false) }}<span class="pct">%</span></td>
					</tr>
					<tr v-if="strengthSit !== 'pp' && strengthSit !== 'sh'">
						<td>CF% score-adj</td>
						<td colspan="2">{{ data.player.stats[strengthSit].cf_pct_adj | percentage(false) }}<span class="pct">%</span></td>
					</tr>
					<tr v-if="strengthSit !== 'pp' && strengthSit !== 'sh'">
						<td>CF% relative</td>
						<td colspan="2">{{ data.player.stats[strengthSit].cf_pct_rel | percentage(true) }}<span class="pct">%</span></td>
					</tr>
					<tr v-if="strengthSit !== 'pp' && strengthSit !== 'sh'">
						<td>Differential</td>
						<td>{{ data.player.stats[strengthSit].c_diff | signed }}</td>
						<td><span v-if="data.player.stats[strengthSit].c_diff !== 0">{{ data.player.stats[strengthSit].c_diff | rate(true, data.player.stats[strengthSit].toi, true) }} per 60</span></td>
					</tr>
					<tr>
						<td>CF</td>
						<td>{{ data.player.stats[strengthSit].cf }}</td>
						<td><span v-if="data.player.stats[strengthSit].cf !== 0">{{ data.player.stats[strengthSit].cf | rate(true, data.player.stats[strengthSit].toi, false) }} per 60</span></td>
					</tr>
					<tr>
						<td>CA</td>
						<td>{{ data.player.stats[strengthSit].ca }}</td>
						<td><span v-if="data.player.stats[strengthSit].ca !== 0">{{ data.player.stats[strengthSit].ca | rate(true, data.player.stats[strengthSit].toi, false) }} per 60</span></td>
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
							<th class="left-aligned">Points</th>
							<th>Mins</th>
							<th>Own C</th>
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
							<td class="left-aligned" v-if="g.position === 'na'" colspan="9">Scratched or injured</td>
							<td class="left-aligned" v-if="g.position !== 'na'">{{ g.stats[strengthSit].points }}</td>
							<td v-if="g.position !== 'na'">{{ Math.round(g.stats[strengthSit].toi) }}</td>
							<td v-if="g.position !== 'na'">{{ g.stats[strengthSit].ic }}</td>
							<td v-if="g.position !== 'na'">{{ g.stats[strengthSit].gf }}</td>
							<td v-if="g.position !== 'na'">{{ g.stats[strengthSit].ga }}</td>
							<td v-if="g.position !== 'na'">{{ g.stats[strengthSit].g_diff | signed }}</td>
							<td v-if="g.position !== 'na'">{{ g.stats[strengthSit].cf }}</td>
							<td v-if="g.position !== 'na'">{{ g.stats[strengthSit].ca }}</td>
							<td v-if="g.position !== 'na'">{{ g.stats[strengthSit].c_diff | signed }}</td>
							<td v-if="g.position !== 'na'">{{ g.stats[strengthSit].c_diff_adj | signed }}</td>
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
	name: "Skater",
	data: function() {
		return {
			pId: null,
			data: null,
			lineData: null,
			breakpointData: null,
			bulletchartData: null,
			colours: constants.colours,
			strengthSit: "ev5",
			tabs: { active: "games" },
			sort: { col: "toi", order: -1 },
			search: { col: "names", condition: "includes", query: "" }
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
			var data = this.sortedLines.filter(function(d) { return d[sit].toi >= 5; });
			if (query) {
				if (this.search.condition === "includes") {
					data = data.filter(function(d) { return (d.name1.indexOf(query) >= 0 || d.name2.indexOf(query) >= 0); });
				} else if (this.search.condition === "excludes") {
					data = data.filter(function(d) { return d.name1.indexOf(query) < 0 && d.name2.indexOf(query) < 0; });
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
		this.pId = this.$route.params.id;
		this.fetchData();
		this.fetchLineData();
		this.fetchBreakpointData();
		// Google Analytics
		if (window.location.hostname.toLowerCase() !== "localhost") {
			ga("set", "page", "/player");
			ga("send", "pageview");
		}
	},
	methods: {
		fetchData: function() {
			var self = this;
			var xhr = new XMLHttpRequest();
			xhr.open("GET", "./api/players/" + this.pId);
			xhr.onload = function() {
				self.data = JSON.parse(xhr.responseText);
				// Process/append additional stats for the player
				["all", "ev5", "pp", "sh"].forEach(function(strSit) {
					var s = self.data.player.stats[strSit];
					s.toi /= 60;
					s.ip1 = s.ig + s.ia1;
					s.ip = s.ig + s.ia1 + s.ia2;
					s.i_sh_pct = s.is === 0 ? 0 : 100 * s.ig / s.is;
					s.g_diff = s.gf - s.ga;
					s.gf_pct = s.gf + s.ga === 0 ? 0 : 100 * s.gf / (s.gf + s.ga);
					s.sh_pct = s.sf === 0 ? 0 : 100 * s.gf / s.sf;
					s.sv_pct *= 100;
					s.c_diff = s.cf - s.ca;
					s.cf_pct = s.cf + s.ca === 0 ? 0 : 100 * s.cf / (s.cf + s.ca);
					s.cf_pct_rel = (s.cf + s.ca === 0 || s.cf_off + s.ca_off === 0) ? 0
						: 100 * (s.cf / (s.cf + s.ca) - s.cf_off / (s.cf_off + s.ca_off));
					s.cf_pct_adj = s.cf_adj + s.ca_adj === 0 ? 0 : 100 * s.cf_adj / (s.cf_adj + s.ca_adj);
				});
				// Process history data
				self.data.history = _.orderBy(self.data.history, "datetime", "desc");
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
						// Create string to describe the player's points: 1G, 2A2
						var pointString = s.ig > 0 ? s.ig + "G" : "";
						pointString += pointString.length > 0 && s.ia1 > 0 ? ", " : "";
						pointString += s.ia1 > 0 ? s.ia1 + "A¹" : "";
						pointString += pointString.length > 0 && s.ia2 > 0 ? ", " : "";
						pointString += s.ia2 > 0 ? s.ia2 + "A²" : "";
						s.points = pointString;
					});
				});
				self.prepareBulletchartData();
			}
			xhr.send();
		},
		fetchLineData: function() {
			var self = this;
			var xhr = new XMLHttpRequest();
			xhr.open("GET", "./api/players/" + this.pId + "/lines");
			xhr.onload = function() {
				self.lineData = JSON.parse(xhr.responseText);
				// Process/append additional stats for the player's lines
				self.lineData.lines.forEach(function(l) {
					l.name1 = (l.firsts[0] + " " + l.lasts[0]).toLowerCase();
					if (self.lineData.lines[0].f_or_d === "d") {
						l.firsts[1] = "";
						l.lasts[1] = "";
					}
					l.name2 = (l.firsts[1] + " " + l.lasts[1]).toLowerCase();
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
		fetchBreakpointData: function() {
			var self = this;
			var xhr = new XMLHttpRequest();
			xhr.open("GET", "./api/players/breakpoints");
			xhr.onload = function() {
				self.breakpointData = JSON.parse(xhr.responseText);
				self.prepareBulletchartData();
			}
			xhr.send();
		},
		prepareBulletchartData: function() {
			// Wait until breakpoint data and player data are available
			if (!this.breakpointData || !this.data) {
				return;
			}
			var breakpoints = this.data.player.f_or_d === "f" ? this.breakpointData.f_breakpoints : this.breakpointData.d_breakpoints;
			this.bulletchartData = {};
			var self = this;
			Object.keys(breakpoints).forEach(function(stat) {
				self.bulletchartData[stat] = {};
				// Store breakpoints
				if (stat === "all_toi") {
					self.bulletchartData[stat].breakpoints = breakpoints[stat].map(function(d) { return d / 60; });
				} else {
					self.bulletchartData[stat].breakpoints = breakpoints[stat];
				}
				var statsObj = self.data.player.stats;
				var val;
				// Store player's own datapoint
				if (stat === "all_toi") {
					val = statsObj.all.toi / self.data.player.gp;
				} else if (stat === "ev5_cf_adj_per60") {
					val = 60 * statsObj.ev5.cf_adj / statsObj.ev5.toi;
				} else if (stat === "ev5_ca_adj_per60") {
					val = 60 * statsObj.ev5.ca_adj / statsObj.ev5.toi;
				} else if (stat === "ev5_p1_per60") {
					val = 60 * (statsObj.ev5.ig + statsObj.ev5.ia1) / statsObj.ev5.toi;
				} else if (stat === "pp_p1_per60") {
					val = 60 * (statsObj.pp.ig + statsObj.pp.ia1) / statsObj.pp.toi;
				}
				self.bulletchartData[stat].self = val;
				// Get whether or not player was included in breakpoint calculations
				var inDist = false;
				if (self.data.player.gp >= 10) {
					if (stat === "pp_p1_per60") {
						if (statsObj.pp.toi >= 20) {
							inDist = true;
						}
					} else {
						inDist = true;
					}
				}
				self.bulletchartData[stat].isSelfInDistribution = inDist;
			});
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