"use strict"

var throng = require("throng");
var compression = require("compression");
var apicache = require("apicache");

var PORT = process.env.PORT || 5000;
var WORKERS = process.env.WEB_CONCURRENCY || 1;

if (process.env.NODE_ENV === "development") {
	// Start server without throng since the debugger doesn't work well with throng
	start();
} else {
	throng({
		workers: WORKERS,
		lifetime: Infinity,
		start: start
	});
}

function start() {

	// Create an Express server
	var express = require("express");
	var server = express();

	// Enable compression for static assets and api responses
	server.use(compression());

	// Serve static files, including the Vue application in public/index.html
	server.use(express.static("public"));

	// Routes
	server.use("/api/highlights/", require("./routes/highlights"));
	server.use("/api/teams/", require("./routes/teams"));
	server.use("/api/players/", require("./routes/players"));
	server.use("/api/lines/", require("./routes/lines"));

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
