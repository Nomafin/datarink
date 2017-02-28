"use strict"

var Vue = require("vue");
var VueRouter = require("vue-router");

Vue.use(VueRouter);

var App = require("./App.vue");
var Home = require("./components/Home.vue");
var Teams = require("./components/Teams.vue");
var Team = require("./components/Team.vue");
var Lines = require("./components/Lines.vue");
var Skaters = require("./components/Skaters.vue");
var Skater = require("./components/Skater.vue");

var routes = [
	{ path: "/", redirect: "/home" },
	{ path: "/home", component: Home },
	{ path: "/teams", component: Teams },
	{ path: "/teams/:tricode", component: Team },
	{ path: "/lines", component: Lines },
	{ path: "/skaters", component: Skaters },
	{ path: '/skaters/:id', component: Skater }
];

var router = new VueRouter({
	routes: routes
});

new Vue({
	el: "#app",
	router: router,
	render: function(h) {
		return h(App);
	}
});
