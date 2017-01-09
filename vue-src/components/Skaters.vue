<template>
	<div>
		<div class="modal" v-show="isModalVisible">
			<div class="section section-modal-header">
				<div class="toggle" style="margin-bottom: 0;">
					<button :class="compareSit === 'all' ? 'selected' : null" @click="compareSit = 'all'">All</button
					><button :class="compareSit === 'ev5' ? 'selected' : null" @click="compareSit = 'ev5'">5v5</button
					><button :class="compareSit === 'pp' ? 'selected' : null" @click="compareSit = 'pp'">PP</button
					><button :class="compareSit === 'sh' ? 'selected' : null" @click="compareSit = 'sh'">SH</button>
				</div>
				<button class="close-button" @click="isModalVisible = false">
					<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 16 16"><path d="M7,9,2,14,0,12,5,7,0,2,2,0,7,5l5-5,2,2L9,7l5,5-2,2Z" transform="translate(1 1)"/></svg>					
				</button>
			</div>
			<div class="tile-container">
				<p v-if="compared.length === 0" class="tile" style="text-align: center; width: 100%; padding: 80px 0;">Select some skaters to compare</p>
				<div v-if="compared.length > 0" v-for="c in comparisons" class="tile">
					<table class="left-aligned barchart">
						<thead>
							<tr>
								<th colspan="2">{{ c.label }}</th>
							</tr>
						</thead>
						<tbody>
							<tr v-for="(p, idx) in compared">
								<td width="10%">{{ p.first + " " + p.last }}</td>
								<td width="90%">
									<div v-if="c.stat === 'toi_per_gp' || c.stat == 'cf_pct_adj'" class="barchart-bar">
										<span>{{ p.stats[compareSit][c.stat].toFixed(1) }}</span>
										<div :class="'fill-' + idx" :style="{  width: c.extent[1] === 0 ? 0 : (100 * p.stats[compareSit][c.stat] / c.extent[1]) + '%' }"></div>
									</div>
									<div v-else-if="c.stat === 'ip'" class="barchart-bar">
										<span>{{ p.stats[compareSit]["toi"] === 0 ? "0.0" : (60 * p.stats[compareSit][c.stat] / p.stats[compareSit]["toi"]).toFixed(1) }}</span>
										<div :class="'fill-' + idx" :style="{ width: (c.extent[1] === 0 || p.stats[compareSit]['toi'] === 0) ? 0 : 100 * ((60 * p.stats[compareSit]['ip1'] / p.stats[compareSit]['toi']) / c.extent[1]) + '%' }"></div
										><div :class="'fill-' + idx" :style="{ width: (c.extent[1] === 0 || p.stats[compareSit]['toi'] === 0) ? 0 : 100 * ((60 * p.stats[compareSit]['ia2'] / p.stats[compareSit]['toi']) / c.extent[1]) + '%' }"></div>
									</div>
									<div v-else class="barchart-bar">
										<span>{{ p.stats[compareSit]["toi"] === 0 ? "0.0" : (60 * p.stats[compareSit][c.stat] / p.stats[compareSit]["toi"]).toFixed(1) }}</span>
										<div :class="'fill-' + idx" :style="{ width: (c.extent[1] === 0 || p.stats[compareSit]['toi'] === 0) ? 0 : 100 * ((60 * p.stats[compareSit][c.stat] / p.stats[compareSit]['toi']) / c.extent[1]) + '%' }"></div>
									</div>
								</td>
							</tr>
							<tr v-if="c.stat === 'ip'">
								<td colspan="2" style="border: none; font-size: 12px; text-align: right;">Lighter areas are secondary assists</td>
							</tr>
						</tbody>
					</table>
				</div>
			</div>
		</div>
		<div class="modal-mask" v-show="isModalVisible" @click="isModalVisible = false"></div>
		<div class="floating-message" v-if="compared.length >= 1 && !isModalVisible">
			<p>{{ compared.length | pluralize("skater") }} selected</p
			><button @click="isModalVisible = true">Compare</button>
		</div>
		<div class="section section-header">
			<h1>Skaters</h1>
			<h2>2016-2017</h2>
		</div>
		<div class="section section-control section-control-table" v-if="players">
			<div class="select-container">
				<select v-model="strengthSit">
					<option value="all">All situations</option>
					<option value="ev5">5 on 5</option>
					<option value="sh">Short handed</option>
					<option value="pp">Power play</option>
				</select>
			</div
			><button type="button" class="toggle-button" @click="visibleColumns.individual = !visibleColumns.individual"
				:class="{ 'toggle-button-checked': visibleColumns.individual }">
				<span class="checkbox-container">
					<span class="checkbox-checkmark"></span>
				</span>Own production</button
			><button type="button" class="toggle-button" @click="visibleColumns.onIceGoals = !visibleColumns.onIceGoals"
				:class="{ 'toggle-button-checked': visibleColumns.onIceGoals }">
				<span class="checkbox-container">
					<span class="checkbox-checkmark"></span>
				</span>On-ice goals</button
			><button type="button" class="toggle-button" @click="visibleColumns.onIceCorsi = !visibleColumns.onIceCorsi"
				:class="{ 'toggle-button-checked': visibleColumns.onIceCorsi }">
				<span class="checkbox-container">
					<span class="checkbox-checkmark"></span>
				</span>On-ice corsi</button
			><button type="button" class="toggle-button" @click="isRatesEnabled = !isRatesEnabled"
				:class="{ 'toggle-button-checked': isRatesEnabled }">
				<span class="checkbox-container">
					<span class="checkbox-checkmark"></span>
				</span>Per 60 min.</button
			><div class="search-with-menu">
				<div class="select-container">
					<select v-model="search.col" @change="search.query = '';">
						<option value="name">Name</option>
						<option value="teams">Team</option>
						<option value="positions">Position</option>
					</select>
				</div
				><input v-model="search.query" type="text" @keyup.enter="blurInput($event);">
				<p v-if="search.col === 'positions'" class="tooltip">For forwards, type 'f'</p>
			</div
			><div class="search-with-menu">
				<div class="select-container">
					<select v-model="filter.col" @change="filter.query = 0;">
						<option value="toi">Min. minutes</option>
						<option value="gp">Min. games</option>
					</select>
				</div
				><input v-model.number="filter.query" @keyup.enter="blurInput($event);" type="number" style="width: 62px;">
			</div>
		</div>
		<div class="loader" v-if="!players"></div>
		<div class="section section-table" v-if="players">
			<table :class="{
				'cols-individual': visibleColumns.individual,
				'cols-on-ice-goals': visibleColumns.onIceGoals,
				'cols-on-ice-corsi': visibleColumns.onIceCorsi }"
			>
				<thead>
					<tr>
						<th class="left-aligned" width="1%">Compare</th>
						<th v-for="c in columns" :tabindex="c.sortable ? 0 : null"
							@click="sortBy(c.sortable, c.key)" @keyup.enter="sortBy(c.sortable, c.key)"
							:class="[
								sort.col === c.key ? (sort.order === -1 ? 'sort-desc' : 'sort-asc') : '',
								c.classes
							]"
						>{{ c.heading }}<span v-if="isRatesEnabled && c.hasRate">/60</span></th>
					</tr>
				</thead>
				<tbody>
					<tr v-for="p in playersOnPage">
						<td class="left-aligned">
							<input tabindex="-1" :id="p.player_id" type="checkbox" :checked="compared.map(function(d) { return d.player_id; }).indexOf(p.player_id) >= 0" @click="updateComparisonList(p)">
							<label tabindex="0" :for="p.player_id" class="checkbox-container">
								<span class="checkbox-checkmark">
							</label>
						</td>
						<td><span class="rank" :class="{ tied: p.rank[1] }">{{ p.rank[0] }}</span></td>
						<td class="left-aligned"><router-link :to="{ path: p.player_id.toString() }" append>{{ p.first + " " + p.last }}</router-link></td>	
						<td class="left-aligned">{{ p.positions.toUpperCase() }}</td>
						<td class="left-aligned">{{ p.teams.toUpperCase() }}</td>
						<td>{{ p.gp }}</td>
						<td>{{ Math.round(p.stats[strengthSit].toi) }}</td>
						<td>{{ (p.stats[strengthSit].toi_per_gp).toFixed(1) }}</td>
						<td class="cols-individual">{{ p.stats[strengthSit].ig | rate(isRatesEnabled, p.stats[strengthSit].toi, false) }}</td>
						<td class="cols-individual">{{ p.stats[strengthSit].ia | rate(isRatesEnabled, p.stats[strengthSit].toi, false) }}</td>
						<td class="cols-individual">{{ p.stats[strengthSit].ip1 | rate(isRatesEnabled, p.stats[strengthSit].toi, false) }}</td>
						<td class="cols-individual">{{ p.stats[strengthSit].ip | rate(isRatesEnabled, p.stats[strengthSit].toi, false) }}</td>
						<td class="cols-individual">{{ p.stats[strengthSit].ic | rate(isRatesEnabled, p.stats[strengthSit].toi, false) }}</td>
						<td class="cols-individual">{{ p.stats[strengthSit].i_sh_pct | percentage(false) }}<span class="pct">%</span></td>
						<td class="cols-on-ice-goals">{{ p.stats[strengthSit].gf | rate(isRatesEnabled, p.stats[strengthSit].toi, false) }}</td>
						<td class="cols-on-ice-goals">{{ p.stats[strengthSit].ga | rate(isRatesEnabled, p.stats[strengthSit].toi, false) }}</td>
						<td class="cols-on-ice-goals">{{ p.stats[strengthSit].g_diff | rate(isRatesEnabled, p.stats[strengthSit].toi, true) }}</td>
						<td class="cols-on-ice-goals">{{ p.stats[strengthSit].sh_pct | percentage(false) }}<span class="pct">%</span></td>
						<td class="cols-on-ice-goals">{{ p.stats[strengthSit].sv_pct | percentage(false) }}<span class="pct">%</span></td>
						<td class="cols-on-ice-corsi">{{ p.stats[strengthSit].cf | rate(isRatesEnabled, p.stats[strengthSit].toi, false) }}</td>
						<td class="cols-on-ice-corsi">{{ p.stats[strengthSit].ca | rate(isRatesEnabled, p.stats[strengthSit].toi, false) }}</td>
						<td class="cols-on-ice-corsi">{{ p.stats[strengthSit].cf_pct | percentage(false) }}<span class="pct">%</span></td>
						<td class="cols-on-ice-corsi">{{ p.stats[strengthSit].cf_pct_rel | percentage(true) }}<span class="pct">%</span></td>
						<td class="cols-on-ice-corsi">{{ p.stats[strengthSit].cf_pct_adj | percentage(false) }}<span class="pct">%</span></td>			
					</tr>
				</tbody>
			</table>
			<div class="pagination" v-if="pagination.total > 0">
				<button type="button" @click="pagination.current--;" class="previous">
					<svg viewBox="0 0 16 16">
						<path d="M10,3,5,8l5,5L11,12,7,8,11,4Z"/>
					</svg>
				</button
				><div>
					<span>{{ pagination.current + 1 }}</span
					><span> of </span
					><span>{{ pagination.total }}</span>
				</div
				><button type="button" @click="pagination.current++;" class="next">
					<svg viewBox="0 0 16 16">
						<path d="M10,3,5,8l5,5L11,12,7,8,11,4Z" transform="rotate(180 8 8)"/>
					</svg>
				</button>
			</div>
		</div>
	</div>
</template>

<style lang="scss">

@import "../variables";

$bar-h: 24px;

.floating-message {
	position: fixed;
	width: 248px;
	height: 40px;
	left: 16px;
	bottom: 16px;
	z-index: 100;
}

.floating-message p {
	height: 100%;
	width: 100%;
	background: $gray8;
	color: $gray1;
	border-radius: 4px;
	padding: 10px 100px 10px 12px;
	box-sizing: border-box;
	white-space: nowrap;
	text-overflow: ellipsis;
	overflow: hidden;
	box-shadow: 0 0 2px rgba(0,0,0,.12), 0 2px 4px rgba(0,0,0,.24);
}

.floating-message button {
	position: absolute;
	top: 0;
	right: 0;
	height: 40px;
	border-top-left-radius: 0;
	border-bottom-left-radius: 0;
	background: $green4;
	border-color: $green4;
	margin: 0;
}

.floating-message button:hover {
	color: $gray9;
	background: $green5;
	border-color: $green5;
}

.floating-message button:active {
	color: $gray9;
	background: $green6;
	border-color: $green6;	
}

.floating-message button:focus {
	border-color: $green7;
}

.modal-mask {
	background: $gray9;
	opacity: 0.6;
	z-index: 900;
	position: fixed;
	top: 0;
	left: 0;
	width: 100%;
	height: 100%;
	overflow: hidden;
}

.modal-visible {
	overflow: hidden;
}

.modal {
	width: calc(100% - 16px);
	min-width: 304px;
	max-height: calc(100% - 48px);
	box-sizing: border-box;
	padding-bottom: $v-whitespace;
	position: fixed;
	right: 8px;
	top: 24px;
	background: #fff;
	overflow: auto;
	z-index: 1000;
}

.section-modal-header {
	position: fixed;
	background: #fff;
	padding-bottom: $v-whitespace - 1px;
	border-bottom-width: 1px;
	width: calc(100% - 64px);
	z-index: 200;
}

.close-button {
	float: right;
	padding: 0;
	position: relative;
	width: 32px;
	margin: 0;
}

.close-button svg {
	box-sizing: border-box;
	height: 100%;
	width: 100%;
	padding: 10px;
	fill: $gray8;
}

.tile-container {
	min-height: 160px;
	padding-top: 80px;
	padding-left: 0;
	padding-right: 0;
}

.tile {
	display: inline-block;
	vertical-align: top;
	box-sizing: border-box;
	padding: $v-whitespace $h-whitespace $v-whitespace $h-whitespace;
	width: 100%;
	position: relative;
}

@media (min-width: 351px) {
	.modal {
		width: calc(100% - 48px);
		right: 24px;
	}
	.section-modal-header {
		width: calc(100% - 96px);
	}
}

/* When width is 740px or wider */
@media (min-width: 641px) {
	.tile {
		width: calc(50% - 2px);
	}
}

@media (min-width: 1021px) {
	.tile {
		width: calc(33.33333% - 2px);
	}
}

table.barchart td:first-child {
	font-size: $small-font-size;
	line-height: $small-line-height;
}

table.barchart td .barchart-bar {
	position: relative;
	width: 100%;
}

table.barchart td .barchart-bar span {
	color: $gray9;
	font-size: $small-font-size;
	line-height: $bar-h;
	margin-left: 6px;
	position: absolute;
	z-index: 100;
}

table.barchart td .barchart-bar div {
	height: $bar-h;
	background: $gray2;
	display: inline-block;
	vertical-align: top;
}

table.barchart td .barchart-bar div:nth-child(3) {
	opacity: 0.5;
}

table.barchart td .barchart-bar div.fill-0 {
	background: #669EFF;
}

table.barchart td .barchart-bar div.fill-1 {
	background: #62D96B;
}

table.barchart td .barchart-bar div.fill-2 {
	background: #FFC940;
}

table.barchart td .barchart-bar div.fill-3 {
	background: #FF6E4A;
}

table.barchart td .barchart-bar div.fill-4 {
	background: #C274C2;
}

table.barchart td .barchart-bar div.fill-5 {
	background: #2EE6D6;
}

table.barchart td .barchart-bar div.fill-6 {
	background: #FF66A1;
}

table.barchart td .barchart-bar div.fill-7 {
	background: #D1F26D;
}

</style>

<script>
var _ = require("lodash");
var constants = require("./../app-constants.js");
module.exports = {
	name: "Skaters",
	data: function() {
		return {
			players: null, // The loading spinner is displayed when 'players' is null
			isRatesEnabled: false,
			strengthSit: "all",
			visibleColumns: {
				individual: true,
				onIceGoals: false,
				onIceCorsi: false
			},
			sort: { col: "ip", order: -1 },
			search: { col: "name", query: "" },
			filter: { col: "toi", query: 0 },
			pagination: {
				rowsPerPage: 20,
				current: 0,
				total: 0
			},
			isModalVisible: false,
			compareSit: "all",
			compared: [],
			columns: [
				{ key: "rank", heading: "", sortable: false, classes: "left-aligned" },
				{ key: "name", heading: "Skater", sortable: true, classes: "left-aligned" },
				{ key: "positions", heading: "Pos", sortable: true, classes: "left-aligned" },
				{ key: "teams", heading: "Team", sortable: true, classes: "left-aligned" },
				{ key: "gp", heading: "GP", sortable: true },
				{ key: "toi", heading: "Mins", sortable: true },
				{ key: "toi_per_gp", heading: "Mins/GP", sortable: true },
				{ key: "ig", heading: "G", sortable: true, hasRate: true, classes: "cols-individual" },
				{ key: "ia", heading: "A", sortable: true, hasRate: true, classes: "cols-individual" },
				{ key: "ip1", heading: "P1", sortable: true, hasRate: true, classes: "cols-individual" },
				{ key: "ip", heading: "P", sortable: true, hasRate: true, classes: "cols-individual" },
				{ key: "ic", heading: "C", sortable: true, hasRate: true, classes: "cols-individual" },
				{ key: "i_sh_pct", heading: "Own Sh%", sortable: true, classes: "cols-individual" },
				{ key: "gf", heading: "GF", sortable: true, hasRate: true, classes: "cols-on-ice-goals" },
				{ key: "ga", heading: "GA", sortable: true, hasRate: true, classes: "cols-on-ice-goals" },
				{ key: "g_diff", heading: "G diff", sortable: true, hasRate: true, classes: "cols-on-ice-goals" },
				{ key: "sh_pct", heading: "Sh%", sortable: true, classes: "cols-on-ice-goals" },
				{ key: "sv_pct", heading: "Sv%", sortable: true, classes: "cols-on-ice-goals" },
				{ key: "cf", heading: "CF", sortable: true, hasRate: true, classes: "cols-on-ice-corsi" },
				{ key: "ca", heading: "CA", sortable: true, hasRate: true, classes: "cols-on-ice-corsi" },
				{ key: "cf_pct", heading: "CF%", sortable: true, classes: "cols-on-ice-corsi" },
				{ key: "cf_pct_rel", heading: "CF% rel", sortable: true, classes: "cols-on-ice-corsi" },
				{ key: "cf_pct_adj", heading: "CF% score-adj", sortable: true, classes: "cols-on-ice-corsi" }
			]
		};
	},
	created: function() {
		this.fetchData();
		// Google Analytics
		if (window.location.hostname.toLowerCase() !== "localhost") {
			ga("set", "page", "/players");
			ga("send", "pageview");
		}
	},
	watch: {
		search: {
			handler: "filterPlayers",
			deep: true
		},
		filter: {
			handler: "filterPlayers",
			deep: true
		},
		strengthSit: function() {
			this.compareSit = this.strengthSit;
			this.filterPlayers();
			this.sortPlayers();
		},
		isRatesEnabled: function() {
			this.filterPlayers();
			this.sortPlayers();
		},
		isModalVisible: function() {
			if (this.isModalVisible) {
				document.body.style.overflow = "hidden";
			} else {
				document.body.style.overflow = "auto";
			}
		}
	},
	computed: {
		playersOnPage: function() {
			var playersNotFilteredOut = this.players.filter(function(p) { return !p.isFilteredOut; });
			this.pagination.total = Math.ceil(playersNotFilteredOut.length / this.pagination.rowsPerPage);
			this.pagination.current = Math.min(this.pagination.total - 1, Math.max(0, this.pagination.current));
			var startIdx = this.pagination.current * this.pagination.rowsPerPage;
			var endIdx = startIdx + this.pagination.rowsPerPage;
			return playersNotFilteredOut.slice(startIdx, endIdx);
		},
		comparisons: function() {
			var comparisons = [
				{ stat: "toi_per_gp", label: "Minutes per game", extent: [] },
				{ stat: "ip", label: "Points per 60 min.", extent: [] },
				{ stat: "cf_pct_adj", label: "Corsi-for percentage, score-adj.", extent: [] },
				{ stat: "cf_adj", label: "Corsi-for per 60 min., score-adj.", extent: [] },
				{ stat: "ca_adj", label: "Corsi-against per 60 min., score-adj.", extent: [] }
			];
			var players = this.compared;
			var sit = this.compareSit;
			comparisons.forEach(function(c) {
				var vals;
				if (c.stat === "toi_per_gp" || c.stat === "cf_pct_adj") {
					vals = players.map(function(p) { return p.stats[sit][c.stat]; });
				} else {
					vals = players.map(function(p) { return 60 * p.stats[sit][c.stat] / p.stats[sit]["toi"]; });
				}
				c.extent[0] = 0;
				c.extent[1] = _.max(vals);
			});
			return comparisons;
		}
	},
	filters: {
		pluralize: function(value, unit) {
			var unitStr = value === 1 ? unit : unit + "s";
			return value + " " + unitStr;
		},
		percentage: function(value, isSigned) {
			var output = value.toFixed(1);
			if (isSigned && value > 0) {
				output = "+" + output;
			}
			return output;
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
		}
	},
	methods: {
		blurInput: function(event) {
			event.target.blur();
		},
		fetchData: function() {
			var self = this;
			var xhr = new XMLHttpRequest();
			xhr.open("GET", "./api/players");
			xhr.setRequestHeader("x-no-compression", true);
			xhr.onload = function() {
				self.players = JSON.parse(xhr.responseText).players;
				self.players.forEach(function(p) {
					// Process player properties
					p.first = p.first.replace(/\./g, "");
					p.last = p.last.replace(/\./g, "");
					p.name = (p.first + " " + p.last).toLowerCase();
					p.positions = p.positions.toString().toLowerCase();
					// Store full team names for more flexible searching
					p.team_names = p.teams.map(function(t) {
						return constants.teamNames[t];
					}).toString().toLowerCase();
					p.teams= p.teams.toString().toLowerCase();
					// Use a flag for filtering so that we can debounce the filter method
					p.isFilteredOut = false;
					// Process/append stats for each score situation
					["all", "ev5", "pp", "sh"].forEach(function(strSit) {
						var s = p.stats[strSit];
						s.toi /= 60;
						s.toi_per_gp = s.toi / p.gp;
						s.ia = s.ia1 + s.ia2;
						s.ip1 = s.ig + s.ia1;
						s.ip = s.ig + s.ia1 + s.ia2;
						s.i_sh_pct = s.is === 0 ? 0 : 100 * s.ig / s.is;
						s.g_diff = s.gf - s.ga;
						s.sh_pct = s.sf === 0 ? 0 : 100 * s.gf / s.sf;
						s.sv_pct *= 100;
						s.cf_pct = s.cf + s.ca === 0 ? 0 : 100 * s.cf / (s.cf + s.ca);
						var cfPctOff = s.cf_off + s.ca_off === 0 ? 0 : 100 * s.cf_off / (s.cf_off + s.ca_off);
						s.cf_pct_rel = s.cf_pct - cfPctOff;
						s.cf_pct_adj = s.cf_adj + s.ca_adj === 0 ? 0 : 100 * s.cf_adj / (s.cf_adj + s.ca_adj);
					});
				});
				self.filterPlayers();
				self.sortPlayers();
			}
			xhr.send();
		},
		filterPlayers: 
			_.debounce(
				function() {
					// Find players matching search string
					var matchedPlayers = this.players;
					if (this.search.query) {
						var col = this.search.col;
						var query = this.search.query.toLowerCase();
						if (col === "name") {
							matchedPlayers = matchedPlayers.filter(function(p) { return p[col].indexOf(query) >= 0; });
						} else if (col === "teams") {
							matchedPlayers = matchedPlayers.filter(function(p) { return p[col].indexOf(query) >= 0 || p.team_names.indexOf(query) >= 0; });
						} else if (col === "positions" && query === "f") {
							matchedPlayers = matchedPlayers.filter(function(p) { return p[col].indexOf("c") >= 0 || p[col].indexOf("r") >= 0 || p[col].indexOf("l") >= 0; });
						} else if (col === "positions") {
							matchedPlayers = matchedPlayers.filter(function(p) { return p[col].indexOf(query) >= 0; });
						}
					}
					// Find players satisying minimum toi or gp
					if (this.filter.query) {
						var min = this.filter.query;
						if (this.filter.col === "toi") {
							var sit = this.strengthSit;
							matchedPlayers = matchedPlayers.filter(function(p) { return Math.round(p.stats[sit].toi) >= min; });
						} else if (this.filter.col === "gp") {
							matchedPlayers = matchedPlayers.filter(function(p) { return p.gp >= min; });
						}
					}
					// Update filter players' filter flag
					matchedPlayers = matchedPlayers.map(function(p) { return p.player_id; });
					this.players.map(function(p) {
						p.isFilteredOut = matchedPlayers.indexOf(p.player_id) >= 0 ? false : true;
						return p;
					});
					this.pagination.current = 0;
					this.rankPlayers();
				}, 350
			),
		sortBy: function(isSortable, newSortCol) {
			if (isSortable) {
				this.sort.order = newSortCol === this.sort.col ? -this.sort.order : -1;
				this.sort.col = newSortCol;
				this.sortPlayers();
			}
		},
		sortPlayers: function() {
			// Create a player property for their sort value - used to sort rate stats and used for ranking
			var col = this.sort.col;
			var order = this.sort.order < 0 ? "desc" : "asc";
			if (["name", "positions", "teams", "gp"].indexOf(col) >= 0) {
				this.players.map(function(p) {
					p.sort_val = p[col];
					return p;
				});				
			} else {
				var sit = this.strengthSit;
				if (!this.isRatesEnabled || ["toi", "toi_per_gp", "i_sh_pct", "sh_pct", "sv_pct", "cf_pct", "cf_pct_rel", "cf_pct_adj"].indexOf(col) >= 0) {
					this.players.map(function(p) {
						p.sort_val = p.stats[sit][col];
						return p;
					});		
				} else {
					this.players.map(function(p) {
						p.sort_val = p.stats[sit].toi === 0 ? 0 : p.stats[sit][col] / p.stats[sit].toi;
						return p;
					});							
				}
			}
			this.players = _.orderBy(this.players, "sort_val", order);
			this.pagination.current = 0;
			this.rankPlayers();
		},
		rankPlayers: function() {
			if (["name", "positions", "teams"].indexOf(this.sort.col) >= 0) {
				this.players = this.players.map(function(p) {	// Use this.player = this.players.map() to trigger an update
					p.rank = ["", false];						// Don't show ranks if sorting by name, position, or team
					return p;
				});
			} else {
				var rankedPlayers = this.players.filter(function(p) { return !p.isFilteredOut; });	// Rank players that aren't filtered out
				var values = rankedPlayers.map(function(p) { return p.sort_val; });					// Get array of sorted *unique* values
				var valueCounts = _.groupBy(rankedPlayers, "sort_val");								// Group players by their stat value to find ties
				this.players = this.players.map(function(p) {
					p.rank = ["", false];
					if (rankedPlayers.length > 1 && !p.isFilteredOut) {					// Don't get ranks if only 1 player is in table, or if player is filtered out
						p.rank[0] = values.indexOf(p.sort_val) + 1;						// In idx0, store player's rank
						p.rank[1] = valueCounts[p.sort_val].length > 1 ? true : false;	// In idx1, store if multiple players are tied with this value
					}
					return p;
				});
			}
		},
		updateComparisonList: function(p) {
			// 'p' is a player object
			if (_.find(this.compared, function(d) { return d.player_id === p.player_id; })) {
				this.compared = this.compared.filter(function(d) { return d.player_id !== p.player_id; });
			} else {
				this.compared.push(p);
			}
			
		}
	}
};
</script>