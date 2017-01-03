<template>
	<div>
		<div class="section section-header">
			<h1>Highlights</h1>
		</div>
		<div class="loader" v-if="!data.recent"></div>
		<div v-if="data.recent">
			<div class="section section-control">
				<div class="toggle" style="display: inline-block; vertical-align: top;">
					<button :class="view === 'skaters' ? 'selected' : null" @click="view = 'skaters'">Top skaters</button
					><button :class="view === 'teams' ? 'selected' : null" @click="view = 'teams'">Top teams</button>
				</div
				><div class="toggle" style="display: inline-block; vertical-align: top;">
					<button :class="mode === 'recent' ? 'selected' : null" @click="mode = 'recent'">Last 10 games</button
					><button :class="mode === 'season' ? 'selected' : null" @click="mode = 'season'">Season</button>
				</div>
			</div>
			<div class="section dashboard-tile-container">
				<div class="dashboard-tile" v-if="view === 'skaters'">
					<table>
						<thead><tr><th colspan="3" class="left-aligned">Goals, all situations</th></tr></thead>
						<tbody>
							<tr v-for="r in data[mode].ig">
								<td class="left-aligned"><router-link :to="{ path: '/skaters/' + r.player_id.toString() }">{{ r.first + " " + r.last }}</router-link></td>
								<td class="left-aligned">{{ r.teams | teams }}</td>
								<td>{{ r.sorted_ig }}</td>
							</tr>
						</tbody>
					</table>
				</div>
				<div class="dashboard-tile" v-if="view === 'skaters'">
					<table>
						<thead><tr><th colspan="3" class="left-aligned">Points, all situations</th></tr></thead>
						<tbody>
							<tr v-for="r in data[mode].ip">
								<td class="left-aligned"><router-link :to="{ path: '/skaters/' + r.player_id.toString() }">{{ r.first + " " + r.last }}</router-link></td>
								<td class="left-aligned">{{ r.teams | teams }}</td>
								<td>{{ r.sorted_ip }}</td>
							</tr>
						</tbody>
					</table>
				</div>
				<div class="dashboard-tile" v-if="view === 'skaters'">
					<table>
						<thead><tr><th colspan="3" class="left-aligned">Own corsi, 5 on 5</th></tr></thead>
						<tbody>
							<tr v-for="r in data[mode].ev5_ic">
								<td class="left-aligned"><router-link :to="{ path: '/skaters/' + r.player_id.toString() }">{{ r.first + " " + r.last }}</router-link></td>
								<td class="left-aligned">{{ r.teams | teams }}</td>
								<td>{{ r.sorted_ic }}</td>
							</tr>
						</tbody>
					</table>
				</div>
				<div class="dashboard-tile" v-if="view === 'skaters'">
					<table>
						<thead><tr><th colspan="3" class="left-aligned">Corsi differential, score-adjusted, 5 on 5</th></tr></thead>
						<tbody>
							<tr v-for="r in data[mode].i_ev5_c_diff_adj">
								<td class="left-aligned"><router-link :to="{ path: '/skaters/' + r.player_id.toString() }">{{ r.first + " " + r.last }}</router-link></td>
								<td class="left-aligned">{{ r.teams | teams }}</td>
								<td>{{ r.sorted_c_diff_adj | signedFixed }}</td>
							</tr>
						</tbody>
					</table>
				</div>
				<div class="dashboard-tile" v-if="view === 'skaters'">
					<table>
						<thead><tr><th colspan="4" class="left-aligned">Own shooting percentage, all situations</th></tr></thead>
						<tbody>
							<tr v-for="r in data[mode].i_sh_pct">
								<td class="left-aligned"><router-link :to="{ path: '/skaters/' + r.player_id.toString() }">{{ r.first + " " + r.last }}</router-link></td>
								<td class="left-aligned">{{ r.teams | teams }}</td>
								<td class="left-aligned">{{ r.stats.all.ig }}/{{ r.stats.all.is }}</td>
								<td>{{ (100 * r.sorted_i_sh_pct).toFixed(1) }}<span class="pct">%</span></td>
							</tr>
						</tbody>
					</table>
				</div>
				<div class="dashboard-tile" v-if="view === 'teams'">
					<table>
						<thead><tr><th colspan="2" class="left-aligned">Goal differential, all situations</th></tr></thead>
						<tbody>
							<tr v-for="r in data[mode].tm_g_diff">
								<td class="left-aligned"><router-link :to="{ path: '/teams/' + r.team }">{{ r.team.toUpperCase() }}</router-link></td>
								<td>{{ r.sorted_g_diff | signed }}</td>
							</tr>
						</tbody>
					</table>
				</div>
				<div class="dashboard-tile" v-if="view === 'teams'">
					<table>
						<thead><tr><th colspan="2" class="left-aligned">Corsi differential, score-adjusted, 5 on 5</th></tr></thead>
						<tbody>
							<tr v-for="r in data[mode].tm_ev5_c_diff_adj">
								<td class="left-aligned"><router-link :to="{ path: '/teams/' + r.team }">{{ r.team.toUpperCase() }}</router-link></td>
								<td>{{ r.sorted_c_diff_adj | signedFixed }}</td>
							</tr>
						</tbody>
					</table>
				</div>
				<div class="dashboard-tile" v-if="view === 'teams'">
					<table>
						<thead><tr><th colspan="2" class="left-aligned">Shooting percentage, all situations</th></tr></thead>
						<tbody>
							<tr v-for="r in data[mode].tm_sh_pct">
								<td class="left-aligned"><router-link :to="{ path: '/teams/' + r.team }">{{ r.team.toUpperCase() }}</router-link></td>
								<td>{{ (100 * r.sorted_sh_pct).toFixed(1) }}<span class="pct">%</span></td>
							</tr>
						</tbody>
					</table>
				</div>
				<div class="dashboard-tile" v-if="view === 'teams'">
					<table>
						<thead><tr><th colspan="2" class="left-aligned">Save percentage, all situations</th></tr></thead>
						<tbody>
							<tr v-for="r in data[mode].tm_sv_pct">
								<td class="left-aligned"><router-link :to="{ path: '/teams/' + r.team }">{{ r.team.toUpperCase() }}</router-link></td>
								<td>{{ (100 * r.sorted_sv_pct).toFixed(1) }}<span class="pct">%</span></td>
							</tr>
						</tbody>
					</table>
				</div>
			</div>
		</div>
	</div>
</template>

<style lang="scss">

@import "../variables";

.dashboard-tile {
	display: inline-block;
	vertical-align: top;
	box-sizing: border-box;
	margin: $v-whitespace 0;
	width: 100%;
	position: relative;
}

/* When width is 740px or wider */
@media (min-width: 740px) {
	.dashboard-tile {
		width: calc(50% - 2px);
		padding: 0 $h-whitespace;
	}
	.dashboard-tile-container {
		padding-left: 0;
		padding-right: 0;
	}
}

</style>

<script>
var _ = require("lodash");
var constants = require("./../app-constants.js");
module.exports = {
	name: "Highlights",
	data: function() {
		return {
			view: "skaters",
			mode: "recent",
			data: {}
		};
	},
	created: function() {
		this.fetchData();
		// Google Analytics
		if (window.location.hostname.toLowerCase() !== "localhost") {
			ga("set", "page", "/highlights");
			ga("send", "pageview");
		}
	},
	filters: {
		teams: function(value) {
			var string = value.toString();
			return string.toUpperCase();
		},
		signed: function(value) {
			return value > 0 ? "+" + value : value;
		},
		signedFixed: function(value) {
			return value > 0 ? "+" + value.toFixed(1) : value.toFixed(1);
		}
	},
	methods: {
		fetchData: function() {
			var self = this;
			var xhr = new XMLHttpRequest();
			xhr.open("GET", "./api/highlights");
			xhr.setRequestHeader("x-no-compression", true);
			xhr.onload = function() {
				self.data = JSON.parse(xhr.responseText);
			}
			xhr.send();
		}
	}
};
</script>