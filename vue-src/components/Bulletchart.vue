<template>
	<div class="bullet-chart-container chart-tile">
		<div class="title"><span>{{ titleVal }}</span><span>{{ label }}</span></div>
		<div class="chart">
			<div class="ranges">
				<div v-for="(r, i) in ranges" :style="{ width: r.width + '%', background: r.colour }"></div>
			</div>
			<div v-if="Math.floor(markerPos) >= 0 && Math.ceil(markerPos) <= 100 && data.isSelfInDistribution" :style="{ left: markerPos + '%' }" class="marker"></div>
		</div>
		<div class="axis">
			<span>{{ axisTicks[0] }}</span><span>{{ axisTicks[1] }}</span>
		</div>
	</div>
</template>

<script>
var _ = require("lodash");
var constants = require("./../app-constants.js");
module.exports = {
	props: ["label", "data", "isInverted"],
	computed: {
		ranges: function() {
			var self = this;
			var ranges = [];
			var colours = [constants.colours.green8, constants.colours.green6, constants.colours.green4, constants.colours.green2, constants.colours.green1];
			// Sort breakpoints in ascending order
			self.data.breakpoints = self.data.breakpoints.sort(function(a, b) { return a - b; });
			var max = _.max(self.data.breakpoints);
			// Append a padding section (coloured white) if needed
			if (self.data.breakpoints[0] > 0) {
				ranges.push({
					width: 100 * self.data.breakpoints[0] / max,
					isPadding: true
				});
			}
			// Append coloured ranges
			for (var i = 1; i < self.data.breakpoints.length; i++) {
				var delta = self.data.breakpoints[i] - self.data.breakpoints[i - 1];
				ranges.push({
					width: 100 * delta / max,
					isPadding: false
				});
			}
			// For metrics where higher is better, sort ranges in descending order before assigning colours
			if (!self.isInverted) {
				ranges.reverse();
			}
			// Assign colours to ranges
			var colourIdx = 0;
			ranges.forEach(function(r, i) {
				if (r.isPadding) {
					r.colour = "#fff";
				} else {
					r.colour = colours[colourIdx];
					colourIdx++;
				}
			});
			// For metrics where higher is better, sort ranges in ascending order (the order they'll be appended to the DOM)
			if (!self.isInverted) {
				ranges.reverse();
			}
			return ranges;
		},
		markerPos: function() {
			return 100 * this.data.self / _.max(this.data.breakpoints);
		},
		axisTicks: function() {
			return [0, _.max(this.data.breakpoints).toFixed(1)];
		},
		titleVal: function() {
			return this.data.self ? this.data.self.toFixed(1) : "0.0";
		}
	}
};
</script>

<style lang="scss">

@import "../variables";

.bullet-chart-container .chart {
	position: relative;
	height: 32px;
}
.bullet-chart-container .chart .ranges {
	height: 16px;
	box-sizing: border-box;
	border: 1px solid $gray3;
	border-radius: 4px;
	margin-top: 8px;
	position: relative;
}
.bullet-chart-container .chart .ranges > div {
	height: 100%;
	display: inline-block;
	vertical-align: top;
}
.bullet-chart-container .chart .ranges > div:first-child {
	border-top-left-radius: $border-radius;
	border-bottom-left-radius: $border-radius;
}
.bullet-chart-container .chart .ranges > div:last-child {
	border-top-right-radius: $border-radius;
	border-bottom-right-radius: $border-radius;
}
.bullet-chart-container .chart .marker {
	position: absolute;
	height: 100%;
	width: 2px;
	margin-left: -1px;
	background: $gray9;
	border-radius: 2px;
	top: -8px;
}
.bullet-chart-container .axis {
	width: 100%;
	position: relative;
}
.bullet-chart-container .axis span {
	display: inline-block;
	vertical-align: top;
	font-size: $small-font-size;
	line-height: $small-line-height;
	width: 50%;
}
.bullet-chart-container .axis span:last-child {
	text-align: right;
}
.bullet-chart-container .title {
	font-size: $large-font-size;
	line-height: $large-line-height;
}
.bullet-chart-container .title span:last-child {
	font-size: $base-font-size;
	margin-left: 6px;
}
</style>
