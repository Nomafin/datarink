"use strict"

var throng = require("throng");
var compression = require("compression");
var apicache = require("apicache");

var PORT = process.env.PORT || 5000;
var WORKERS = process.env.WEB_CONCURRENCY || 1;

throng({
	workers: WORKERS,
	lifetime: Infinity,
	start: start
});

function start() {

	// Create an Express server
	var express = require("express");
	var server = express();
	
	// Enable compression for static assets and api responses
	server.use(compression({ filter: shouldCompress }));

	// Filter to determine whether or not responses should be compressed
	// Due to a limitation with apicache, do not compress responses that we want cached
	function shouldCompress(request, response) {
		if (request.headers["x-no-compression"]
			|| request.baseUrl === "/api/players"
			|| request.baseUrl === "/api/players/breakpoints"
			|| request.baseUrl === "/api/highlights") {
			return false;
		}
		return compression.filter(request, response);
	}

	// Serve static files, including the Vue application in public/index.html
	server.use(express.static("public"));
	
	// Routes
	server.use("/api/highlights/", require("./routes/highlights"));
	server.use("/api/teams/", require("./routes/teams"));
	server.use("/api/players/", require("./routes/players"));

	// Route to manually clear cached responses
	server.get("/api/cache/clear", function(request, response) {
		response.json(apicache.clear());
	});

	// Start listening for requests
	server.listen(PORT, function(error) {
		if (error) { throw error; }
		console.log("Listening on " + PORT);
	});
}