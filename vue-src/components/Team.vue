<template>
	<div>
		<div class="loader" v-if="!data.team"></div>
		<div v-if="data.team">
			<div class="section section-header">
				<h1>{{ data.team.team_name }}: 2016-2017</h1>
			</div>
			<div class="section" style="padding-left: 0; padding-right: 0; margin-bottom: 8px;">
				<bulletchart :label="'score adj. CF/60, 5 on 5'" :data="data.breakpoints.ev5_cf_adj_per60" :isInverted="false"></bulletchart>
				<bulletchart :label="'score adj. CA/60, 5 on 5'" :data="data.breakpoints.ev5_ca_adj_per60" :isInverted="true"></bulletchart>
				<bulletchart :label="'GF/60, 5 on 5'" :data="data.breakpoints.ev5_gf_per60" :isInverted="false"></bulletchart>
				<bulletchart :label="'GA/60, 5 on 5'" :data="data.breakpoints.ev5_ga_per60" :isInverted="true"></bulletchart>
				<bulletchart :label="'GF/60, PP'" :data="data.breakpoints.pp_gf_per60" :isInverted="false"></bulletchart>
				<bulletchart :label="'GA/60, SH'" :data="data.breakpoints.sh_ga_per60" :isInverted="true"></bulletchart>
			</div>
			<div class="section legend">
				<div><span :style="{ background: colours.green5 }"></span><span>Top 6 teams</span></div
				><div><span :style="{ background: colours.green4 }"></span><span>7-12</span></div
				><div><span :style="{ background: colours.green3 }"></span><span>13-18</span></div
				><div><span :style="{ background: colours.green2 }"></span><span>19-24</span></div
				><div><span :style="{ background: colours.green1 }"></span><span>25-30</span></div>
			</div>
		</div>
	</div>
</template>

<script>
var Bulletchart = require("./Bulletchart.vue");
var _ = require("lodash");
var constants = require("./../app-constants.js");
module.exports = {
	name: "Team",
	data: function() {
		return {
			data: {},
			strengthSit: "ev5",
			colours: constants.colours,
			tabs: {
				active: "lines"
			}
		};
	},
	components: {
		"bulletchart": Bulletchart
	},
	created: function() {
		this.fetchData();
	},
	methods: {
		fetchData: function() {
			var tricode = this.$route.params.tricode;
			var self = this;
			var xhr = new XMLHttpRequest();
			xhr.open("GET", "./api/teams/" + tricode);
			xhr.onload = function() {
				self.data = JSON.parse(xhr.responseText);
				self.data.team.team_name = constants.teamNames[self.data.team.team];
			}
			xhr.send();
		},
		sortBy: function(newSortCol) {
			this.sort.order = newSortCol === this.sort.col ? -this.sort.order : -1;
			this.sort.col = newSortCol;
		},
		blurInput: function(event) {
			event.target.blur();
		}
	}
};
</script>