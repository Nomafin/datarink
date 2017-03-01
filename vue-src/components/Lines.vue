<template>
	<div>
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
			><button type="button" class="toggle-button" @click="isRatesEnabled = !isRatesEnabled"
				:class="{ 'toggle-button-checked': isRatesEnabled }">
				<span class="checkbox-container">
					<span class="checkbox-checkmark"></span>
				</span>Per 60 mins
			</button
			><div class="select-container">
				<select v-model="search.position">
					<option value="all">All positions</option>
					<option value="f">Forwards</option>
					<option value="d">Defense</option>
				</select>
			</div
			><div class="search-with-menu">
				<label for="toi-filter">Minimum mins</label
				><input id="toi-filter" v-model.number="filter.toi" @keyup.enter="blurInput($event);" type="number" style="width: 62px;">
			</div
			>
		</div>
		<div class="section section-table">
			<table v-if="lines">
				<thead>
					<tr>
						<th class="left-aligned" colspan="3"></th>
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
					<tr v-for="l in onPage(filtered)">
						<td class="left-aligned">{{ l.firsts[0] + " " + l.lasts[0] }}</td>
						<td class="left-aligned">{{ l.firsts[1] + " " + l.lasts[1] }}</td>
						<td class="left-aligned">{{ l.firsts[2] ? l.firsts[2] + " " + l.lasts[2] : null }}</td>
						<td class="left-aligned">{{ l.f_or_d.toUpperCase() }}</td>
						<td class="left-aligned">{{ l.team.toUpperCase() }}</td>
						<td>{{ Math.max(1, Math.round(l[strengthSit].toi)) }}</td>
						<td>{{ l[strengthSit].g_diff | rate(isRatesEnabled, l[strengthSit].toi, true, [0, 1]) }}</td>
						<td>{{ l[strengthSit].gf | rate(isRatesEnabled, l[strengthSit].toi, false, [0, 1]) }}</td>
						<td>{{ l[strengthSit].ga | rate(isRatesEnabled, l[strengthSit].toi, false, [0, 1]) }}</td>
						<td>{{ l[strengthSit].cf_pct_adj | percentage(false) }}<span class="pct">%</span></td>
						<td>{{ l[strengthSit].cf_adj | rate(isRatesEnabled, l[strengthSit].toi, false, [1, 1]) }}</td>
						<td>{{ l[strengthSit].ca_adj | rate(isRatesEnabled, l[strengthSit].toi, false, [1, 1]) }}</td>
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
</template>

<script>
var _ = require("lodash");
module.exports = {
	name: "Lines",
	data: function() {
		return {
			lines: null, // The loading spinner is displayed when 'lines' is null
			isRatesEnabled: false,
			sort: { col: "toi", order: -1 },
			strengthSit: "all",
			pagination: { rowsPerPage: 20, current: 0, total: 0 },
			search: {
				position: "all"
			},
			filter: {
				toi: 120
			}
		};
	},
	computed: {
		sorted: function() {
			var sit = this.strengthSit;
			var col = this.sort.col;
			var order = this.sort.order < 0 ? "desc" : "asc";
			var lines = this.lines;
			if (["f_or_d", "team"].indexOf(col) >= 0) {
				lines.map(function(l) {
					l.sort_val = l[col];
					return l;
				});
			} else if (!this.isRatesEnabled || ["toi", "cf_pct_adj"].indexOf(col) >= 0) {
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
			return _.orderBy(lines, "sort_val", order);
		},
		filtered: function() {
			var sit = this.strengthSit;
			var positions = this.search.position === "all" ? ["f", "d"] : [this.search.position];
			var toi = this.filter.toi;
			var lines = this.sorted.filter(function(d) {
				return d[sit].toi >= Math.max(10, toi) && positions.indexOf(d.f_or_d) >= 0;
			});
			return lines;
		}
	},
	filters: {
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
			xhr.open("GET", "./api/lines/all");
			xhr.onload = function() {
				self.lines = JSON.parse(xhr.responseText)["lines"];
				self.lines.forEach(function(l) {
					["all", "ev5", "pp", "sh"].forEach(function(strSit) {
						var s = l[strSit];
						s.toi /= 60;
						s.g_diff = s.gf - s.ga;
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
		onPage: function(list) {
			this.pagination.total = Math.ceil(list.length / this.pagination.rowsPerPage);
			this.pagination.current = Math.min(this.pagination.total - 1, Math.max(0, this.pagination.current));
			var startIdx = this.pagination.current * this.pagination.rowsPerPage;
			return list.slice(startIdx, startIdx + this.pagination.rowsPerPage);
		},
		blurInput: function(event) {
			event.target.blur();
		}
	}
}
</script>
