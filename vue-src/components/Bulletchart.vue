<template>
	<div class="bullet-chart-container">
		<div class="title"><span>{{ titleVal }}</span><span>{{ label }}</span></div>
		<div class="chart">
			<div class="ranges">
				<div v-if="r.width > 0" v-for="(r, i) in ranges" v-bind:style="{ width: r.width + '%', background: r.colour }"></div>
			</div>
			<div v-if="markerPos >= 0 && markerPos <= 100 && data.isPlayerInDistribution" v-bind:style="{ left: 'calc(' + markerPos + '% - 1px)' }" class="marker"></div>
		</div>
		<div class="axis">
			<span>{{ axisTicks[0] }}</span><span>{{ axisTicks[1] }}</span>
		</div>
	</div>
</template>

<script>
var _ = require("lodash");
module.exports = {
	props: ["label", "data", "isInverted"],
	computed: {
		ranges: function() {
			var self = this;
			var ranges = [];
			// Get width
			self.data.breakpoints.forEach(function(p, i) {
				var delta = i === self.data.breakpoints.length - 1 ? p : p - self.data.breakpoints[i + 1];
				ranges.push({ width: 100 * delta / self.data.breakpoints[0] });
			});
			// Get colour
			var colours = ["#2db27b", "#65c396", "#8ed4b1", "#b5e4cd", "#dbf5ea"]; // Listed from dark to light
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
			return 100 * this.data.player / this.data.breakpoints[0];
		},
		axisTicks: function() {
			var ticks = [0, this.data.breakpoints[0].toFixed(1)];
			if (this.label === "mins/game, total") {
				ticks[1] = Math.ceil(ticks[1] / 60).toFixed(1);
			}
			return ticks;
		},
		titleVal: function() {
			if (this.label === "mins/game, total") {
				return (this.data.player / 60).toFixed(1);
			} else {
				return this.data.player.toFixed(1);
			}
		}
	}
};
</script>

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
	line-height: 24px;
}
.bullet-chart-container .title span:last-child {
	font-weight: 400;
	font-size: 14px;
	margin-left: 6px;
}
</style>