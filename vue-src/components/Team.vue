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
				<bulletchart :label="'GF/60, PP'" :data="data.breakpoints.pp_gf_per60" :isInverted="false"></bulletchart>
				<bulletchart :label="'GA/60, SH'" :data="data.breakpoints.sh_ga_per60" :isInverted="true"></bulletchart>
			</div>
			<div class="section legend">
				<div><span :style="{ background: colours.green5 }"></span><span>Top 6 teams</span></div
				><div><span :style="{ background: colours.green4 }"></span><span>7-12</span></div
				><div><span :style="{ background: colours.green3 }"></span><span>13-18</span></div
				><div><span :style="{ background: colours.green2 }"></span><span>19-24</span></div
				><div><span :style="{ background: colours.green1 }"></span><span>25-30</span></div>
			</div>
			<div class="section section-table" v-show="tabs.active === 'lines'">
				<div class="search-with-menu" style="margin-bottom: 24px;">
					<select v-model="search.condition">
						<option value="includes">With:</option>
						<option value="excludes">Without:</option>
					</select
					><input v-model="search.query" type="text" @keyup.enter="blurInput($event);">
				</div
				><select v-model="strengthSit">
					<option value="all">All situations</option>
					<option value="ev5">5 on 5</option>
					<option value="sh">Short handed</option>
					<option value="pp">Power play</option>
				</select
				><select v-model="search.positions">
					<option value="all">All lines</option>
					<option value="f">Forwards</option>
					<option value="d">Defense</option>
				</select>
				<table>
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
			data: {},
			strengthSit: "ev5",
			colours: constants.colours,
			tabs: { active: "lines" },
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
				this.data.lines.map(function(p) {
					p.sort_val = p[sit].toi === 0 ? 0 : p[sit][col] / p[sit].toi;
					return p;
				});	
			} else {
				this.data.lines.map(function(p) {
					p.sort_val = p[sit][col];
					return p;
				});						
			}
			return _.orderBy(this.data.lines, "sort_val", order);
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
		this.fetchData();
	},
	methods: {
		fetchData: function() {
			var tricode = this.$route.params.tricode;
			var self = this;
			var xhr = new XMLHttpRequest();
			xhr.open("GET", "./api/teams/" + tricode);
			xhr.onload = function() {
				self.data = JSON.parse(xhr.responseText);
				self.data.team.team_name = constants.teamNames[self.data.team.team];
				// Process/append additional stats for the player's lines
				self.data.lines.forEach(function(l) {
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