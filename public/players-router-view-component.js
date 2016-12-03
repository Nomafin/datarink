var playersViewComponent = {
	template: "#players-view-template",
	data: function() {
		// Once the api populates 'players' so that it's not null, the loading spinner will disappear
		return {
			players: null,
			playersWithAggregatedData: [],
			filteredPlayers: [],
			strengthSit: "all",
			minimumToi: 0,
			visibleColumns: {
				individual: true,
				onIceGoals: false,
				onIceCorsi: false
			},
			sort: {
				col: "ip1",
				order: -1
			},
			search: {
				col: "name",
				query: ""
			},
			pagination: {
				rowsPerPage: 20,
				current: 0,
				total: 0
			}
		}
	},
	filters: {
		percentage: function(value) {
			return isNaN(value) ? 0 : Math.round(value * 100);
		},
		signed: function(value) {
			return value > 0 ? "+" + value : value;
		}
	},
	created: function() {
		this.fetchData();
	},
	watch: {
		strengthSit: function() {
			this.aggregatePlayerData();
		},
		search: {
			handler: "filterPlayers",
			deep: true
		}	
	},
	computed: {
		sortedPlayers: function() {
			var players = this.filteredPlayers ? this.filteredPlayers : [];
			var order = this.sort.order < 0 ? "desc" : "asc";
			players = _.orderBy(players, this.sort.col, order);
			this.pagination.current = 0;
			return players;
		},
		pagePlayers: function() {
			var players = this.sortedPlayers ? this.sortedPlayers : [];
			// Sanitize page input
			this.pagination.total = Math.ceil(players.length / this.pagination.rowsPerPage);
			this.pagination.current = Math.min(this.pagination.total - 1, Math.max(0, this.pagination.current));
			// Return sliced array
			var startIdx = this.pagination.current * this.pagination.rowsPerPage;
			var endIdx = startIdx + this.pagination.rowsPerPage;
			return players.slice(startIdx, endIdx);
		}
	},
	methods: {
		fetchData: function() {
			var self = this;
			var xhr = new XMLHttpRequest();
			xhr.open("GET", "./api/players/");
			xhr.onload = function() {
				// Parse json, then append additional properties that don't change based on the strength situation
				self.players = JSON.parse(xhr.responseText)["players"];
				self.players.forEach(function(p) {
					p["name"] = p["first"] + " " + p["last"].toLowerCase();
					p["positions"] = p["positions"].toString().toLowerCase();
					p["teamNames"] = p["teams"].map(function(t) {
						return constants.teamNames[t];
					});
					p["teamNames"] = p["teamNames"].toString().toLowerCase();
					p["teams"] = p["teams"].toString().toLowerCase();
				});
				self.aggregatePlayerData();
			}
			xhr.send();
		},
		sortBy: function(newSortCol) {
			if (newSortCol === this.sort.col) {
				this.sort.order *= -1;
			} else {
				this.sort.col = newSortCol;
				this.sort.order = -1;
			}
		},
		aggregatePlayerData: function() {
			// To aggregate data, use a method that we can explicitly call instead of a computed property
			// Using a computed property caused laggy input fields - it seemed like each time an input changed, 
			// the computed property would check each player and stat to see if any values changed
			var players = this.players;
			var sits = this.strengthSit === "all" ? ["ev5", "pp", "sh", "penShot", "other"] : [this.strengthSit];
			var stats = ["toi", "ig", "is", "ic", "ia1", "ia2", "gf", "ga", "sf", "sa", "cf", "ca", "cf_adj", "ca_adj", "cf_off", "ca_off"];
			players.forEach(function(p) {
				stats.forEach(function(st) {
					p[st] = _.sumBy(
						p.data.filter(function(row) { return sits.indexOf(row["strength_sit"]) >= 0; }),
						function(row) { return row[st]; }
					);
				});
			});	
			// Compute additional stats
			players.forEach(function(p) {
				p["ip1"] = p["ig"] + p["ia1"];
				p["i_sh_pct"] = p["is"] === 0 ? 0 : p["ig"] / p["is"];
				p["g_diff"] = p["gf"] - p["ga"];
				p["sh_pct"] = p["sf"] === 0 ? 0 : p["gf"] / p["sf"];
				p["sv_pct"] = p["sa"] === 0 ? 0 : 1 - p["ga"] / p["sa"];
				p["cf_pct"] = p["cf"] + p["ca"] === 0 ? 0 : p["cf"] / (p["cf"] + p["ca"]);
				p["cf_pct_rel"] = (p["cf"] + p["ca"] === 0 || p["cf_off"] + p["ca_off"] === 0) ? 0 : p["cf"] / (p["cf"] + p["ca"]) - p["cf_off"] / (p["cf_off"] + p["ca_off"]);
				p["cf_pct_adj"] = p["cf_adj"] + p["ca_adj"] === 0 ? 0 : p["cf_adj"] / (p["cf_adj"] + p["ca_adj"]);
			});
			this.playersWithAggregatedData = players;
			// Refilter players based on updated stats
			this.filterPlayers();
		},
		filterPlayers: 
			_.debounce(
				function() {
					var players = this.playersWithAggregatedData;
					// Find players matching search string
					if (this.search.query) {
						var col = this.search.col;
						var query = this.search.query.toLowerCase();
						if (col === "name") {
							players = players.filter(function(p) { return p[col].indexOf(query) >= 0; });
						} else if (col === "teams") {
							players = players.filter(function(p) { return p[col].indexOf(query) >= 0 || p["teamNames"].indexOf(query) >= 0; });
						} else if (col === "positions" && query === "f") {
							players = players.filter(function(p) { return p[col].indexOf("c") >= 0 || p[col].indexOf("r") >= 0 || p[col].indexOf("l") >= 0; });
						} else if (col === "positions") {
							players = players.filter(function(p) { return p[col].indexOf(query) >= 0; });
						}
					}
					// Find players satisying minimum toi
					if (this.minimumToi) {
						var min = this.minimumToi;
						players = players.filter(function(p) { return Math.round(p["toi"] / 60) >= min; });
					}
					// Force the sortedPlayers computed property to be recomputed by setting this.filterPlayers = [] before actually updating it
					// This is faster than using a deep watcher on filteredPlayers (which seems to check every property in filteredPlayers)
					this.filteredPlayers = [];
					this.filteredPlayers = players;
				}, 350
			)
	}
};