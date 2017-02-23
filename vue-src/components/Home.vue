<template>
	<div>
		<div class="section section-header">
			<h1>Home</h1>
			<h2>2016-2017 Leaders</h2>
		</div>
		<div class="loader" v-if="!data.recent"></div>
		<div v-if="data.recent">
			<div class="section section-control">
				<div class="toggle">
					<button :class="view === 'skaters' ? 'selected' : null" @click="view = 'skaters'">Top skaters</button
					><button :class="view === 'teams' ? 'selected' : null" @click="view = 'teams'">Top teams</button>
				</div
				><div class="toggle">
					<button :class="mode === 'recent' ? 'selected' : null" @click="mode = 'recent'">Last 10 games</button
					><button :class="mode === 'season' ? 'selected' : null" @click="mode = 'season'">Season</button>
				</div>
			</div>
			<div class="section dashboard-tile-container">
				<div class="dashboard-tile" v-if="view === 'skaters'">
					<table>
						<thead><tr><th colspan="3" class="left-aligned">Goals</th></tr></thead>
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
						<thead><tr><th colspan="3" class="left-aligned">Points</th></tr></thead>
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
						<thead><tr><th colspan="4" class="left-aligned">Shooting percentage</th></tr></thead>
						<tbody>
							<tr v-for="r in data[mode].i_sh_pct">
								<td class="left-aligned"><router-link :to="{ path: '/skaters/' + r.player_id.toString() }">{{ r.first + " " + r.last }}</router-link></td>
								<td class="left-aligned">{{ r.teams | teams }}</td>
								<td class="left-aligned">{{ r.stats.all.ig }}/{{ r.stats.all.is }}</td>
								<td>{{ (100 * r.sorted_i_sh_pct).toFixed(1) }}<span class="pct">%</span></td>
							</tr>
							<tr><td colspan="4" style="border: none; font-size: 12px;">10 shot minimum</td></tr>
						</tbody>
					</table>
				</div>
				<div class="dashboard-tile" v-if="view === 'teams'">
					<table>
						<thead><tr><th colspan="2" class="left-aligned">Goal differential</th></tr></thead>
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
						<thead><tr><th colspan="2" class="left-aligned">Shooting percentage</th></tr></thead>
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
						<thead><tr><th colspan="2" class="left-aligned">Save percentage</th></tr></thead>
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
module.exports = {
	name: "Home",
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
		fetchData: function() {
			var self = this;
			var xhr = new XMLHttpRequest();
			xhr.open("GET", "./api/highlights");
			xhr.onload = function() {
				self.data = JSON.parse(xhr.responseText);
			}
			xhr.send();
		}
	}
};
</script>
