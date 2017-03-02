<template>
	<div>
		<div class="loader" v-if="!lines"></div>
		<div v-if="lines">
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
									<td width="30%" class="label">{{ l.firsts[0].charAt(0) + ". " + l.lasts[0] }}
										<span v-if="l.firsts[1]"><br>{{ l.firsts[1].charAt(0) + ". " + l.lasts[1] }}</span>
										<span v-if="l.firsts[2]"><br>{{ l.firsts[2].charAt(0) + ". " + l.lasts[2] }}</span>
									</td>
									<td width="70%">
										<div v-if="c.stat === 'toi' || c.stat === 'gf_pct' || c.stat === 'cf_pct_adj'" class="barchart-bar">
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
				<h1>Lines</h1>
				<h2>2016-2017</h2>
			</div>
			<div class="section section-control section-control-table">
				<div class="select-container">
					<select v-model="strengthSit">
						<option value="all">All situations</option>
						<option value="ev5">5 on 5</option>
						<option value="sh">Short handed</option>
						<option value="pp">Power play</option>
					</select>
				</div
				><div class="select-container">
					<select v-model="search.position">
						<option value="all">All positions</option>
						<option value="f">Forwards</option>
						<option value="d">Defense</option>
					</select>
				</div
				><button type="button" class="toggle-button" @click="isRatesEnabled = !isRatesEnabled"
					:class="{ 'toggle-button-checked': isRatesEnabled }">
					<span class="checkbox-container">
						<span class="checkbox-checkmark"></span>
					</span>Per 60 mins
				</button
				><div class="search-with-menu">
					<label for="toi-filter">Minimum mins</label
					><input id="toi-filter" v-model.number="toiInput" @blur="sanitizeToi();" @keyup.enter="blurInput($event);" type="number" style="width: 62px;" :placeholder="apiminToi">
				</div
				><div class="search-with-menu">
					<label for="team-filter">Team</label
					><input id="team-filter" v-model="teamInput" @keyup.enter="blurInput($event);" type="text" style="width: 62px;">
				</div
				><div class="search-with-menu">
					<label for="player-filter">Player</label
					><input id="player-filter" v-model="playerInput" @keyup.enter="blurInput($event);" type="text">
				</div>
			</div>
			<div class="section section-table">
				<table v-if="lines">
					<thead>
						<tr>
							<th class="left-aligned" width="1%">Compare</th>
							<th class="left-aligned" colspan="3">Linemates</th>
							<th @click="sortBy('f_or_d')" @keyup.enter="sortBy('f_or_d')" tabindex="0"
								:class="[ sort.col === 'f_or_d' ? (sort.order === -1 ? 'sort-desc' : 'sort-asc') : null ]"
								class="left-aligned"
								>Pos</th>
							<th @click="sortBy('team')" @keyup.enter="sortBy('team')" tabindex="0"
								:class="[ sort.col === 'team' ? (sort.order === -1 ? 'sort-desc' : 'sort-asc') : null ]"
								class="left-aligned"
								>Team</th>
							<th @click="sortBy('toi')" @keyup.enter="sortBy('toi')" tabindex="0"
								:class="[ sort.col === 'toi' ? (sort.order === -1 ? 'sort-desc' : 'sort-asc') : null ]"
								>Mins</th>
							<th @click="sortBy('gf_pct')" @keyup.enter="sortBy('gf_pct')" tabindex="0"
								:class="[ sort.col === 'gf_pct' ? (sort.order === -1 ? 'sort-desc' : 'sort-asc') : null ]"
								>GF%</th>
							<th @click="sortBy('g_diff')" @keyup.enter="sortBy('g_diff')" tabindex="0"
								:class="[ sort.col === 'g_diff' ? (sort.order === -1 ? 'sort-desc' : 'sort-asc') : null ]"
								>Goal diff<span v-if="isRatesEnabled">/60</span></th>
							<th @click="sortBy('gf')" @keyup.enter="sortBy('gf')" tabindex="0"
								:class="[ sort.col === 'gf' ? (sort.order === -1 ? 'sort-desc' : 'sort-asc') : null ]"
								>GF<span v-if="isRatesEnabled">/60</span></th>
							<th @click="sortBy('ga')" @keyup.enter="sortBy('ga')" tabindex="0"
								:class="[ sort.col === 'ga' ? (sort.order === -1 ? 'sort-desc' : 'sort-asc') : null ]"
								>GA<span v-if="isRatesEnabled">/60</span></th>
							<th @click="sortBy('cf_pct_adj')" @keyup.enter="sortBy('cf_pct_adj')" tabindex="0"
								:class="[ sort.col === 'cf_pct_adj' ? (sort.order === -1 ? 'sort-desc' : 'sort-asc') : null ]"
								>CF% score-adj</th>
							<th @click="sortBy('cf_adj')" @keyup.enter="sortBy('cf_adj')" tabindex="0"
								:class="[ sort.col === 'cf_adj' ? (sort.order === -1 ? 'sort-desc' : 'sort-asc') : null ]"
								>CF<span v-if="isRatesEnabled">/60</span> score-adj</th>
							<th @click="sortBy('ca_adj')" @keyup.enter="sortBy('ca_adj')" tabindex="0"
								:class="[ sort.col === 'ca_adj' ? (sort.order === -1 ? 'sort-desc' : 'sort-asc') : null ]"
								>CA<span v-if="isRatesEnabled">/60</span> score-adj</th>
						</tr>
					</thead>
					<tbody>
						<tr v-for="l in onPage(sorted)">
							<td class="left-aligned">
								<input tabindex="-1" :id="l.line_id" type="checkbox" @click="updateComparisonList(l)"
									:checked="compared.map(function(d) { return d.line_id; }).indexOf(l.line_id) >= 0" />
								<label tabindex="0" :for="l.line_id" class="checkbox-container">
									<span class="checkbox-checkmark">
								</label>
							</td>
							<td class="left-aligned">{{ l.firsts[0] + " " + l.lasts[0] }}</td>
							<td class="left-aligned">{{ l.firsts[1] + " " + l.lasts[1] }}</td>
							<td class="left-aligned">{{ l.firsts[2] ? l.firsts[2] + " " + l.lasts[2] : null }}</td>
							<td class="left-aligned">{{ l.f_or_d.toUpperCase() }}</td>
							<td class="left-aligned">{{ l.team.toUpperCase() }}</td>
							<td>{{ Math.max(1, Math.round(l[strengthSit].toi)) }}</td>
							<td>{{ l[strengthSit].gf_pct | percentage(false) }}<span class="pct">%</span></td>
							<td>{{ l[strengthSit].g_diff | rate(isRatesEnabled, l[strengthSit].toi, true, [0, 1]) }}</td>
							<td>{{ l[strengthSit].gf | rate(isRatesEnabled, l[strengthSit].toi, false, [0, 1]) }}</td>
							<td>{{ l[strengthSit].ga | rate(isRatesEnabled, l[strengthSit].toi, false, [0, 1]) }}</td>
							<td>{{ l[strengthSit].cf_pct_adj | percentage(false) }}<span class="pct">%</span></td>
							<td>{{ l[strengthSit].cf_adj | rate(isRatesEnabled, l[strengthSit].toi, false, [1, 1]) }}</td>
							<td>{{ l[strengthSit].ca_adj | rate(isRatesEnabled, l[strengthSit].toi, false, [1, 1]) }}</td>
						</tr>
						<tr v-if="sorted.length === 0">
							<td class="left-aligned" :colspan="20">No lines with at least {{ apiMinToi }} minutes together</td>
						</tr>
					</tbody>
				</table>
				<div class="pagination" v-if="pagination.total > 0">
					<button type="button" @click="pagination.current--;" class="previous">
						<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 16 16">
							<path d="M10,3,5,8l5,5L11,12,7,8,11,4Z"/>
						</svg>
					</button
					><div>
						<span>{{ pagination.current + 1 }}</span
						><span> of </span
						><span>{{ pagination.total }}</span>
					</div
					><button type="button" @click="pagination.current++;" class="next">
						<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 16 16">
							<path d="M10,3,5,8l5,5L11,12,7,8,11,4Z" transform="rotate(180 8 8)"/>
						</svg>
					</button>
				</div>
			</div>
		</div>
	</div>
</template>

<script>
var Barchart = require("./Barchart.vue");
var Modal = require("./Modal.vue");
var _ = require("lodash");
var constants = require("./../app-constants.js");
module.exports = {
	name: "Lines",
	data: function() {
		return {
			lines: null, 	// The loading spinner is displayed when 'lines' is null
			apiMinToi: 20,	// Min toi used for api
			isRatesEnabled: true,
			sort: { col: "toi", order: -1 },
			strengthSit: "ev5",
			pagination: { rowsPerPage: 20, current: 0, total: 0 },
			search: {
				position: "all"
			},
			toiInput: 20,
			playerInput: "",
			teamInput: "",
			filter: {
				toi: 20,
				player: "",
				team: ""
			},
			compareSit: "ev5",
			compared: [],
			isModalVisible: false
		};
	},
	components: {
		"barchart": Barchart,
		"modal": Modal,
	},
	watch: {
		toiInput: _.debounce(function() { this.filter.toi = this.toiInput; }, 250),
		teamInput: _.debounce(function() { this.filter.team = this.teamInput; }, 250),
		playerInput: _.debounce(function() { this.filter.player = this.playerInput; }, 250),
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
				{ stat: "gf_pct", label: "Goals-for percentage", extent: [] },
				{ stat: "cf_pct_adj", label: "Corsi-for percentage, score-adj.", extent: [] },
				{ stat: "cf_adj", label: "Corsi-for per 60 mins, score-adj.", extent: [] },
				{ stat: "ca_adj", label: "Corsi-against per 60 mins, score-adj.", extent: [] }
			];
			var lines = this.compared;
			var sit = this.compareSit;
			comparisons.forEach(function(c) {
				var vals;
				if (c.stat === "toi" || c.stat === "gf_pct" || c.stat === "cf_pct_adj") {
					vals = lines.map(function(l) { return l[sit][c.stat]; });
				} else {
					vals = lines.map(function(l) { return 60 * l[sit][c.stat] / l[sit]["toi"]; });
				}
				c.extent = [0, _.max(vals)];
			});
			return comparisons;
		},
		filtered: function() {
			var sit = this.strengthSit;
			var positions = this.search.position === "all" ? ["f", "d"] : [this.search.position];
			var toi = this.filter.toi;
			var apiMinToi = this.apiMinToi;
			var lines = this.lines.filter(function(d) {
				return d[sit].toi >= Math.max(apiMinToi, toi) && positions.indexOf(d.f_or_d) >= 0;
			});
			if (this.filter.player) {
				var player = this.filter.player.toLowerCase();
				lines = lines.filter(function(d) {
					return d.name0.indexOf(player) >= 0 || d.name1.indexOf(player) >= 0 || d.name2.indexOf(player) >= 0;
				});
			}
			if (this.filter.team) {
				var team = this.filter.team.toLowerCase();
				lines = lines.filter(function(d) {
					return d.team.indexOf(team) >= 0 || d.team_name.indexOf(team) >= 0;
				});
			}
			return lines;
		},
		sorted: function() {
			var sit = this.strengthSit;
			var col = this.sort.col;
			var order = this.sort.order < 0 ? "desc" : "asc";
			var lines = this.filtered;
			if (["f_or_d", "team"].indexOf(col) >= 0) {
				lines.map(function(l) {
					l.sort_val = l[col];
					return l;
				});
			} else if (!this.isRatesEnabled || ["toi", "gf_pct", "cf_pct_adj"].indexOf(col) >= 0) {
				lines.map(function(l) {
					l.sort_val = l[sit][col];
					return l;
				});
			} else {
				lines.map(function(l) {
					l.sort_val = l[sit].toi === 0 ? 0 : l[sit][col] / l[sit].toi;
					return l;
				});
			}
			this.pagination.current = 0;
			return _.orderBy(lines, "sort_val", order);
		}
	},
	filters: {
		pluralize: function(value, unit) {
			var unitStr = value === 1 ? unit : unit + "s";
			return value + " " + unitStr;
		},
		rate: function(value, isRatesEnabled, toi, isSigned, decPlaces) {
			var output = value;
			if (isRatesEnabled) {
				output = toi === 0 ? 0 : 60 * value / toi;
				output = output.toFixed(decPlaces[1]);
			} else {
				output = output.toFixed(decPlaces[0]);
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
		// Google Analytics
		if (window.location.hostname.toLowerCase() !== "localhost") {
			ga("set", "page", "/lines");
			ga("send", "pageview");
		}
	},
	methods: {
		fetchData: function() {
			var self = this;
			var xhr = new XMLHttpRequest();
			var results = [];
			var teams = ["car", "cbj", "njd", "nyi", "nyr", "phi",
				"pit", "wsh", "bos", "buf", "det", "fla",
				"mtl", "ott", "tbl", "tor", "chi", "col",
				"dal", "min", "nsh", "stl", "wpg", "ana",
				"ari", "cgy", "edm", "lak", "sjs", "van"];
			var retrieved = 0;

			var nRequest = [];
			for (var i = 0; i < teams.length; i++) {
				(function(i) {
					nRequest[i] = new XMLHttpRequest();
					nRequest[i].open("GET", "./api/lines/" + teams[i], true);
					nRequest[i].onreadystatechange = function (oEvent) {
						if (nRequest[i].readyState === 4) {
							if (nRequest[i].status === 200) {
								var teamLines = JSON.parse(nRequest[i].responseText).lines;
								results = results.concat(teamLines.filter(function(d) { return d.all.toi >= 1200 || d.sh.toi >= 1200; }));
								retrieved++;
								processResults();
							} else {
								console.log("Error", nRequest[i].statusText);
							}
						}
					};
					nRequest[i].send(null);
				})(i);
			}

			function processResults() {
				if (retrieved < teams.length) {
					return;
				}
				results.forEach(function(l) {
					l.line_id = l.player_ids.toString().replace(/,/g , "");
					l.name0 = (l.firsts[0] + " " + l.lasts[0]).toLowerCase();
					l.name1 = (l.firsts[1] + " " + l.lasts[1]).toLowerCase();
					l.name2 = (l.firsts[2] + " " + l.lasts[2]).toLowerCase();
					if (!l.firsts[2]) {
						l.firsts[2] = "";
						l.lasts[2] = "";
					}
					l.team_name = constants.teamNames[l.team].toString().toLowerCase();
					["all", "ev5", "pp", "sh"].forEach(function(strSit) {
						var s = l[strSit];
						s.toi /= 60;
						s.g_diff = s.gf - s.ga;
						s.gf_pct = s.gf + s.ga === 0 ? 0 : 100 * s.gf / (s.gf + s.ga);
						s.cf_pct_adj = s.cf_adj + s.ca_adj === 0 ? 0 : 100 * s.cf_adj / (s.cf_adj + s.ca_adj);
					});
				});
				self.lines = results;
			}
		},
		sortBy: function(newSortCol) {
			this.sort.order = newSortCol === this.sort.col ? -this.sort.order : -1;
			this.sort.col = newSortCol;
		},
		onPage: function(list) {
			this.pagination.total = Math.ceil(list.length / this.pagination.rowsPerPage);
			this.pagination.current = Math.min(this.pagination.total - 1, Math.max(0, this.pagination.current));
			var startIdx = this.pagination.current * this.pagination.rowsPerPage;
			return list.slice(startIdx, startIdx + this.pagination.rowsPerPage);
		},
		blurInput: function(event) {
			event.target.blur();
		},
		sanitizeToi: function() {
			this.toiInput = Math.max(this.apiMinToi, this.toiInput);
		},
		updateComparisonList: function(l) {
			if (_.find(this.compared, function(d) { return d.line_id === l.line_id; })) {
				this.compared = this.compared.filter(function(d) { return d.line_id !== l.line_id; });
			} else {
				this.compared.push(l);
			}
		}
	}
}
</script>
