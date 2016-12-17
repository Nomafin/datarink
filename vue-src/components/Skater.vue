<template>
	<div v-if="data.player">
		<div class="section section-header">
			<h1>{{ data.player.first + " " + data.player.last }}: 2016-2017</h1>
		</div>
		<div class="section">
			<bullet-chart v-bind:breakpoints="data.breakpoints.all_toi.breakpoints" v-bind:point="data.breakpoints.all_toi.player" v-bind:isInverted="false"></bullet-chart>
			<bullet-chart v-bind:breakpoints="data.breakpoints.ev5_p1_per60.breakpoints" v-bind:point="data.breakpoints.ev5_p1_per60.player" v-bind:isInverted="false"></bullet-chart>
			<bullet-chart v-bind:breakpoints="data.breakpoints.ev5_cf_adj_per60.breakpoints" v-bind:point="data.breakpoints.ev5_cf_adj_per60.player" v-bind:isInverted="false"></bullet-chart>
			<bullet-chart v-bind:breakpoints="data.breakpoints.ev5_ca_adj_per60.breakpoints" v-bind:point="data.breakpoints.ev5_ca_adj_per60.player" v-bind:isInverted="true"></bullet-chart>
			<bullet-chart v-bind:breakpoints="data.breakpoints.pp_p1_per60.breakpoints" v-bind:point="data.breakpoints.pp_p1_per60.player" v-bind:isInverted="false"></bullet-chart>
		</div>
	</div>
</template>

<style>
	.bullet-chart-container {
		width: 300px;
		position: relative;
	}
	.bullet-chart-container .chart {
		position: relative;
		height: 32px;
	}
	.bullet-chart-container .chart .range {
		height: 16px;
		margin-top: 8px;
		display: inline-block;
		vertical-align: top;
		background: #ccc;
	}
	.bullet-chart-container .chart .marker {
		position: absolute;
		height: 100%;
		width: 2px;
		background: #444;
		top: 0;
	}
	.bullet-chart-container .axis {
		width: 100%;
		position: relative;
	}
	.bullet-chart-container .axis span {
		float: left;
		font-family: sans-serif;
		font-size: 12px;
		line-height: 16px;
	}
</style>

<script>
var _ = require("lodash");

var BulletChart = {
	props: ["breakpoints", "point", "isInverted"],
	computed: {
		colours: function() {
			var colours = ["#eee", "#ddd", "#ccc", "#bbb", "#aaa"];
			if (this.isInverted) {
				colours.reverse();
			}
			return colours;
		},
		rangeWidths: function() {
			var widths = [];
			for (var i = this.breakpoints.length - 1; i >= 0; i--) {
				var delta = this.breakpoints[i];
				if (i < this.breakpoints.length - 1) {
					delta -= this.breakpoints[i + 1];
				}
				widths.push(100 * delta / this.breakpoints[0]);
			}
			return widths;
		},
		markerPos: function() {
			return 100 * this.point / this.breakpoints[0];
		}
	},
	template:
		"<div class='bullet-chart-container'>"
			+ "<div class='chart'>"
				+ "<div v-for='(w, i) in rangeWidths' v-bind:style='{ width: w + \"%\", background: colours[i] }' class='range'></div>"
				+ "<div v-bind:style='{ left: \"calc(\" + markerPos + \"% - 1px)\" }' class='marker'></div>"
			+ "</div>"
		+ "</div>"
};

module.exports = {
	data: function() {
		return {
			data: {}
		}
	},
	created: function() {
		this.fetchData();
	},
	components: {
		"bullet-chart": BulletChart		
	},
	methods: {
		fetchData: function() {
			var pId = this.$route.params.id;
			var self = this;
			var xhr = new XMLHttpRequest();
			xhr.open("GET", "./api/players/" + pId);
			xhr.onload = function() {
				self.data = JSON.parse(xhr.responseText);
				console.log(self.data);
			}
			xhr.send();
		}
	}
};
</script>