<template>
	<div>
		<div class="loader" v-if="!data.player"></div>
		<div v-if="data.player">
			<div class="section section-header">
				<h1>{{ data.player.first + " " + data.player.last }}: 2016-2017</h1>
			</div>
			<div class="section" style="padding-left: 0; padding-right: 0; margin-bottom: 8px;">
				<bullet-chart v-bind:label="'mins/game, total'" v-bind:breakpoints="data.breakpoints.all_toi.breakpoints" v-bind:point="data.breakpoints.all_toi.player" v-bind:isInverted="false"></bullet-chart>
				<bullet-chart v-bind:label="'CF/60, 5 on 5'" v-bind:breakpoints="data.breakpoints.ev5_cf_adj_per60.breakpoints" v-bind:point="data.breakpoints.ev5_cf_adj_per60.player" v-bind:isInverted="false"></bullet-chart>
				<bullet-chart v-bind:label="'CA/60, 5 on 5'" v-bind:breakpoints="data.breakpoints.ev5_ca_adj_per60.breakpoints" v-bind:point="data.breakpoints.ev5_ca_adj_per60.player" v-bind:isInverted="true"></bullet-chart>
				<bullet-chart v-bind:label="'P1/60, 5 on 5'" v-bind:breakpoints="data.breakpoints.ev5_p1_per60.breakpoints" v-bind:point="data.breakpoints.ev5_p1_per60.player" v-bind:isInverted="false"></bullet-chart>
				<bullet-chart v-bind:label="'P1/60, powerplay'" v-bind:breakpoints="data.breakpoints.pp_p1_per60.breakpoints" v-bind:point="data.breakpoints.pp_p1_per60.player" v-bind:isInverted="false"></bullet-chart>
			</div>
			<div class="section legend" v-if="data.player.f_or_d === 'f'">
				<div><span style="background: #209767;"></span><span>Top 90 forwards</span></div>
				<div><span style="background: #59ad85;"></span><span>91-180</span></div>
				<div><span style="background: #84c2a3;"></span><span>181-270</span></div>
				<div><span style="background: #add7c2;"></span><span>261-360</span></div>
				<div><span style="background: #d6ece3;"></span><span>361+</span></div>
			</div>
			<div class="section legend" v-if="data.player.f_or_d === 'd'">
				<div><span style="background: #209767;"></span><span>Top 60 defenders</span></div>
				<div><span style="background: #59ad85;"></span><span>61-120</span></div>
				<div><span style="background: #84c2a3;"></span><span>121-180</span></div>
				<div><span style="background: #add7c2;"></span><span>181+</span></div>
			</div>
		</div>
	</div>
</template>

<style>
	.bullet-chart-container {
		display: inline-block;
		vertical-align: top;
		margin: 0 24px 24px 24px;
		width: 272px;
		position: relative;
	}
	.bullet-chart-container .chart {
		position: relative;
		height: 32px;
	}
	.bullet-chart-container .chart .ranges > div {
		height: 16px;
		margin-top: 8px;
		display: inline-block;
		vertical-align: top;
	}
	.bullet-chart-container .chart .ranges > div:first-child {
		border-top-left-radius: 4px;
		border-bottom-left-radius: 4px;
	}
	.bullet-chart-container .chart .ranges > div:last-child {
		border-top-right-radius: 4px;
		border-bottom-right-radius: 4px;
	}
	.bullet-chart-container .chart .marker {
		position: absolute;
		height: 100%;
		width: 2px;
		background: #121818;
		top: 0;
	}
	.bullet-chart-container .axis {
		width: 100%;
		position: relative;
	}
	.bullet-chart-container .axis span {
		display: inline-block;
		vertical-align: top;
		font-size: 12px;
		line-height: 16px;
		width: 50%;
	}
	.bullet-chart-container .axis span:last-child {
		text-align: right;
	}
	.bullet-chart-container .title {
		font-size: 22px;
		font-weight: 700;
		line-height: 24px;
	}
	.bullet-chart-container .title span:last-child {
		font-weight: 400;
		font-size: 14px;
		margin-left: 6px;
	}
	.section.legend {
		padding-left: 16px;
		padding-right: 16px;
		padding-bottom: 39px;
		border-bottom: 1px solid #e0e2e2;
	}
	.legend > div {
		display: inline-block;
		vertical-align: top;
		margin: 0 8px 8px 8px;
	}
	.legend > div > span {
		display: inline-block;
		vertical-align: top;
		font-size: 14px;
		line-height: 16px;
	}
	.legend > div > span:first-child {
		height: 12px;
		width: 12px;
		margin-top: 2px;
		border-radius: 4px;
		margin-right: 6px;
	}
</style>

<script>
var _ = require("lodash");

var BulletChart = {
	props: ["label", "breakpoints", "point", "isInverted"],
	computed: {
		ranges: function() {
			var self = this;
			var ranges = [];
			// Get width
			self.breakpoints.forEach(function(p, i) {
				var delta = i === self.breakpoints.length - 1 ? p : p - self.breakpoints[i + 1];
				ranges.push({ width: 100 * delta / self.breakpoints[0] });
			});
			// Get colour
			var colours = ["#209767", "#59ad85", "#84c2a3", "#add7c2", "#d6ece3"];	// Listed from dark to light
			colours = colours.slice(0, ranges.length);
			if (self.isInverted) {
				colours.reverse();
			}
			ranges.forEach(function(r, i) {
				r.colour = colours[i];
			});
			return ranges.reverse();
		},
		markerPos: function() {
			return 100 * this.point / this.breakpoints[0];
		},
		axisTicks: function() {
			var ticks = [0, Math.round(_.max(this.breakpoints))];
			if (this.label === "mins/game, total") {
				ticks[1] = Math.round(ticks[1] / 60);
			}
			return ticks;
		},
		titleVal: function() {
			if (this.label === "mins/game, total") {
				return (this.point / 60).toFixed(1);
			} else {
				return this.point.toFixed(1);
			}
		}
	},
	template:
		"<div class='bullet-chart-container'>"
			+ "<div class='title'><span>{{ titleVal }}</span><span>{{ label }}</span></div>"
			+ "<div class='chart'>"
				+ "<div class='ranges'>"
					+ "<div v-for='(r, i) in ranges' v-bind:style='{ width: r.width + \"%\", background: r.colour }'></div>"
				+ "</div>"
				+ "<div v-if='markerPos <= 100' v-bind:style='{ left: \"calc(\" + markerPos + \"% - 1px)\" }' class='marker'></div>"
			+ "</div>"
			+ "<div class='axis'>"
				+ "<span>{{ axisTicks[0] }}</span><span>{{ axisTicks[1] }}</span>"
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
			}
			xhr.send();
		}
	}
};
</script>