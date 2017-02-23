<template>
	<div class="barchart-container chart-tile">
		<h3>{{ data.title }}</h3>
		<span class="axis-label"><span v-if="data.extent[1] > 0">{{ data.extent[1] | toLabel(data.stat) }}</span></span>
		<div class="bar-container">
			<div v-for="b in bars" class="bar-slot" :style="{ width: 'calc(100%/' + bars.length + ')' }">
				<div :class="{ negative: b.isNegative }" :style="{ top: b.top + '%', height: b.height + '%' }"></div>
			</div>
			<div class="barchart-axis" :style="{ top: spread === 0 ? '100%' : 100 * data.extent[1] / spread + '%' }"></div>
		</div>
		<span class="axis-label">{{ data.extent[0] | toLabel(data.stat)  }}</span>
	</div>
</template>

<script>
var _ = require("lodash");
var constants = require("./../app-constants.js");
module.exports = {
	props: ["data"],
	computed: {
		spread: function() {
			return this.data.extent[1] - this.data.extent[0];
		},
		bars: function() {
			// Calculate the top position and height of each bar
			var bars = [];
			var stat = this.data.stat;
			var extent = this.data.extent;
			var spread = this.spread;
			this.data.values.forEach(function(d) {
				if (d >= 0) {
					bars.push({
						top: spread === 0 ? 0 : 100 * (extent[1] - d) / spread,
						height: spread === 0 ? 0 : 100 * d / spread,
						isNegative: stat === "ca_adj" ? true : false
					});
				} else {
					bars.push({
						top: spread === 0 ? 0 : 100 * extent[1] / spread,
						height: spread === 0 ? 0 : 100 * Math.abs(d) / spread,
						isNegative: true
					});
				}
			});
			return bars;
		}
	},
	filters: {
		toLabel: function(value, stat) {
			if (stat === "g_diff") {
				return value > 0 ? "+" + value : value;
			} else if (stat === "c_diff_adj") {
				return value > 0 ? "+" + value.toFixed(1) : value.toFixed(1);
			} else {
				return value.toFixed(1);
			}
		}
	}
};
</script>

<style lang="scss">

@import "../variables";

.bar-container {
	border-top: 1px solid $gray3;
	border-bottom: 1px solid $gray3;
	position: relative;
}

.bar-slot {
	display: inline-block;
	vertical-align: top;
	height: 78px;
	position: relative;
}

.bar-slot > div {
	width: 100%;
	position: absolute;
	background: $green5;
}

.bar-slot > div.negative {
	background: #fc8d62;
}

.barchart-axis {
	position: absolute;
	width: 100%;
	height: 1px;
	background: $gray8;
}

.axis-label {
	color: $gray6;
	font-size: $small-font-size;
	line-height: $small-line-height;
	min-height: $small-line-height;
	padding: 4px 0;
	display: block;
}

.barchart-container h3 {
	font-size: $base-font-size;
	line-height: $base-line-height;
	margin: 4px 0;
	font-weight: 400;
}

</style>
