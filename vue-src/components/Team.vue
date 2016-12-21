<template>
	<div>
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
			console.log("Fetch team data");
		}
	}
};
</script>