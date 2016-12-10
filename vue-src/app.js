var Vue = require("vue");
var VueRouter = require("vue-router");

Vue.use(VueRouter);

var App = require("./App.vue");
var Teams = require("./components/Teams.vue");
var Skaters = require("./components/Skaters.vue");

const router = new VueRouter({
	routes: [
		{ path: "/teams", component: Teams },
		{ path: "/skaters", component: Skaters }
	]
});

new Vue({
	el: "#app",
	router: router,
	render: function(h) {
		return h(App);
	}
});
