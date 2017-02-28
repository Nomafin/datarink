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
			</div>
		</div>
		<div class="section section-table">
			<table v-if="lines">
				<thead>
					<tr>
						<th class="left-aligned">Linemates</th>
						<th class="left-aligned"></th>
						<th class="left-aligned"></th>
						<th class="left-aligned">Pos</th>
						<th class="left-aligned">Team</th>
						<th>Mins</th>
						<th>Goal diff</th>
						<th>CF% score-adj</th>
						<th>CF/60 score-adj</th>
						<th>CA/60 score-adj</th>
					</tr>
				</thead>
				<tbody>
					<tr v-for="l in filteredLines">
						<td class="left-aligned">{{ l.firsts[0] + " " + l.lasts[0] }}</td>
						<td class="left-aligned">{{ l.firsts[1] + " " + l.lasts[1] }}</td>
						<td class="left-aligned">{{ l.firsts[2] ? l.firsts[2] + " " + l.lasts[2] : null }}</td>
						<td class="left-aligned">{{ l.f_or_d }}</td>
						<td class="left-aligned">{{ l.team }}</td>
						<td>{{ Math.round(l[strengthSit].toi) }}</td>
						<td>{{ l[strengthSit].g_diff }}</td>
						<td>{{ l[strengthSit].cf_pct_adj }}<span class="pct">%</span></td>
						<td>{{ l[strengthSit].cf_adj }}</td>
						<td>{{ l[strengthSit].ca_adj }}</td>
					</tr>
				</tbody>
			</table>
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
			strengthSit: "all",
		};
	},
	computed: {
		filteredLines: function() {
			var sit = this.strengthSit;
			return this.lines.filter(function(d) { return d[sit].toi >= 200; });
		}
	},
	filters: {
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
		}
	}
}
</script>
