<template>
	<div>
		<div class="section section-header">
			<h1>Home</h1>
			<h2>2016-2017 Leaders</h2>
		</div>
		<div class="loader" v-if="!leaderData.recent"></div>
		<div v-if="leaderData.recent">
			<div class="section section-control">
				<div class="toggle">
					<button :class="view === 'games' ? 'selected' : null" @click="view = 'games'">Yesterday</button
					><button :class="view === 'skaters' ? 'selected' : null" @click="view = 'skaters'">Top skaters</button
					><button :class="view === 'teams' ? 'selected' : null" @click="view = 'teams'">Top teams</button>
				</div
				><div class="toggle">
					<button :class="mode === 'recent' ? 'selected' : null" @click="mode = 'recent'">Last 10 games</button
					><button :class="mode === 'season' ? 'selected' : null" @click="mode = 'season'">Season</button>
				</div>
			</div>
			<div v-if="view === 'games'" class="section dashboard-tile-container">
				<div v-for="g in gameData.games" class="dashboard-tile">
					<p>{{ g.a_team }}</p>
					<svg width="272" height="80" xmlns="http://www.w3.org/2000/svg" style="background: #f0f2f4;">
						<polyline fill="none" stroke="#333" :points="g.ptString" />
					</svg>
					<p>{{ g.h_team }}</p>
				</div>
			</div>
			<div v-if="view === 'skaters'" class="section dashboard-tile-container">
				<div class="dashboard-tile">
					<table>
						<thead><tr><th colspan="3" class="left-aligned">Goals</th></tr></thead>
						<tbody>
							<tr v-for="r in leaderData[mode].ig">
								<td class="left-aligned"><router-link :to="{ path: '/skaters/' + r.player_id.toString() }">{{ r.first + " " + r.last }}</router-link></td>
								<td class="left-aligned">{{ r.teams | teams }}</td>
								<td>{{ r.sorted_ig }}</td>
							</tr>
						</tbody>
					</table>
				</div>
				<div class="dashboard-tile">
					<table>
						<thead><tr><th colspan="3" class="left-aligned">Points</th></tr></thead>
						<tbody>
							<tr v-for="r in leaderData[mode].ip">
								<td class="left-aligned"><router-link :to="{ path: '/skaters/' + r.player_id.toString() }">{{ r.first + " " + r.last }}</router-link></td>
								<td class="left-aligned">{{ r.teams | teams }}</td>
								<td>{{ r.sorted_ip }}</td>
							</tr>
						</tbody>
					</table>
				</div>
				<div class="dashboard-tile">
					<table>
						<thead><tr><th colspan="3" class="left-aligned">Own corsi, 5 on 5</th></tr></thead>
						<tbody>
							<tr v-for="r in leaderData[mode].ev5_ic">
								<td class="left-aligned"><router-link :to="{ path: '/skaters/' + r.player_id.toString() }">{{ r.first + " " + r.last }}</router-link></td>
								<td class="left-aligned">{{ r.teams | teams }}</td>
								<td>{{ r.sorted_ic }}</td>
							</tr>
						</tbody>
					</table>
				</div>
				<div class="dashboard-tile">
					<table>
						<thead><tr><th colspan="3" class="left-aligned">Corsi differential, score-adjusted, 5 on 5</th></tr></thead>
						<tbody>
							<tr v-for="r in leaderData[mode].i_ev5_c_diff_adj">
								<td class="left-aligned"><router-link :to="{ path: '/skaters/' + r.player_id.toString() }">{{ r.first + " " + r.last }}</router-link></td>
								<td class="left-aligned">{{ r.teams | teams }}</td>
								<td>{{ r.sorted_c_diff_adj | signedFixed }}</td>
							</tr>
						</tbody>
					</table>
				</div>
				<div class="dashboard-tile">
					<table>
						<thead><tr><th colspan="4" class="left-aligned">Shooting percentage</th></tr></thead>
						<tbody>
							<tr v-for="r in leaderData[mode].i_sh_pct">
								<td class="left-aligned"><router-link :to="{ path: '/skaters/' + r.player_id.toString() }">{{ r.first + " " + r.last }}</router-link></td>
								<td class="left-aligned">{{ r.teams | teams }}</td>
								<td class="left-aligned">{{ r.stats.all.ig }}/{{ r.stats.all.is }}</td>
								<td>{{ (100 * r.sorted_i_sh_pct).toFixed(1) }}<span class="pct">%</span></td>
							</tr>
							<tr><td colspan="4" style="border: none; font-size: 12px;">10 shot minimum</td></tr>
						</tbody>
					</table>
				</div>
			</div>
			<div v-if="view === 'teams'" class="section dashboard-tile-container">
				<div class="dashboard-tile">
					<table>
						<thead><tr><th colspan="2" class="left-aligned">Goal differential</th></tr></thead>
						<tbody>
							<tr v-for="r in leaderData[mode].tm_g_diff">
								<td class="left-aligned"><router-link :to="{ path: '/teams/' + r.team }">{{ r.team.toUpperCase() }}</router-link></td>
								<td>{{ r.sorted_g_diff | signed }}</td>
							</tr>
						</tbody>
					</table>
				</div>
				<div class="dashboard-tile">
					<table>
						<thead><tr><th colspan="2" class="left-aligned">Corsi differential, score-adjusted, 5 on 5</th></tr></thead>
						<tbody>
							<tr v-for="r in leaderData[mode].tm_ev5_c_diff_adj">
								<td class="left-aligned"><router-link :to="{ path: '/teams/' + r.team }">{{ r.team.toUpperCase() }}</router-link></td>
								<td>{{ r.sorted_c_diff_adj | signedFixed }}</td>
							</tr>
						</tbody>
					</table>
				</div>
				<div class="dashboard-tile">
					<table>
						<thead><tr><th colspan="2" class="left-aligned">Shooting percentage</th></tr></thead>
						<tbody>
							<tr v-for="r in leaderData[mode].tm_sh_pct">
								<td class="left-aligned"><router-link :to="{ path: '/teams/' + r.team }">{{ r.team.toUpperCase() }}</router-link></td>
								<td>{{ (100 * r.sorted_sh_pct).toFixed(1) }}<span class="pct">%</span></td>
							</tr>
						</tbody>
					</table>
				</div>
				<div class="dashboard-tile">
					<table>
						<thead><tr><th colspan="2" class="left-aligned">Save percentage</th></tr></thead>
						<tbody>
							<tr v-for="r in leaderData[mode].tm_sv_pct">
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

.dashboard-tile-container {
	padding-left: 0;
	padding-right: 0;
}

.dashboard-tile {
	display: inline-block;
	vertical-align: top;
	box-sizing: border-box;
	padding: 0 $h-whitespace $v-whitespace-lg $h-whitespace;
	width: 100%;
	position: relative;
}

/* When width is 740px or wider */
@media (min-width: 740px) {
	.dashboard-tile {
		width: calc(50% - 2px);
	}
}

</style>

<script>
var _ = require("lodash");
module.exports = {
	name: "Home",
	data: function() {
		return {
			view: "games",
			mode: "recent",
			gameData: {},
			leaderData: {}
		};
	},
	created: function() {
		this.fetchGameData();
		// Google Analytics
		if (window.location.hostname.toLowerCase() !== "localhost") {
			ga("set", "page", "/home");
			ga("send", "pageview");
		}
	},
	filters: {
		teams: function(value) {
			return value.toString().toUpperCase();
		},
		signed: function(value) {
			return value > 0 ? "+" + value : value;
		},
		signedFixed: function(value) {
			return value > 0 ? "+" + value.toFixed(1) : value.toFixed(1);
		}
	},
	methods: {
		fetchGameData: function() {
			var self = this;
			var xhr = new XMLHttpRequest();
			xhr.open("GET", "./api/highlights/yesterday");
			xhr.onload = function() {
				self.fetchLeaderData();
				self.gameData = JSON.parse(xhr.responseText);

				// Get x and y extents
				var xVals = [];
				var yVals = [];
				self.gameData.games.forEach(function(g) {

					// Convert array of shots into an array of corsi differences [time, diff]
					var diffs = [[0, 0]];
					g.shots.forEach(function(s) {
						var secs = s.time;
						for (var i = 1; i < s.period; i++) {
							var length = g.game_id < 30000 && i === 4 ? 5 * 60 : 20 * 60;
							secs += length;
						}
						var delta = s.venue === "away" ? 1 : -1;
						diffs.push([secs, diffs[diffs.length - 1][1] + delta]);
					});
					g.diffPts = diffs;
					
					// Store x and y values so we can calculate extent
					diffs.forEach(function(d) {
						xVals.push(d[0]);
						yVals.push(d[1]);
					});
				});

				// Get extents that apply to all charts
				var xExtent = [_.min(xVals), _.max(xVals)];
				var yExtent = [_.min(yVals), _.max(yVals)];

				// Generate points for svg path
				var width = 272;
				var height = 80;
				self.gameData.games.forEach(function(g) {

					// Points for svg path
					var pathPts = g.diffPts.map(function(d) {
						var x = d[0] * (width / xExtent[1]);
						var yRange = Math.abs(yExtent[1] - yExtent[0]);
						var y = (yExtent[1] - d[1]) * (height / yRange);
						return [x, y];
					});

					// Create string of points for svg path
					var ptString = "";
					pathPts.forEach(function(d) {
						ptString += d.toString() + " ";
					});
					g.ptString = ptString;
				});

			}
			xhr.send();
		},
		fetchLeaderData: function() {
			var self = this;
			var xhr = new XMLHttpRequest();
			xhr.open("GET", "./api/highlights/leaders");
			xhr.onload = function() {
				self.leaderData = JSON.parse(xhr.responseText);
			}
			xhr.send();
		}
	}
};
</script>