var Vue = require("vue");
var VueRouter = require("vue-router");

Vue.use(VueRouter);

var App = require("./App.vue");
var Teams = require("./components/Teams.vue");
var Skaters = require("./components/Skaters.vue");
var Skater = require("./components/Skater.vue");

const router = new VueRouter({
	routes: [
		{ path: "/", redirect: "/teams" },
		{ path: "/teams", component: Teams },
		{ path: "/skaters", component: Skaters },
		{ path: '/skaters/:id', component: Skater }
	]
});

new Vue({
	el: "#app",
	router: router,
	render: function(h) {
		return h(App);
	}
});
