<template>
	<div>
		<div class="loader" v-if="!data.player"></div>
		<div v-if="data.player">
			<div class="section section-header">
				<h1>{{ data.player.first + " " + data.player.last }}: 2016-2017</h1>
			</div>
			<div class="section" style="padding-left: 0; padding-right: 0; margin-bottom: 8px;">
				<bullet-chart v-bind:label="'mins/game, total'" v-bind:breakpoints="data.breakpoints.all_toi.breakpoints" v-bind:point="data.breakpoints.all_toi.player" v-bind:isInverted="false"></bullet-chart>
				<bullet-chart v-bind:label="'score adj. CF/60, 5 on 5'" v-bind:breakpoints="data.breakpoints.ev5_cf_adj_per60.breakpoints" v-bind:point="data.breakpoints.ev5_cf_adj_per60.player" v-bind:isInverted="false"></bullet-chart>
				<bullet-chart v-bind:label="'score adj. CA/60, 5 on 5'" v-bind:breakpoints="data.breakpoints.ev5_ca_adj_per60.breakpoints" v-bind:point="data.breakpoints.ev5_ca_adj_per60.player" v-bind:isInverted="true"></bullet-chart>
				<bullet-chart v-bind:label="'P1/60, 5 on 5'" v-bind:breakpoints="data.breakpoints.ev5_p1_per60.breakpoints" v-bind:point="data.breakpoints.ev5_p1_per60.player" v-bind:isInverted="false"></bullet-chart>
				<bullet-chart v-bind:label="'P1/60, power play'" v-bind:breakpoints="data.breakpoints.pp_p1_per60.breakpoints" v-bind:point="data.breakpoints.pp_p1_per60.player" v-bind:isInverted="false"></bullet-chart>
			</div>
			<div class="section legend" v-if="data.player.f_or_d === 'f'">
				<div><span style="background: #209767;"></span><span>Top 90 forwards</span></div>
				<div><span style="background: #59ad85;"></span><span>91-180</span></div>
				<div><span style="background: #84c2a3;"></span><span>181-270</span></div>
				<div><span style="background: #add7c2;"></span><span>261-360</span></div>
				<div><span style="background: #d6ece3;"></span><span>361+</span></div>
			</div>
			<div class="section legend" v-if="data.player.f_or_d === 'd'">
				<div><span style="background: #209767;"></span><span>Top 60 defenders</span></div>
				<div><span style="background: #59ad85;"></span><span>61-120</span></div>
				<div><span style="background: #84c2a3;"></span><span>121-180</span></div>
				<div><span style="background: #add7c2;"></span><span>181+</span></div>
			</div>
			<div class="section">
				<select v-model="strengthSit">
					<option value="all">All situations</option>
					<option value="ev5">5 on 5</option>
					<option value="sh">Short handed</option>
					<option value="pp">Power play</option>
				</select>
				<table>
					<thead>
						<tr>
							<th>Own production</th>
							<th colspan="2">{{ tableVals.ig }} G, {{ tableVals.ia1 }} A1, {{ tableVals.ia2 }} A2</th>
						</tr>
					</thead>
					<tr>
						<td>Games played</td>
						<td>{{ data.player.gp }}</td>
						<td>{{ (tableVals.toi / (60 * data.player.gp)).toFixed(1) }} mins/game</td>
					</tr>
					<tr>
						<td>Points</td>
						<td>{{ tableVals.p }}</td>
						<td>{{ tableVals.p_per60 }} per 60</td>
					</tr>
					<tr>
						<td>Primary points</td>
						<td>{{ tableVals.p1 }}</td>
						<td>{{ tableVals.p1_per60 }} per 60</td>
					</tr>
					<tr>
						<td>Corsi</td>
						<td>{{ tableVals.ic }}</td>
						<td>{{ tableVals.ic_per60 }} per 60</td>
					</tr>
					<tr>
						<td>Sh%</td>
						<td colspan="2">{{ tableVals.i_sh_pct }}%</td>
					</tr>
					<tr>
						<th colspan="3">On-ice goals</th>
					</tr>
					<tr v-if="strengthSit !== 'pp' && strengthSit !== 'sh'">
						<td>GF%</td>
						<td colspan="2">{{ tableVals.gf_pct }}%</td>
					</tr>
					<tr v-if="strengthSit !== 'pp' && strengthSit !== 'sh'">
						<td>Differential</td>
						<td>{{ tableVals.g_diff | signed }}</td>
						<td>{{ tableVals.g_diff_per60 | signed }} per 60</td>
					</tr>
					<tr>
						<td>GF</td>
						<td>{{ tableVals.gf }}</td>
						<td>{{ tableVals.gf_per60 }} per 60</td>
					</tr>
					<tr>
						<td>GA</td>
						<td>{{ tableVals.ga }}</td>
						<td>{{ tableVals.ga_per60 }} per 60</td>
					</tr>
					<tr>
						<td>Sh%</td>
						<td colspan="2">{{ tableVals.sh_pct }}%</td>
					</tr>
					<tr>
						<td>Sv%</td>
						<td colspan="2">{{ tableVals.sv_pct }}%</td>
					</tr>
					<tr>
						<th colspan="3">On-ice corsi</th>
					</tr>
					<tr v-if="strengthSit !== 'pp' && strengthSit !== 'sh'">
						<td>CF%</td>
						<td colspan="2">{{ tableVals.cf_pct }}%</td>
					</tr>
					<tr v-if="strengthSit !== 'pp' && strengthSit !== 'sh'">
						<td>CF% relative</td>
						<td colspan="2">{{ tableVals.cf_pct_rel | signed }}%</td>
					</tr>
					<tr v-if="strengthSit !== 'pp' && strengthSit !== 'sh'">
						<td>CF% score-adj</td>
						<td colspan="2">{{ tableVals.cf_pct_adj }}%</td>
					</tr>
					<tr v-if="strengthSit !== 'pp' && strengthSit !== 'sh'">
						<td>Differential</td>
						<td>{{ tableVals.c_diff | signed }}</td>
						<td>{{ tableVals.c_diff_per60 | signed }} per 60</td>
					</tr>
					<tr>
						<td>CF</td>
						<td>{{ tableVals.cf }}</td>
						<td>{{ tableVals.cf_per60 }} per 60</td>
					</tr>
					<tr>
						<td>CA</td>
						<td>{{ tableVals.ca }}</td>
						<td>{{ tableVals.ca_per60 }} per 60</td>
					</tr>
				</table>
			</div>
		</div>
	</div>
</template>

<style>
	select {
		margin-bottom: 16px;
	}
	table td,
	table th {
		text-align: left;
	}
	.bullet-chart-container {
		display: inline-block;
		vertical-align: top;
		margin: 0 24px 24px 24px;
		width: 272px;
		position: relative;
	}
	.bullet-chart-container .chart {
		position: relative;
		height: 32px;
	}
	.bullet-chart-container .chart .ranges > div {
		height: 16px;
		margin-top: 8px;
		display: inline-block;
		vertical-align: top;
	}
	.bullet-chart-container .chart .ranges > div:first-child {
		border-top-left-radius: 4px;
		border-bottom-left-radius: 4px;
	}
	.bullet-chart-container .chart .ranges > div:last-child {
		border-top-right-radius: 4px;
		border-bottom-right-radius: 4px;
	}
	.bullet-chart-container .chart .marker {
		position: absolute;
		height: 100%;
		width: 2px;
		background: #121818;
		top: 0;
	}
	.bullet-chart-container .axis {
		width: 100%;
		position: relative;
	}
	.bullet-chart-container .axis span {
		display: inline-block;
		vertical-align: top;
		font-size: 12px;
		line-height: 16px;
		width: 50%;
	}
	.bullet-chart-container .axis span:last-child {
		text-align: right;
	}
	.bullet-chart-container .title {
		font-size: 22px;
		font-weight: 700;
		line-height: 24px;
	}
	.bullet-chart-container .title span:last-child {
		font-weight: 400;
		font-size: 14px;
		margin-left: 6px;
	}
	.section.legend {
		padding-left: 16px;
		padding-right: 16px;
		padding-bottom: 39px;
		border-bottom: 1px solid #e0e2e2;
		margin-bottom: 48px;
	}
	.legend > div {
		display: inline-block;
		vertical-align: top;
		margin: 0 8px 8px 8px;
	}
	.legend > div > span {
		display: inline-block;
		vertical-align: top;
		font-size: 14px;
		line-height: 16px;
	}
	.legend > div > span:first-child {
		height: 12px;
		width: 12px;
		margin-top: 2px;
		border-radius: 4px;
		margin-right: 6px;
	}
</style>

<script>
var _ = require("lodash");

var BulletChart = {
	props: ["label", "breakpoints", "point", "isInverted"],
	computed: {
		ranges: function() {
			var self = this;
			var ranges = [];
			// Get width
			self.breakpoints.forEach(function(p, i) {
				var delta = i === self.breakpoints.length - 1 ? p : p - self.breakpoints[i + 1];
				ranges.push({ width: 100 * delta / self.breakpoints[0] });
			});
			// Get colour
			var colours = ["#209767", "#59ad85", "#84c2a3", "#add7c2", "#d6ece3"];	// Listed from dark to light
			colours = colours.slice(0, ranges.length);
			if (self.isInverted) {
				colours.reverse();
			}
			ranges.forEach(function(r, i) {
				r.colour = colours[i];
			});
			return ranges.reverse();
		},
		markerPos: function() {
			return 100 * this.point / this.breakpoints[0];
		},
		axisTicks: function() {
			var ticks = [0, Math.round(_.max(this.breakpoints))];
			if (this.label === "mins/game, total") {
				ticks[1] = Math.round(ticks[1] / 60);
			}
			return ticks;
		},
		titleVal: function() {
			if (this.label === "mins/game, total") {
				return (this.point / 60).toFixed(1);
			} else {
				return this.point.toFixed(1);
			}
		}
	},
	template:
		"<div class='bullet-chart-container'>"
			+ "<div class='title'><span>{{ titleVal }}</span><span>{{ label }}</span></div>"
			+ "<div class='chart'>"
				+ "<div class='ranges'>"
					+ "<div v-for='(r, i) in ranges' v-bind:style='{ width: r.width + \"%\", background: r.colour }'></div>"
				+ "</div>"
				+ "<div v-if='markerPos <= 100' v-bind:style='{ left: \"calc(\" + markerPos + \"% - 1px)\" }' class='marker'></div>"
			+ "</div>"
			+ "<div class='axis'>"
				+ "<span>{{ axisTicks[0] }}</span><span>{{ axisTicks[1] }}</span>"
			+ "</div>"
		+ "</div>"
};

module.exports = {
	data: function() {
		return {
			data: {},
			strengthSit: "ev5"
		}
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
				i_sh_pct: _.sumBy(tableData, "is") === 0 ? 0 : (100 * _.sumBy(tableData, "ig") / _.sumBy(tableData, "is")).toFixed(1),
				gf_pct: (_.sumBy(tableData, "gf") +  _.sumBy(tableData, "ga")) === 0 ? 0 : (100 * _.sumBy(tableData, "gf") / (_.sumBy(tableData, "gf") +  _.sumBy(tableData, "ga"))).toFixed(1),
				g_diff: _.sumBy(tableData, "gf") - _.sumBy(tableData, "ga"),
				gf: _.sumBy(tableData, "gf"),
				ga: _.sumBy(tableData, "ga"),
				sh_pct: _.sumBy(tableData, "sf") === 0 ? 0 : (100 * _.sumBy(tableData, "ga") / _.sumBy(tableData, "sf")).toFixed(1),
				sv_pct: _.sumBy(tableData, "sa") === 0 ? 0 : (100 * _.sumBy(tableData, "ga") / _.sumBy(tableData, "sa")).toFixed(1),
				cf_pct: (_.sumBy(tableData, "cf") +  _.sumBy(tableData, "ca")) === 0 ?
					0 : (100 * _.sumBy(tableData, "cf") / (_.sumBy(tableData, "cf") +  _.sumBy(tableData, "ca"))).toFixed(1),
				cf_pct_rel: ((_.sumBy(tableData, "cf") +  _.sumBy(tableData, "ca")) === 0 || (_.sumBy(tableData, "cf_off") +  _.sumBy(tableData, "ca_off") === 0)) ?
					0 : (_.sumBy(tableData, "cf") / (_.sumBy(tableData, "cf") +  _.sumBy(tableData, "ca"))) - (_.sumBy(tableData, "cf_off") / (_.sumBy(tableData, "cf_off") +  _.sumBy(tableData, "ca_off"))),
				cf_pct_adj: (_.sumBy(tableData, "cf_adj") +  _.sumBy(tableData, "ca_adj")) === 0 ?
					0 : (100 * _.sumBy(tableData, "cf_adj") / (_.sumBy(tableData, "cf_adj") +  _.sumBy(tableData, "ca_adj"))).toFixed(1),
				cf: _.sumBy(tableData, "cf"),
				ca: _.sumBy(tableData, "ca"),
				c_diff:  _.sumBy(tableData, "cf") -  _.sumBy(tableData, "ca")
			};
			result.p_per60 = result.toi === 0 ? 0 : Math.round(10 * 60 * 60 * result.p / result.toi) / 10;
			result.p1_per60 = result.toi === 0 ? 0 : Math.round(10 * 60 * 60 * result.p1 / result.toi) / 10;
			result.ic_per60 = result.toi === 0 ? 0 : Math.round(10 * 60 * 60 * result.ic / result.toi) / 10;
			result.g_diff_per60 = result.toi === 0 ? 0 : Math.round(10 * 60 * 60 * (result.gf - result.ga) / result.toi) / 10;
			result.gf_per60 = result.toi === 0 ? 0 : Math.round(10 * 60 * 60 * result.gf / result.toi) / 10;
			result.ga_per60 = result.toi === 0 ? 0 : Math.round(10 * 60 * 60 * result.ga / result.toi) / 10;
			result.c_diff_per60 = result.toi === 0 ? 0 : Math.round(10 * 60 * 60 * (result.cf - result.ca) / result.toi) / 10;
			result.cf_per60 = result.toi === 0 ? 0 : Math.round(10 * 60 * 60 * result.cf / result.toi) / 10;
			result.ca_per60 = result.toi === 0 ? 0 : Math.round(10 * 60 * 60 * result.ca / result.toi) / 10;
			result.cf_pct_rel = Math.round(result.cf_pct_rel * 1000) / 10;
			return result;
		}
	},
	filters: {
		signed: function(value) {
			return value > 0 ? "+" + value : value;
		}
	},
	created: function() {
		this.fetchData();
	},
	components: {
		"bullet-chart": BulletChart		
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
		}
	}
};
</script>