// route components are defined in vue-components.js
var routes = [
	{ path: "/", redirect: "/teams" },
	{ path: "/teams", component: teamsViewComponent },
	{ path: "/players", component: playersViewComponent }
];

var router = new VueRouter({
	routes: routes
});

var vueApp = new Vue({
	router: router
}).$mount("#app");