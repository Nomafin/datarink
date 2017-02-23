<template>
	<div>
		<div class="section section-header">
			<h1>Teams</h1>
			<h2>2016-2017</h2>
		</div>
		<div class="section section-control section-control-table" v-if="teams">
			<div class="select-container">
				<select v-model="strengthSit">
					<option value="all">All situations</option>
					<option value="ev5">5 on 5</option>
					<option value="sh">Short handed</option>
					<option value="pp">Power play</option>
				</select>
			</div
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
			><button type="button" class="toggle-button" @click="isRatesEnabled = !isRatesEnabled;"
				:class="{ 'toggle-button-checked': isRatesEnabled }">
				<span class="checkbox-container">
					<span class="checkbox-checkmark"></span>
				</span>Per 60 mins</button>
		</div>
		<div class="loader" v-if="!teams"></div>
		<div class="section section-table" v-if="teams">
			<table :class="{
				'cols-on-ice-goals': visibleColumns.onIceGoals,
				'cols-on-ice-corsi': visibleColumns.onIceCorsi }"
			>
				<thead>
					<tr>
						<th v-for="c in columns" :tabindex="c.sortable ? 0 : null"
							@click="sortBy(c.sortable, c.key)" @keyup.enter="sortBy(c.sortable, c.key)"
							:class="[
								sort.col === c.key ? (sort.order === -1 ? 'sort-desc' : 'sort-asc') : null,
								c.classes
							]"
						>{{ c.heading }}<span v-if="isRatesEnabled && c.hasRate">/60</span></th>
					</tr>
				</thead>
				<tbody>
					<tr v-for="p in sortedTeams">
						<td class="left-aligned"><span class="rank":class="{ tied: p.rank[1] }">{{ p.rank[0] }}</span></td>
						<td class="left-aligned"><router-link :to="{ path: p.team.toString() }" append>{{ p.team.toUpperCase() }}</td>
						<td>{{ p.pts }}</td>
						<td>{{ p.pts_pct | percentage(false) }}<span class="pct">%</span></td>
						<td>{{ p.gp }}</td>
						<td>{{ Math.round(p.stats[strengthSit].toi) }}</td>
						<td class="cols-on-ice-goals">{{ p.stats[strengthSit].gf | rate(isRatesEnabled, p.stats[strengthSit].toi, false) }}</td>
						<td class="cols-on-ice-goals">{{ p.stats[strengthSit].ga | rate(isRatesEnabled, p.stats[strengthSit].toi, false) }}</td>
						<td class="cols-on-ice-goals">{{ p.stats[strengthSit].g_diff | rate(isRatesEnabled, p.stats[strengthSit].toi, true) }}</td>
						<td class="cols-on-ice-goals">{{ p.stats[strengthSit].sh_pct | percentage(false) }}<span class="pct">%</span></td>
						<td class="cols-on-ice-goals">{{ p.stats[strengthSit].sv_pct | percentage(false) }}<span class="pct">%</span></td>
						<td class="cols-on-ice-corsi">{{ p.stats[strengthSit].cf | rate(isRatesEnabled, p.stats[strengthSit].toi, false) }}</td>
						<td class="cols-on-ice-corsi">{{ p.stats[strengthSit].ca | rate(isRatesEnabled, p.stats[strengthSit].toi, false) }}</td>
						<td class="cols-on-ice-corsi">{{ p.stats[strengthSit].cf_pct | percentage(false) }}<span class="pct">%</span></td>
						<td class="cols-on-ice-corsi">{{ p.stats[strengthSit].cf_pct_adj | percentage(false) }}<span class="pct">%</span></td>
					</tr>
				</tbody>
			</table>
		</div>
	</div>
</template>

<script>
var _ = require("lodash");
module.exports = {
	name: "Teams",
	data: function() {
		return {
			teams: null,  // The loading spinner is displayed when 'players' is null
			isRatesEnabled: false,
			strengthSit: "all",
			visibleColumns: {
				onIceGoals: true,
				onIceCorsi: true
			},
			sort: { col: "pts", order: -1 },
			columns: [
				{ key: "rank", heading: "", sortable: false, classes: "left-aligned" },
				{ key: "team", heading: "Team", sortable: true, classes: "left-aligned" },
				{ key: "pts", heading: "Pt", sortable: true },
				{ key: "pts_pct", heading: "Pt %", sortable: true },
				{ key: "gp", heading: "GP", sortable: true },
				{ key: "toi", heading: "Mins", sortable: true },
				{ key: "gf", heading: "GF", sortable: true, hasRate: true, classes: "cols-on-ice-goals" },
				{ key: "ga", heading: "GA", sortable: true, hasRate: true, classes: "cols-on-ice-goals" },
				{ key: "g_diff", heading: "G diff", sortable: true, hasRate: true, classes: "cols-on-ice-goals" },
				{ key: "sh_pct", heading: "Sh%", sortable: true, classes: "cols-on-ice-goals" },
				{ key: "sv_pct", heading: "Sv%", sortable: true, classes: "cols-on-ice-goals" },
				{ key: "cf", heading: "CF", sortable: true, hasRate: true, classes: "cols-on-ice-corsi" },
				{ key: "ca", heading: "CA", sortable: true, hasRate: true, classes: "cols-on-ice-corsi" },
				{ key: "cf_pct", heading: "CF%", sortable: true, classes: "cols-on-ice-corsi" },
				{ key: "cf_pct_adj", heading: "CF% score-adj", sortable: true, classes: "cols-on-ice-corsi" }
			]
		};
	},
	created: function() {
		this.fetchData();
		// Google Analytics
		if (window.location.hostname.toLowerCase() !== "localhost") {
			ga("set", "page", "/teams");
			ga("send", "pageview");
		}
	},
	computed: {
		sortedTeams: function() {
			// Sort teams
			// Create a player property for their sort value - used to sort rate stats and used for ranking
			var col = this.sort.col;
			var order = this.sort.order < 0 ? "desc" : "asc";
			if (["team", "gp", "pts", "pts_pct"].indexOf(col) >= 0) {
				this.teams.map(function(p) {
					p.sort_val = p[col];
					return p;
				});
			} else {
				var sit = this.strengthSit;
				if (!this.isRatesEnabled || ["toi", "sh_pct", "sv_pct", "cf_pct", "cf_pct_adj"].indexOf(col) >= 0) {
					this.teams.map(function(p) {
						p.sort_val = p.stats[sit][col];
						return p;
					});
				} else {
					this.teams.map(function(p) {
						p.sort_val = p.stats[sit].toi === 0 ? 0 : p.stats[sit][col] / p.stats[sit].toi;
						return p;
					});
				}
			}
			this.teams = _.orderBy(this.teams, "sort_val", order);

			// Rank teams
			if (col === "team") {
				this.teams.map(function(p) {
					p.rank = ["", false]; // Don't show ranks if sorting by team name
					return p;
				});
			} else {
				var values = this.teams.map(function(p) { return p.sort_val; });// Get array of sorted *unique* values
				var valueCounts = _.groupBy(this.teams, "sort_val");			// Group teams by their stat value to find ties
				this.teams.map(function(p) {
					p.rank = ["", false];
					p.rank[0] = values.indexOf(p.sort_val) + 1;						// In idx0, store team's rank
					p.rank[1] = valueCounts[p.sort_val].length > 1 ? true : false;	// In idx1, store if multiple teams are tied with this value
					return p;
				});
			}
			return this.teams;
		}
	},
	filters: {
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
		fetchData: function() {
			var self = this;
			var xhr = new XMLHttpRequest();
			xhr.open("GET", "./api/teams");
			xhr.onload = function() {
				self.teams = JSON.parse(xhr.responseText)["teams"];
				self.teams.forEach(function(p) {
					// Get point percentage
					p.pts_pct = 100 * p.pts / (2 * p.gp);
					// Process/append stats for each score situation
					["all", "ev5", "pp", "sh"].forEach(function(strSit) {
						var s = p.stats[strSit];
						s.toi /= 60;
						s.g_diff = s.gf - s.ga;
						s.sh_pct = s.sf === 0 ? 0 : 100 * s.gf / s.sf;
						s.cf_pct = s.cf + s.ca === 0 ? 0 : 100 * s.cf / (s.cf + s.ca);
						s.cf_pct_adj = s.cf_adj + s.ca_adj === 0 ? 0 : 100 * s.cf_adj / (s.cf_adj + s.ca_adj);
						s.sv_pct *= 100;
					});
				});
			}
			xhr.send();
		},
		sortBy: function(isSortable, newSortCol) {
			if (isSortable) {
				this.sort.order = newSortCol === this.sort.col ? -this.sort.order : -1;
				this.sort.col = newSortCol;
			}
		}
	}
}
</script>
