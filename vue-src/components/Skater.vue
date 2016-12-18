<template>
	<div>
		<div class="loader" v-if="!data.player"></div>
		<div v-if="data.player">
			<div class="section section-header">
				<h1>{{ data.player.first + " " + data.player.last }}: 2016-2017</h1>
			</div>
			<div class="section" style="padding-left: 0; padding-right: 0; margin-bottom: 8px;">
				<bulletchart v-bind:label="'mins/game, total'" v-bind:breakpoints="data.breakpoints.all_toi.breakpoints" v-bind:point="data.breakpoints.all_toi.player" v-bind:isInverted="false"></bulletchart>
				<bulletchart v-bind:label="'score adj. CF/60, 5 on 5'" v-bind:breakpoints="data.breakpoints.ev5_cf_adj_per60.breakpoints" v-bind:point="data.breakpoints.ev5_cf_adj_per60.player" v-bind:isInverted="false"></bulletchart>
				<bulletchart v-bind:label="'score adj. CA/60, 5 on 5'" v-bind:breakpoints="data.breakpoints.ev5_ca_adj_per60.breakpoints" v-bind:point="data.breakpoints.ev5_ca_adj_per60.player" v-bind:isInverted="true"></bulletchart>
				<bulletchart v-bind:label="'P1/60, 5 on 5'" v-bind:breakpoints="data.breakpoints.ev5_p1_per60.breakpoints" v-bind:point="data.breakpoints.ev5_p1_per60.player" v-bind:isInverted="false"></bulletchart>
				<bulletchart v-bind:label="'P1/60, power play'" v-bind:breakpoints="data.breakpoints.pp_p1_per60.breakpoints" v-bind:point="data.breakpoints.pp_p1_per60.player" v-bind:isInverted="false"></bulletchart>
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
						<td colspan="2">{{ tableVals.i_sh_pct | percentage | decimalPlaces(1) }}%</td>
					</tr>
					<tr>
						<th colspan="3">On-ice goals</th>
					</tr>
					<tr v-if="strengthSit !== 'pp' && strengthSit !== 'sh'">
						<td>GF%</td>
						<td colspan="2">{{ tableVals.gf_pct | percentage | decimalPlaces(1) }}%</td>
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
						<td colspan="2">{{ tableVals.sh_pct | percentage | decimalPlaces(1) }}%</td>
					</tr>
					<tr>
						<td>Sv%</td>
						<td colspan="2">{{ tableVals.sv_pct | percentage | decimalPlaces(1) }}%</td>
					</tr>
					<tr>
						<th colspan="3">On-ice corsi</th>
					</tr>
					<tr v-if="strengthSit !== 'pp' && strengthSit !== 'sh'">
						<td>CF%</td>
						<td colspan="2">{{ tableVals.cf_pct | percentage | decimalPlaces(1) }}%</td>
					</tr>
					<tr v-if="strengthSit !== 'pp' && strengthSit !== 'sh'">
						<td>CF% relative</td>
						<td colspan="2">{{ tableVals.cf_pct_rel | percentage | decimalPlaces(1) }}%</td>
					</tr>
					<tr v-if="strengthSit !== 'pp' && strengthSit !== 'sh'">
						<td>CF% score-adj</td>
						<td colspan="2">{{ tableVals.cf_pct_adj | percentage | decimalPlaces(1) }}%</td>
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
		</div>
	</div>
</template>

<script>
var Bulletchart = require("./Bulletchart.vue");
var _ = require("lodash");
module.exports = {
	data: function() {
		return {
			data: {},
			strengthSit: "ev5"
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
		}
	}
};
</script>

<style>
select {
	margin-bottom: 16px;
}
table td,
table th {
	text-align: left;
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