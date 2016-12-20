<template>
	<div>
		<div class="loader" v-if="!data.player"></div>
		<div v-if="data.player">
			<div class="section section-header">
				<h1>{{ data.player.first + " " + data.player.last }}: 2016-2017</h1>
			</div>
			<div class="section" style="padding-left: 0; padding-right: 0; margin-bottom: 8px;">
				<bulletchart v-bind:label="'mins/game, total'" v-bind:data="data.breakpoints.all_toi" v-bind:isInverted="false"></bulletchart>
				<bulletchart v-bind:label="'score adj. CF/60, 5 on 5'" v-bind:data="data.breakpoints.ev5_cf_adj_per60" v-bind:isInverted="false"></bulletchart>
				<bulletchart v-bind:label="'score adj. CA/60, 5 on 5'" v-bind:data="data.breakpoints.ev5_ca_adj_per60" v-bind:isInverted="true"></bulletchart>
				<bulletchart v-bind:label="'P1/60, 5 on 5'" v-bind:data="data.breakpoints.ev5_p1_per60" v-bind:isInverted="false"></bulletchart>
				<bulletchart v-bind:label="'P1/60, power play'" v-bind:data="data.breakpoints.pp_p1_per60" v-bind:isInverted="false"></bulletchart>
			</div>
			<div class="section legend" v-if="data.player.f_or_d === 'f'">
				<div><span style="background: #2db27b;"></span><span>Top 90 forwards</span></div>
				<div><span style="background: #65c396;"></span><span>91-180</span></div>
				<div><span style="background: #8ed4b1;"></span><span>181-270</span></div>
				<div><span style="background: #b5e4cd;"></span><span>261-360</span></div>
				<div><span style="background: #dbf5ea;"></span><span>361+</span></div>
			</div>
			<div class="section legend" v-if="data.player.f_or_d === 'd'">
				<div><span style="background: #2db27b;"></span><span>Top 60 defenders</span></div>
				<div><span style="background: #65c396;"></span><span>61-120</span></div>
				<div><span style="background: #8ed4b1;"></span><span>121-180</span></div>
				<div><span style="background: #b5e4cd;"></span><span>181+</span></div>
			</div>
			<div class="section section-control" style="border-top-width: 1px; border-bottom-width: 1px; padding-top: 23px; padding-bottom: 15px; margin-bottom: 24px;">
				<div class="toggle" style="display: inline-block; vertical-align: top;">
					<button v-bind:class="tabs.active === 'lines' ? 'selected' : null" @click="tabs.active = 'lines'">Lines</button
					><button v-bind:class="tabs.active === 'self' ? 'selected' : null" @click="tabs.active = 'self'">Player</button
					><button v-bind:class="tabs.active === 'games' ? 'selected' : null" @click="tabs.active = 'games'">Games</button>
				</div
				><select v-model="strengthSit">
					<option value="all">All situations</option>
					<option value="ev5">5 on 5</option>
					<option value="sh">Short handed</option>
					<option value="pp">Power play</option>
				</select>
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
						<td>{{ ((tableVals.toi / (60 * data.player.gp))).toFixed(1) }} mins/game</td>
						<td>{{ data.player.gp }} games</td>
					</tr>
					<tr>
						<td>Goals and assists</td>
						<td colspan="2">{{ tableVals.ig | pluralize("goal") }}, {{ tableVals.ia1 | pluralize("primary assist") }}, {{ tableVals.ia2 | pluralize("secondary assist") }}</th>
					</tr>
					<tr>
						<td>Points</td>
						<td>{{ tableVals.p }}</td>
						<td><span v-if="tableVals.p !== 0">{{ tableVals.p_per60 | decimalPlaces(1) }} per 60</span></td>
					</tr>
					<tr>
						<td>Primary points</td>
						<td>{{ tableVals.p1 }}</td>
						<td><span v-if="tableVals.p1 !== 0">{{ tableVals.p1_per60 | decimalPlaces(1) }} per 60</span></td>
					</tr>
					<tr>
						<td>Corsi</td>
						<td>{{ tableVals.ic }}</td>
						<td><span v-if="tableVals.ic !== 0">{{ tableVals.ic_per60 | decimalPlaces(1) }} per 60</span></td>
					</tr>
					<tr>
						<td>Sh%</td>
						<td colspan="2">{{ tableVals.i_sh_pct | percentage | decimalPlaces(1) }}<span class="pct">%</span></td>
					</tr>
					<tr>
						<th colspan="3">On-ice goals</th>
					</tr>
					<tr v-if="strengthSit !== 'pp' && strengthSit !== 'sh'">
						<td>GF%</td>
						<td colspan="2">{{ tableVals.gf_pct | percentage | decimalPlaces(1) }}<span class="pct">%</span></td>
					</tr>
					<tr v-if="strengthSit !== 'pp' && strengthSit !== 'sh'">
						<td>Differential</td>
						<td>{{ tableVals.g_diff | signedDecimalPlaces(0) }}</td>
						<td><span v-if="tableVals.g_diff !== 0">{{ tableVals.g_diff_per60 | signedDecimalPlaces(1) }} per 60</span></td>
					</tr>
					<tr>
						<td>GF</td>
						<td>{{ tableVals.gf }}</td>
						<td><span v-if="tableVals.gf !== 0">{{ tableVals.gf_per60 | decimalPlaces(1) }} per 60</span></td>
					</tr>
					<tr>
						<td>GA</td>
						<td>{{ tableVals.ga }}</td>
						<td><span v-if="tableVals.ga !== 0">{{ tableVals.ga_per60 | decimalPlaces(1) }} per 60</span></td>
					</tr>
					<tr>
						<td>Sh%</td>
						<td colspan="2">{{ tableVals.sh_pct | percentage | decimalPlaces(1) }}<span class="pct">%</span></td>
					</tr>
					<tr>
						<td>Sv%</td>
						<td colspan="2">{{ tableVals.sv_pct | percentage | decimalPlaces(1) }}<span class="pct">%</span></td>
					</tr>
					<tr>
						<th colspan="3">On-ice corsi</th>
					</tr>
					<tr v-if="strengthSit !== 'pp' && strengthSit !== 'sh'">
						<td>CF%</td>
						<td colspan="2">{{ tableVals.cf_pct | percentage | decimalPlaces(1) }}<span class="pct">%</span></td>
					</tr>
					<tr v-if="strengthSit !== 'pp' && strengthSit !== 'sh'">
						<td>CF% relative</td>
						<td colspan="2">{{ tableVals.cf_pct_rel | percentage | decimalPlaces(1) }}<span class="pct">%</span></td>
					</tr>
					<tr v-if="strengthSit !== 'pp' && strengthSit !== 'sh'">
						<td>CF% score-adj</td>
						<td colspan="2">{{ tableVals.cf_pct_adj | percentage | decimalPlaces(1) }}<span class="pct">%</span></td>
					</tr>
					<tr v-if="strengthSit !== 'pp' && strengthSit !== 'sh'">
						<td>Differential</td>
						<td>{{ tableVals.c_diff | signedDecimalPlaces(0) }}</td>
						<td><span v-if="tableVals.c_diff !== 0">{{ tableVals.c_diff_per60 | signedDecimalPlaces(1) }} per 60</span></td>
					</tr>
					<tr>
						<td>CF</td>
						<td>{{ tableVals.cf }}</td>
						<td><span v-if="tableVals.cf !== 0">{{ tableVals.cf_per60 | decimalPlaces(1) }} per 60</span></td>
					</tr>
					<tr>
						<td>CA</td>
						<td>{{ tableVals.ca }}</td>
						<td><span v-if="tableVals.ca !== 0">{{ tableVals.ca_per60 | decimalPlaces(1) }} per 60</span></td>
					</tr>
				</table>
			</div>
			<div class="section section-table" v-show="tabs.active === 'lines'">
				<div class="search-with-menu" style="margin-bottom: 24px;">
					<select v-model="search.condition">
						<option value="includes">With:</option>
						<option value="excludes">Without:</option>
					</select
					><input v-model="search.query" type="text" v-on:keyup.enter="blurInput($event);">
				</div>
				<table>
					<thead>
						<tr>
							<th class="left-aligned">Linemates</th>
							<th class="left-aligned" v-if="data.player.f_or_d === 'f'"></th>
							<th
								@click="sortBy('toi')"
								@keyup.enter="sortBy('toi')"
								tabindex="0"
								v-bind:class="[ sort.col === 'toi' ? (sort.order === -1 ? 'sort-desc' : 'sort-asc') : '' ]"
							>Mins</th>
							<th
								@click="sortBy('g_diff')"
								@keyup.enter="sortBy('g_diff')"
								tabindex="0"
								v-bind:class="[ sort.col === 'g_diff' ? (sort.order === -1 ? 'sort-desc' : 'sort-asc') : '' ]"
							>Goal diff</th>
							<th
								@click="sortBy('cf_pct_adj')"
								@keyup.enter="sortBy(cf_pct_adj)"
								tabindex="0"
								v-bind:class="[ sort.col === 'cf_pct_adj' ? (sort.order === -1 ? 'sort-desc' : 'sort-asc') : '' ]"
							>CF% score-adj</th>
							<th
								@click="sortBy('cf_pct')"
								@keyup.enter="sortBy(cf_pct)"
								tabindex="0"
								v-bind:class="[ sort.col === 'cf_pct' ? (sort.order === -1 ? 'sort-desc' : 'sort-asc') : '' ]"
							>CF%</th>
							<th
								@click="sortBy('cf_per60')"
								@keyup.enter="sortBy(cf_per60)"
								tabindex="0"
								v-bind:class="[ sort.col === 'cf_per60' ? (sort.order === -1 ? 'sort-desc' : 'sort-asc') : '' ]"
							>CF/60</th>
							<th
								@click="sortBy('ca_per60')"
								@keyup.enter="sortBy(ca_per60)"
								tabindex="0"
								v-bind:class="[ sort.col === 'ca_per60' ? (sort.order === -1 ? 'sort-desc' : 'sort-asc') : '' ]"
							>CA/60</th>
						</tr>
					</thead>
					<tbody>
						<tr v-for="l in filteredLineData">
							<td class="left-aligned">{{ l.name1 }}</td>
							<td class="left-aligned" v-if="data.player.f_or_d === 'f'">{{ l.name2 }}</td>
							<td>{{ Math.round(l.toi / 60) }}</td>
							<td>{{ l.g_diff | signedDecimalPlaces(0) }}</td>
							<td>{{ l.cf_pct_adj | percentage | decimalPlaces(1) }}<span class="pct">%</span></td>
							<td>{{ l.cf_pct | percentage | decimalPlaces(1) }}<span class="pct">%</span></td>
							<td>{{ l.cf_per60 | decimalPlaces(1) }}</td>
							<td>{{ l.ca_per60 | decimalPlaces(1) }}</td>
						</tr>
						<tr v-if="filteredLineData.length === 0">
							<td v-bind:colspan="data.player.f_or_d === 'f' ? '8' : '7'">No lines with at least 5 minutes together</td>
						</tr>
					</tbody>
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
						</tr>
					</thead>
					<tbody>
						<tr v-for="r in aggregatedHistoryData">
							<td class="left-aligned">{{ r.date }}</td>
							<td class="left-aligned">{{ r.opp.toUpperCase() }}</td>
							<td class="left-aligned">{{ r.result }}</td>
							<td class="left-aligned" v-if="r.position === 'na'" colspan="9">Scratched or injured</td>
							<td class="left-aligned" v-if="r.position !== 'na'">{{ r.point_string }}</td>
							<td v-if="r.position !== 'na'">{{ Math.round(r.toi / 60) }}</td>
							<td v-if="r.position !== 'na'">{{ r.ic }}</td>
							<td v-if="r.position !== 'na'">{{ r.gf }}</td>
							<td v-if="r.position !== 'na'">{{ r.ga }}</td>
							<td v-if="r.position !== 'na'">{{ r.g_diff | signedDecimalPlaces(0) }}</td>
							<td v-if="r.position !== 'na'">{{ r.cf }}</td>
							<td v-if="r.position !== 'na'">{{ r.ca }}</td>
							<td v-if="r.position !== 'na'">{{ r.c_diff | signedDecimalPlaces(0) }}</td>
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
	data: function() {
		return {
			data: {},
			strengthSit: "ev5",
			tabs: {
				active: "lines"
			},
			sort: {
				col: "toi",
				order: -1
			},
			search: {
				col: "names",
				condition: "includes",
				query: ""
			},
			filter: {
				col: "toi",
				query: 0
			}
		}
	},
	components: {
		"bulletchart": Bulletchart
	},
	computed: {
		tableVals: function() {
			var tableData = this.data.player.data;
			if (this.strengthSit === "ev5" || this.strengthSit === "pp" || this.strengthSit === "sh") {
				var strengthSit = this.strengthSit;
				tableData = tableData.filter(function(d) { return d.strength_sit === strengthSit; });
			}
			var result = {
				ig: _.sumBy(tableData, "ig"),
				ia1: _.sumBy(tableData, "ia1"),
				ia2: _.sumBy(tableData, "ia2"),
				toi: _.sumBy(tableData, "toi"),
				p: _.sumBy(tableData, "ig") + _.sumBy(tableData, "ia1") + _.sumBy(tableData, "ia2"),
				p1: _.sumBy(tableData, "ig") + _.sumBy(tableData, "ia1"),
				ic: _.sumBy(tableData, "ic"),
				i_sh_pct: _.sumBy(tableData, "is") === 0 ?
					0 : _.sumBy(tableData, "ig") / _.sumBy(tableData, "is"),
				gf_pct: (_.sumBy(tableData, "gf") + _.sumBy(tableData, "ga")) === 0 ?
					0 : _.sumBy(tableData, "gf") / (_.sumBy(tableData, "gf") + _.sumBy(tableData, "ga")),
				g_diff: _.sumBy(tableData, "gf") - _.sumBy(tableData, "ga"),
				gf: _.sumBy(tableData, "gf"),
				ga: _.sumBy(tableData, "ga"),
				sh_pct: _.sumBy(tableData, "sf") === 0 ?
					0 : _.sumBy(tableData, "gf") / _.sumBy(tableData, "sf"),
				sv_pct: _.sumBy(tableData, "sa") === 0 ?
					0 : (1 - (_.sumBy(tableData, "ga") / _.sumBy(tableData, "sa"))),
				cf_pct: (_.sumBy(tableData, "cf") + _.sumBy(tableData, "ca")) === 0 ?
					0 : _.sumBy(tableData, "cf") / (_.sumBy(tableData, "cf") + _.sumBy(tableData, "ca")),
				cf_pct_rel: ((_.sumBy(tableData, "cf") + _.sumBy(tableData, "ca")) === 0 || (_.sumBy(tableData, "cf_off") + _.sumBy(tableData, "ca_off") === 0)) ?
					0 : (_.sumBy(tableData, "cf") / (_.sumBy(tableData, "cf") + _.sumBy(tableData, "ca"))) - (_.sumBy(tableData, "cf_off") / (_.sumBy(tableData, "cf_off") + _.sumBy(tableData, "ca_off"))),
				cf_pct_adj: (_.sumBy(tableData, "cf_adj") + _.sumBy(tableData, "ca_adj")) === 0 ?
					0 : _.sumBy(tableData, "cf_adj") / (_.sumBy(tableData, "cf_adj") + _.sumBy(tableData, "ca_adj")),
				cf: _.sumBy(tableData, "cf"),
				ca: _.sumBy(tableData, "ca"),
				c_diff: _.sumBy(tableData, "cf") - _.sumBy(tableData, "ca")
			};
			result.p_per60 = result.toi === 0 ? 0 : 60 * 60 * result.p / result.toi;
			result.p1_per60 = result.toi === 0 ? 0 : 60 * 60 * result.p1 / result.toi;
			result.ic_per60 = result.toi === 0 ? 0 : 60 * 60 * result.ic / result.toi;
			result.g_diff_per60 = result.toi === 0 ? 0 : 60 * 60 * (result.gf - result.ga) / result.toi;
			result.gf_per60 = result.toi === 0 ? 0 : 60 * 60 * result.gf / result.toi;
			result.ga_per60 = result.toi === 0 ? 0 : 60 * 60 * result.ga / result.toi;
			result.c_diff_per60 = result.toi === 0 ? 0 : 60 * 60 * (result.cf - result.ca) / result.toi;
			result.cf_per60 = result.toi === 0 ? 0 : 60 * 60 * result.cf / result.toi;
			result.ca_per60 = result.toi === 0 ? 0 : 60 * 60 * result.ca / result.toi;
			return result;
		},
		aggregatedHistoryData: function() {
			var strengthSit = this.strengthSit;
			var result = [];
			this.data.history.forEach(function(g) {
				var rows = g.data;
				if (strengthSit === "ev5" || strengthSit === "pp" || strengthSit === "sh") {
					rows = rows.filter(function(d) { return d.strength_sit === strengthSit; });
				}
				// As a temporary solution, subtract 5 hours from the UTC time to get the correct day in New_York/America
				var datetime = new Date(g.datetime);
				datetime.setHours(datetime.getHours() - 5);
				var dateString = constants.monthNames[datetime.getMonth()] + " " + datetime.getDate();
				var resultString = g.team_final > g.opp_final ? "W" : "L";
				resultString += ", " + g.team_final + "-" + g.opp_final;
				if (g.game_id < 30000 && g.periods > 3) {
					if (g.periods === 4) {
						resultString += " (OT)";
					} else if (g.periods === 5) {
						resultString += " (SO)";
					}
				}
				var resultObj = {
					position: g.position,
					team: g.team,
					opp: g.is_home ? g.opp : "@" + g.opp,
					result: resultString,
					datetime: datetime,
					date: dateString,
					ig: _.sumBy(rows, "ig"),
					ia1: _.sumBy(rows, "ia1"),
					ia2: _.sumBy(rows, "ia2"),
					toi: _.sumBy(rows, "toi"),
					ic: _.sumBy(rows, "ic"),
					gf: _.sumBy(rows, "gf"),
					ga: _.sumBy(rows, "ga"),
					g_diff: _.sumBy(rows, "gf") - _.sumBy(rows, "ga"),
					cf: _.sumBy(rows, "cf"),
					ca: _.sumBy(rows, "ca"),
					c_diff: _.sumBy(rows, "cf") - _.sumBy(rows, "ca"),
					cf_adj: _.sumBy(rows, "cf_adj"),
					ca_adj: _.sumBy(rows, "ca_adj")
				};
				// Create string to describe the player's points: 1G, 2A2
				var pointString = "";
				if (resultObj.ig > 0) {
					pointString += resultObj.ig + "G";
				}
				if (resultObj.ia1 > 0) {
					if (pointString.length > 0) {
						pointString += ", ";
					}
					pointString += resultObj.ia1 + "A¹";
				}
				if (resultObj.ia2 > 0) {
					if (pointString.length > 0) {
						pointString += ", ";
					}
					pointString += resultObj.ia2 + "A²";
				}
				resultObj.point_string = pointString;
				result.push(resultObj);
			});
			return _.orderBy(result, "datetime", "desc");
		},
		aggregatedLineData: function() {
			var lineData = this.data.lines;
			var strSit = this.strengthSit;
			var result = [];
			lineData.forEach(function(l) {
				result.push({
					names: (l.firsts[0] + " " + l.lasts[0] + " " + l.firsts[1] + " " + l.lasts[1]).toLowerCase(),
					name1: l.firsts[0] + " " + l.lasts[0],
					name2: l.firsts[1] + " " + l.lasts[1],
					toi: l[strSit].toi,
					g_diff: l[strSit].gf - l[strSit].ga,
					cf_pct: l[strSit].cf + l[strSit].ca === 0 ? 0 : l[strSit].cf / (l[strSit].cf + l[strSit].ca),
					cf_pct_adj: l[strSit].cf_adj + l[strSit].ca_adj === 0 ? 0 : l[strSit].cf_adj / (l[strSit].cf_adj + l[strSit].ca_adj),
					cf_per60: 60 * 60 * l[strSit].cf / l[strSit].toi,
					ca_per60: 60 * 60 * l[strSit].ca / l[strSit].toi
				});
			});
			return result;
		},
		sortedLineData: function() {
			var order = this.sort.order < 0 ? "desc" : "asc";
			return _.orderBy(this.aggregatedLineData, this.sort.col, order);
		},
		filteredLineData: function() {
			var query = this.search.query;
			var data = this.sortedLineData.filter(function(d) { return d.toi >= 5 * 60; });
			if (query) {
				if (this.search.condition === "includes") {
					return data.filter(function(d) { return d.names.indexOf(query) >= 0; });
				} else if (this.search.condition === "excludes") {
					return data.filter(function(d) { return d.names.indexOf(query) < 0; });
				}
			}
			return data;
		}
	},
	filters: {
		pluralize: function(value, unit) {
			if (value === 1) {
				return value + " " + unit;
			} else {
				return value + " " + unit + "s";
			}
		},
		percentage: function(value) {
			return value * 100;
		},
		decimalPlaces: function(value, places) {
			return value.toFixed(places);
		},
		signedDecimalPlaces: function(value, places) {
			return value > 0 ? "+" + value.toFixed(places) : value.toFixed(places);
		}
	},
	created: function() {
		this.fetchData();
	},
	methods: {
		fetchData: function() {
			var pId = this.$route.params.id;
			var self = this;
			var xhr = new XMLHttpRequest();
			xhr.open("GET", "./api/players/" + pId);
			xhr.onload = function() {
				self.data = JSON.parse(xhr.responseText);
			}
			xhr.send();
		},
		sortBy: function(newSortCol) {
			if (newSortCol === this.sort.col) {
				this.sort.order *= -1;
			} else {
				this.sort.col = newSortCol;
				this.sort.order = -1;
			}
		},
		blurInput: function(event) {
			event.target.blur();
		},
	}
};
</script>

<style lang="scss">

@import "../variables";

table.left-aligned th,
table.left-aligned td {
	text-align: left;
}
.section.legend {
	padding-left: 16px;
	padding-right: 16px;
}
.legend > div {
	display: inline-block;
	vertical-align: top;
	margin: 0 8px 8px 8px;
}
.legend > div > span {
	display: inline-block;
	vertical-align: top;
	font-size: $base-font-size;
	line-height: $base-line-height;
}
.legend > div > span:first-child {
	height: 12px;
	width: 12px;
	margin-top: 2px;
	margin-top: 4px;
	border-radius: $border-radius;
	margin-right: 6px;
}
</style>