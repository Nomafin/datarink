var teamsViewComponent = {
	template: "#teams-view-template",
	data: function() {
		// Once the api populates 'teams' so that it's not null, the loading spinner will disappear
		return {
			teams: null,
			teamsWithAggregatedData: [],
			strengthSit: "all",
			visibleColumns: {
				onIceGoals: true,
				onIceCorsi: true
			},
			sort: {
				col: "toi",
				order: -1
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
	computed: {
		sortedTeams: function() {
			var teams = this.teamsWithAggregatedData;
			var order = this.sort.order < 0 ? "desc" : "asc";
			teams = _.orderBy(teams, this.sort.col, order);
			return teams;	
		}
	},
	methods: {
		fetchData: function() {
			var self = this;
			var xhr = new XMLHttpRequest();
			xhr.open("GET", "./api/teams/");
			xhr.onload = function() {
				self.teams = JSON.parse(xhr.responseText)["teams"];
				self.aggregateTeamData();
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
		aggregateTeamData: function() {
			var teams = this.teams;
			var sits = this.strengthSit === "all" ? ["ev5", "pp", "sh", "penShot", "other"] : [this.strengthSit];
			var stats = ["toi", "gf", "ga", "sf", "sa", "cf", "ca", "cf_adj", "ca_adj"];
			teams.forEach(function(p) {
				stats.forEach(function(st) {
					p[st] = _.sumBy(
						p.data.filter(function(row) { return sits.indexOf(row["strength_sit"]) >= 0; }),
						function(row) { return row[st]; }
					);
				});
			});
			// Compute additional stats
			teams.forEach(function(p) {
				p["g_diff"] = p["gf"] - p["ga"];
				p["sh_pct"] = p["sf"] === 0 ? 0 : p["gf"] / p["sf"];
				p["sv_pct"] = p["sa"] === 0 ? 0 : 1 - p["ga"] / p["sa"];
				p["cf_pct"] = p["cf"] + p["ca"] === 0 ? 0 : p["cf"] / (p["cf"] + p["ca"]);
				p["cf_pct_adj"] = p["cf_adj"] + p["ca_adj"] === 0 ? 0 : p["cf_adj"] / (p["cf_adj"] + p["ca_adj"]);
			});
			this.teamsWithAggregatedData = teams;
		}
	}
}