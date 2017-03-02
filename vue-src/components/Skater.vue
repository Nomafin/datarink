<template>
	<div>
		<div class="loader" v-if="!data"></div>
		<div v-if="data">
			<modal v-if="isModalVisible" @close="isModalVisible = false">
				<div slot="header" class="toggle" style="margin-bottom: 0;">
					<button :class="compareSit === 'all' ? 'selected' : null" @click="compareSit = 'all'">All</button
					><button :class="compareSit === 'ev5' ? 'selected' : null" @click="compareSit = 'ev5'">5v5</button
					><button :class="compareSit === 'pp' ? 'selected' : null" @click="compareSit = 'pp'">PP</button
					><button :class="compareSit === 'sh' ? 'selected' : null" @click="compareSit = 'sh'">SH</button>
				</div>
				<div slot="body" class="tile-container">
					<div v-if="compared.length > 0" v-for="c in comparisons" class="tile">
						<table class="left-aligned barchart">
							<thead>
								<tr>
									<th colspan="2">{{ c.label }}</th>
								</tr>
							</thead>
							<tbody>
								<tr v-for="(l, idx) in compared">
									<td width="30%" class="label">{{ l.firsts[0].charAt(0) + ". " + l.lasts[0] }}<span v-if="l.firsts[1]"><br>{{ l.firsts[1].charAt(0) + ". " + l.lasts[1] }}</span></td>
									<td width="70%">
										<div v-if="c.stat === 'toi' || c.stat == 'cf_pct_adj'" class="barchart-bar">
											<span>{{ l[compareSit][c.stat].toFixed(1) }}</span>
											<div :class="'fill-' + idx" :style="{  width: c.extent[1] === 0 ? 0 : (100 * l[compareSit][c.stat] / c.extent[1]) + '%' }"></div>
										</div>
										<div v-else class="barchart-bar">
											<span>{{ l[compareSit]["toi"] === 0 ? "0.0" : (60 * l[compareSit][c.stat] / l[compareSit]["toi"]).toFixed(1) }}</span>
											<div :class="'fill-' + idx" :style="{ width: (c.extent[1] === 0 || l[compareSit]['toi'] === 0) ? 0 : 100 * ((60 * l[compareSit][c.stat] / l[compareSit]['toi']) / c.extent[1]) + '%' }"></div>
										</div>
									</td>
								</tr>
							</tbody>
						</table>
					</div>
				</div>
			</modal>
			<div class="floating-message" v-if="compared.length >= 1 && !isModalVisible">
				<p>{{ compared.length | pluralize("line") }} selected</p
				><button @click="isModalVisible = true">Compare</button>
			</div>
			<div class="section section-header">
				<h1>{{ data.player.first + " " + data.player.last }}</h1>
				<h2>2016-2017</h2>
			</div>
			<div class="loader" v-if="data && !bulletchartData"></div>
			<div v-if="bulletchartData" class="section section-tiled-charts">
				<bulletchart :label="'mins/game, total'" :data="bulletchartData.all_toi" :isInverted="false"></bulletchart
				><bulletchart :label="'score adj. CF/60, 5 on 5'" :data="bulletchartData.ev5_cf_adj_per60" :isInverted="false"></bulletchart
				><bulletchart :label="'score adj. CA/60, 5 on 5'" :data="bulletchartData.ev5_ca_adj_per60" :isInverted="true"></bulletchart
				><bulletchart :label="'P1/60, 5 on 5'" :data="bulletchartData.ev5_p1_per60" :isInverted="false"></bulletchart
				><bulletchart :label="'P1/60, power play'" :data="bulletchartData.pp_p1_per60" :isInverted="false"></bulletchart>
			</div>
			<div v-if="bulletchartData" class="section section-legend">
				<div><span :style="{ background: colours.green8 }"></span><span v-if="data.player.f_or_d === 'f'">Top 90 forwards</span><span v-if="data.player.f_or_d === 'd'">Top 60 defenders</span></div>
				<div><span :style="{ background: colours.green6 }"></span><span v-if="data.player.f_or_d === 'f'">91-180</span><span v-if="data.player.f_or_d === 'd'">61-120</span></div>
				<div><span :style="{ background: colours.green4 }"></span><span v-if="data.player.f_or_d === 'f'">181-270</span><span v-if="data.player.f_or_d === 'd'">121-180</span></div>
				<div v-if="data.player.f_or_d === 'f'"><span :style="{ background: colours.green2 }"></span><span>261-360</span></div>
			</div>
			<div class="section section-control">
				<div class="toggle">
					<button :class="tabs.active === 'games' ? 'selected' : null" @click="tabs.active = 'games'" style="padding: 0 7px 0 11px;">Games</button
					><button :class="tabs.active === 'self' ? 'selected' : null" @click="tabs.active = 'self'" style="padding: 0 7px;">Player</button
					><button :class="tabs.active === 'lines' ? 'selected' : null" @click="tabs.active = 'lines'" style="padding: 0 7px;">Lines</button
					><button :class="tabs.active === 'wowy' ? 'selected' : null" @click="tabs.active = 'wowy'" style="padding: 0 11px 0 7px;">WOWY</button>
				</div
				><div class="select-container">
					<select v-model="strengthSit">
						<option value="all">All situations</option>
						<option value="ev5">5 on 5</option>
						<option value="sh">Short handed</option>
						<option value="pp">Power play</option>
					</select>
				</div>
			</div>
			<div class="section section-tiled-charts" v-if="data.player.gp >= 3" v-show="tabs.active === 'games'" style="padding-bottom: 0;">
				<div v-if="chartData">
					<barchart :data="chartData.toi"></barchart
					><barchart :data="chartData.c_diff_adj"></barchart
					><barchart :data="chartData.cf_adj"></barchart
					><barchart :data="chartData.ca_adj"></barchart>
				</div>
			</div>
			<div class="section section-table" v-show="tabs.active === 'games'">
				<table>
					<thead>
						<tr>
							<th class="left-aligned">Date</th>
							<th class="left-aligned">Team</th>
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
							<th>C diff score-adj</th>
						</tr>
					</thead>
					<tbody>
						<tr v-for="g in data.history">
							<td class="left-aligned">{{ g.date }}</td>
							<td class="left-aligned">{{ g.team.toUpperCase() }}</td>
							<td class="left-aligned">{{ g.opp.toUpperCase() }}</td>
							<td class="left-aligned">{{ g.result }}</td>
							<td class="left-aligned" v-if="g.position === 'na'" colspan="10">Scratched or injured</td>
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
			<div class="section section-table" v-show="tabs.active === 'lines'">
				<div class="loader" v-if="data && !lineData"></div>
				<div v-if="lineData" class="search-with-menu" style="margin-bottom: 24px;">
					<div class="select-container">
						<select v-model="lineSearch.condition">
							<option value="includes">With</option>
							<option value="excludes">Without</option>
						</select>
					</div
					><input v-model="lineSearch.query" type="text" @keyup.enter="blurInput($event);">
				</div>
				<table v-if="lineData">
					<thead>
						<tr>
							<th class="left-aligned">Compare</th>
							<th class="left-aligned">Linemates</th>
							<th class="left-aligned" v-if="data.player.f_or_d === 'f'"></th>
							<th @click="sortLinesBy('toi')" @keyup.enter="sortLinesBy('toi')" tabindex="0"
								:class="[ lineSort.col === 'toi' ? (lineSort.order === -1 ? 'sort-desc' : 'sort-asc') : null ]"
							>Mins</th>
							<th @click="sortLinesBy('g_diff')" @keyup.enter="sortLinesBy('g_diff')" tabindex="0"
								:class="[ lineSort.col === 'g_diff' ? (lineSort.order === -1 ? 'sort-desc' : 'sort-asc') : null ]"
							>Goal diff</th>
							<th @click="sortLinesBy('cf_pct_adj')" @keyup.enter="sortLinesBy(cf_pct_adj)" tabindex="0"
								:class="[ lineSort.col === 'cf_pct_adj' ? (lineSort.order === -1 ? 'sort-desc' : 'sort-asc') : null ]"
							>CF% score-adj</th>
							<th @click="sortLinesBy('cf')" @keyup.enter="sortLinesBy(cf)" tabindex="0"
								:class="[ lineSort.col === 'cf' ? (lineSort.order === -1 ? 'sort-desc' : 'sort-asc') : null ]"
							>CF/60 score-adj</th>
							<th @click="sortLinesBy('ca')" @keyup.enter="sortLinesBy(ca)" tabindex="0"
								:class="[ lineSort.col === 'ca' ? (lineSort.order === -1 ? 'sort-desc' : 'sort-asc') : null ]"
							>CA/60 score-adj</th>
						</tr>
					</thead>
					<tbody>
						<tr v-for="l in filteredLines">
							<td class="left-aligned">
								<input tabindex="-1" :id="l.line_id" type="checkbox" :checked="compared.map(function(d) { return d.line_id; }).indexOf(l.line_id) >= 0" @click="updateComparisonList(l)">
								<label tabindex="0" :for="l.line_id" class="checkbox-container">
									<span class="checkbox-checkmark">
								</label>
							</td>
							<td class="left-aligned">{{ l.firsts[0] + " " + l.lasts[0] }}</td>
							<td class="left-aligned" v-if="data.player.f_or_d === 'f'">{{ l.firsts[1] + " " + l.lasts[1] }}</td>
							<td>{{ Math.round(l[strengthSit].toi) }}</td>
							<td>{{ l[strengthSit].g_diff | signed }}</td>
							<td>{{ l[strengthSit].cf_pct_adj | percentage(false) }}<span class="pct">%</span></td>
							<td>{{ l[strengthSit].cf_adj | rate(true, l[strengthSit].toi, false) }}</td>
							<td>{{ l[strengthSit].ca_adj | rate(true, l[strengthSit].toi, false) }}</td>
						</tr>
						<tr v-if="filteredLines.length === 0">
							<td class="left-aligned" :colspan="data.player.f_or_d === 'f' ? '8' : '7'">No lines with at least 10 minutes together</td>
						</tr>
					</tbody>
				</table>
			</div>
			<div class="section section-table" v-show="tabs.active === 'wowy'">
				<div class="loader" v-if="data && !lineData"></div>
				<div v-if="lineData" class="toggle" style="margin-bottom: 24px;">
					<button :class="wowyStat === 'cf_pct_adj' ? 'selected' : null" @click="wowyStat = 'cf_pct_adj'">CF%</button
					><button :class="wowyStat === 'cf_per_60' ? 'selected' : null" @click="wowyStat = 'cf_per_60'">CF/60</button
					><button :class="wowyStat === 'ca_per_60' ? 'selected' : null" @click="wowyStat = 'ca_per_60'">CA/60</button>
				</div>
				<table v-if="lineData">
					<thead>
						<tr>
							<th class="left-aligned" rowspan="2">Linemate</th>
							<th style="border-bottom: 0;">Together</th>
							<th class="left-aligned" style="border-bottom: 0;"></th>
							<th style="border-bottom: 0;">Linemate w/o {{ data.player.last }}</th>
							<th class="left-aligned" style="border-bottom: 0;"></th>
							<th style="border-bottom: 0;">{{ data.player.last }} w/o linemate</th>
							<th class="left-aligned" style="border-bottom: 0;"></th>
						</tr>
						<tr>
							<th @click="sortWowyBy('together', wowyStat)" @keyup.enter="sortWowyBy('together', wowyStat)" tabindex="0"
								:class="[ wowySort.context === 'together' && wowySort.col === wowyStat ? (wowySort.order === -1 ? 'sort-desc' : 'sort-asc') : null ]"
								style="border-top: 0;">{{ wowyStat === "cf_pct_adj" ? "CF%" : wowyStat === "cf_per_60" ? "CF/60" : "CA/60" }} score-adj</th>
							<th @click="sortWowyBy('together', 'toi')" @keyup.enter="sortWowyBy('together', 'toi')" tabindex="0"
								:class="[ wowySort.context === 'together' && wowySort.col === 'toi' ? (wowySort.order === -1 ? 'sort-desc' : 'sort-asc') : null ]"
								class="left-aligned" style="font-weight: 400; border-top: 0;">Mins</th>
							<th @click="sortWowyBy('mate_only', wowyStat)" @keyup.enter="sortWowyBy('mate_only', wowyStat)" tabindex="0"
								:class="[ wowySort.context === 'mate_only' && wowySort.col === wowyStat ? (wowySort.order === -1 ? 'sort-desc' : 'sort-asc') : null ]"
								style="border-top: 0;">{{ wowyStat === "cf_pct_adj" ? "CF%" : wowyStat === "cf_per_60" ? "CF/60" : "CA/60" }} score-adj</th>
							<th @click="sortWowyBy('mate_only', 'toi')" @keyup.enter="sortWowyBy('mate_only', 'toi')" tabindex="0"
								:class="[ wowySort.context === 'mate_only' && wowySort.col === 'toi' ? (wowySort.order === -1 ? 'sort-desc' : 'sort-asc') : null ]"
								class="left-aligned" style="font-weight: 400; border-top: 0;">Mins</th>
							<th @click="sortWowyBy('self_only', wowyStat)" @keyup.enter="sortWowyBy('self_only', wowyStat)" tabindex="0"
								:class="[ wowySort.context === 'self_only' && wowySort.col === wowyStat ? (wowySort.order === -1 ? 'sort-desc' : 'sort-asc') : null ]"
								style="border-top: 0;">{{ wowyStat === "cf_pct_adj" ? "CF%" : wowyStat === "cf_per_60" ? "CF/60" : "CA/60" }} score-adj</th>
							<th @click="sortWowyBy('self_only', 'toi')" @keyup.enter="sortWowyBy('self_only', 'toi')" tabindex="0"
								:class="[ wowySort.context === 'self_only' && wowySort.col === 'toi' ? (wowySort.order === -1 ? 'sort-desc' : 'sort-asc') : null ]"
								class="left-aligned" style="font-weight: 400; border-top: 0;">Mins</th>
						</tr>
					</thead>
					<tbody>
						<tr v-for="w in filteredWowy">
							<td class="left-aligned">{{ w.first + " " + w.last }}</td>
							<td class="delta">{{ w.together[strengthSit][wowyStat] | percentage(false) }}<span v-if="wowyStat === 'cf_pct_adj'" class="pct">%</span></td>
							<td class="left-aligned toi">{{ Math.round(w.together[strengthSit].toi) }}</td>
							<td class="delta"
								:class="
									w.mate_only[strengthSit][wowyStat] - w.together[strengthSit][wowyStat] > 0 ? 'increase' :
									w.mate_only[strengthSit][wowyStat] - w.together[strengthSit][wowyStat] < 0 ? 'decrease' : null"
								>{{ (w.mate_only[strengthSit][wowyStat] - w.together[strengthSit][wowyStat]) | percentage(true) }}<span v-if="wowyStat === 'cf_pct_adj'" class="pct">%</span></td>
							<td class="left-aligned toi">{{ Math.round(w.mate_only[strengthSit].toi) }}</td>
							<td class="delta"
								:class="
									w.self_only[strengthSit][wowyStat] - w.together[strengthSit][wowyStat] > 0 ? 'increase' :
									w.self_only[strengthSit][wowyStat] - w.together[strengthSit][wowyStat] < 0 ? 'decrease' : null"
								>{{ (w.self_only[strengthSit][wowyStat] - w.together[strengthSit][wowyStat]) | percentage(true) }}<span v-if="wowyStat === 'cf_pct_adj'" class="pct">%</span></td>
							<td class="left-aligned toi">{{ Math.round(w.self_only[strengthSit].toi) }}</td>
						</tr>
						<tr v-if="filteredWowy.length === 0">
							<td class="left-aligned" colspan="7">No combinations with at least 10 minutes together</td>
						</tr>
					</tbody>
				</table>
			</div>
		</div>
	</div>
</template>

<script>
var Bulletchart = require("./Bulletchart.vue");
var Barchart = require("./Barchart.vue");
var Modal = require("./Modal.vue");
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
			wowyStat: "cf_pct_adj",
			wowySort: { context: "together", col: "toi", order: -1 },
			lineSort: { col: "toi", order: -1 },
			lineSearch: { col: "names", condition: "includes", query: "" },
			isModalVisible: false,
			compareSit: "ev5",
			compared: []
		};
	},
	components: {
		"bulletchart": Bulletchart,
		"barchart": Barchart,
		"modal": Modal,
	},
	watch: {
		strengthSit: function() {
			this.compareSit = this.strengthSit;
		},
		isModalVisible: function() {
			document.body.style.overflow = this.isModalVisible ? "hidden" : "auto";
		}
	},
	computed: {
		comparisons: function() {
			var comparisons = [
				{ stat: "toi", label: "Minutes", extent: [] },
				{ stat: "cf_pct_adj", label: "Corsi-for percentage, score-adj.", extent: [] },
				{ stat: "cf_adj", label: "Corsi-for per 60 mins, score-adj.", extent: [] },
				{ stat: "ca_adj", label: "Corsi-against per 60 mins, score-adj.", extent: [] }
			];
			var lines = this.compared;
			var sit = this.compareSit;
			comparisons.forEach(function(c) {
				var vals;
				if (c.stat === "toi" || c.stat === "cf_pct_adj") {
					vals = lines.map(function(l) { return l[sit][c.stat]; });
				} else {
					vals = lines.map(function(l) { return 60 * l[sit][c.stat] / l[sit]["toi"]; });
				}
				c.extent = [0, _.max(vals)];
			});
			return comparisons;
		},
		sortedLines: function() {
			var col = this.lineSort.col;
			var order = this.lineSort.order < 0 ? "desc" : "asc";
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
			var query = this.lineSearch.query.toLowerCase();
			var sit = this.strengthSit;
			var data = this.sortedLines.filter(function(d) { return d[sit].toi >= 5; });
			if (query) {
				if (this.lineSearch.condition === "includes") {
					data = data.filter(function(d) { return (d.name1.indexOf(query) >= 0 || d.name2.indexOf(query) >= 0); });
				} else if (this.lineSearch.condition === "excludes") {
					data = data.filter(function(d) { return d.name1.indexOf(query) < 0 && d.name2.indexOf(query) < 0; });
				}
			}
			return data;
		},
		sortedWowy: function() {
			var context = this.wowySort.context;
			var col = this.wowySort.col;
			var order = this.wowySort.order < 0 ? "desc" : "asc";
			var sit = this.strengthSit;
			if (context === "together") {
				return _.orderBy(this.lineData.wowy, function(p) { return p[context][sit][col]; }, order);
			} else {
				return _.orderBy(this.lineData.wowy, function(p) { return p[context][sit][col] - p["together"][sit][col]; }, order);
			}
		},
		filteredWowy: function() {
			var sit = this.strengthSit;
			return this.sortedWowy.filter(function(d) { return d["together"][sit]["toi"] >= 5; });
		},
		chartData: function() {
			var obj = {
				"toi": { stat: "toi", title: "Minutes", values: [], extent: [] },
				"c_diff_adj": { stat: "c_diff_adj", title: "Corsi differential, score-adj.", values: [], extent: [] },
				"cf_adj": { stat: "cf_adj", title: "Corsi-for per 60 mins, score-adj.", values: [], extent: [] },
				"ca_adj": { stat: "ca_adj", title: "Corsi-against per 60 mins, score-adj.", values: [], extent: [] }
			}
			var data = this.data.history;
			var sit = this.strengthSit;
			Object.keys(obj).forEach(function(s) {
				// Get values
				if (s === "c_diff_adj") {
					obj[s].values = data.map(function(g) { return g.stats[sit].cf_adj - g.stats[sit].ca_adj; });
				} else if (s === "cf_adj" || s === "ca_adj") {
					obj[s].values = data.map(function(g) { return g.stats[sit].toi === 0 ? 0 : 60 * g.stats[sit][s] / g.stats[sit].toi; });
				} else {
					obj[s].values = data.map(function(g) { return g.stats[sit][s]; });
				}
				// Games were originally sorted from most recent to oldest, so reverse the values (without modifying the original data)
				obj[s].values.reverse();
				// Get extent
				var extent = [_.min(obj[s].values), _.max(obj[s].values)];
				obj[s].extent = [_.min([0, extent[0]]), _.max([0, extent[1]])];
			});
			// Make the cf_adj and ca_adj extents equivalent
			var max = _.max([obj.cf_adj.extent[1], obj.ca_adj.extent[1]]);
			obj.cf_adj.extent[1] = max;
			obj.ca_adj.extent[1] = max;
			return obj;
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
		this.fetchData(); // Fetch initial data - it's callback will fetch breakpoint data, whose callback will fetch line data
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
					var cfPctOff = s.cf_off + s.ca_off === 0 ? 0 : 100 * s.cf_off / (s.cf_off + s.ca_off);
					s.cf_pct_rel = s.cf_pct - cfPctOff;
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
				self.fetchBreakpointData(); // Fetch breakpoint data after initial data is loaded
			}
			xhr.send();
		},
		fetchLineData: function() {
			var self = this;
			var xhr = new XMLHttpRequest();
			xhr.open("GET", "./api/lines/" + this.pId);
			xhr.onload = function() {
				self.lineData = JSON.parse(xhr.responseText);
				// Process/append additional stats for the player's lines
				self.lineData.lines.forEach(function(l) {
					l.line_id = l.player_ids.toString().replace(/,/g , "");
					l.name1 = (l.firsts[0] + " " + l.lasts[0]).toLowerCase();
					if (!l.firsts[1]) {
						l.firsts[1] = "";
						l.lasts[1] = "";
					}
					l.name2 = (l.firsts[1] + " " + l.lasts[1]).toLowerCase();
					["all", "ev5", "pp", "sh"].forEach(function(strSit) {
						var s = l[strSit];
						s.toi /= 60;
						s.g_diff = s.gf - s.ga;
						s.cf_pct_adj = s.cf_adj + s.ca_adj === 0 ? 0 : 100 * s.cf_adj / (s.cf_adj + s.ca_adj);
					});
				});
				// Process/append additional stats for the player's wowy stats
				self.lineData.wowy.forEach(function(w) {
					["together", "mate_only", "self_only"].forEach(function(context) {
						["all", "ev5", "pp", "sh"].forEach(function(strSit) {
							var obj = w[context][strSit];
							obj.toi /= 60;
							obj.cf_pct_adj = obj.cf_adj + obj.ca_adj === 0 ? 0 : 100 * obj.cf_adj / (obj.cf_adj + obj.ca_adj);
							obj.cf_per_60 = 60 * obj.cf_adj / obj.toi;
							obj.ca_per_60 = 60 * obj.ca_adj / obj.toi;
						});
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
				self.fetchLineData(); // Fetch line data after breakpoint data is loaded
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
		sortLinesBy: function(newSortCol) {
			this.lineSort.order = newSortCol === this.lineSort.col ? -this.lineSort.order : -1;
			this.lineSort.col = newSortCol;
		},
		sortWowyBy: function(newSortContext, newSortCol) {
			if (this.wowySort.context !== newSortContext) {
				// If a new context is sorted, then sort the clicked column in descending order
				this.wowySort.context = newSortContext;
				this.wowySort.col = newSortCol;
				this.wowySort.order = -1;
			} else {
				this.wowySort.order = newSortCol === this.wowySort.col ? -this.wowySort.order : -1;
				this.wowySort.col = newSortCol;
			}
		},
		updateComparisonList: function(l) {
			// 'l' is a line object
			if (_.find(this.compared, function(d) { return d.line_id === l.line_id; })) {
				this.compared = this.compared.filter(function(d) { return d.line_id !== l.line_id; });
			} else {
				this.compared.push(l);
			}
		},
		blurInput: function(event) {
			event.target.blur();
		}
	}
};
</script>

<style lang="scss">

@import "../variables";

td.delta {
	font-weight: 700;
}

td.increase {
	color: $green8;
}

td.decrease {
	color: #cc4c02;
}

td.toi {
	color: $gray6;
}
</style>
