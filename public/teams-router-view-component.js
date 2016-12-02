var teamsViewComponent = {
	template: "#teams-view-template",
	data: function() {
		return {
			teams: [],
			strengthSit: "all",
			visibleColumns: {
				onIceGoals: true,
				onIceCorsis: true
			},
			sort: {
				column: "toi",
				order: -1
			}
		}
	},
	filters: {
		percentage: function(value) {
			if (isNaN(value)) {
				return 0;
			} else {
				return Math.round(value * 100);
			}
		},
		signed: function(value) {
			if (value > 0) {
				return "+" + value;
			} else {
				return value;
			}
		}
	},
	computed: {
		processedTeams: function() {
			var processedTeams = this.teams;
			// Update data based on strength situation
			var sits = this.strengthSit === "all" ? ["ev5", "pp", "sh", "penShot", "other"] : [this.strengthSit];
			var stats = ["toi", "gf", "ga", "sf", "sa", "cf", "ca", "cfAdj", "caAdj"];
			processedTeams.forEach(function(p) {
				stats.forEach(function(st) {
					p[st] = _.sumBy(
						p.data.filter(function(row) { return sits.indexOf(row["strengthSit"]) >= 0; }),
						function(row) { return row[st]; }
					);
				});
			});
			// Compute additional stats
			processedTeams.forEach(function(p) {
				p["gDiff"] = p["gf"] - p["ga"];
				p["shPct"] = p["sf"] === 0 ? 0 : p["gf"] / p["sf"];
				p["svPct"] = p["sa"] === 0 ? 0 : 1 - p["ga"] / p["sa"];
				p["cfPct"] = p["cf"] + p["ca"] === 0 ? 0 : p["cf"] / (p["cf"] + p["ca"]);
				p["cfPctAdj"] = p["cfAdj"] + p["caAdj"] === 0 ? 0 : p["cfAdj"] / (p["cfAdj"] + p["caAdj"]);
			});
			// Sort data in ascending order, then reverse for a descending sort
			// Can't return this.sort.order * p[sortCol] because this won't sort strings
			var sortCol = this.sort.column;
			processedTeams = _.sortBy(processedTeams, function(p) { return p[sortCol]; });
			if (this.sort.order === -1) {
				processedTeams.reverse();
			}
			return processedTeams;
		}
	},
	created: function() {
		this.fetchData();
	},
	methods: {
		fetchData: function() {
			var xhr = new XMLHttpRequest();
			var self = this;
			xhr.open("GET", "./api/teams/");
			xhr.onload = function() {
				self.teams = JSON.parse(xhr.responseText)["teams"];
			}
			xhr.send();
		},
		sortBy: function(newSortedCol) {
			var curSortedCol = this.sort.column;
			if (newSortedCol === curSortedCol) {
				this.sort.order *= -1;
			} else {
				this.sort.column = newSortedCol;
				this.sort.order = -1; // Default sort order is descending
			}
		}
	}
}