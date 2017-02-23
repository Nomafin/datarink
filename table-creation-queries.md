# Table creation queries

```
CREATE TABLE game_results (
	season SMALLINT NOT NULL,
	datetime TIMESTAMPTZ NOT NULL,
	game_id INTEGER NOT NULL,
	a_team VARCHAR(3) NOT NULL,
	h_team VARCHAR(3) NOT NULL,
	a_final SMALLINT NOT NULL,
	h_final SMALLINT NOT NULL,
	periods SMALLINT NOT NULL,
PRIMARY KEY(season, game_id)
);
```

```
CREATE TABLE game_rosters (
	season SMALLINT NOT NULL,
	game_id INTEGER NOT NULL,
	team VARCHAR(3) NOT NULL,
	player_id INTEGER NOT NULL,
	"first" VARCHAR(64),
	"last" VARCHAR(64),
	jersey SMALLINT,
	"position" VARCHAR(2),
PRIMARY KEY(season, game_id, player_id)
);
```

```
CREATE TABLE game_shifts (
	season SMALLINT NOT NULL,
	game_id INTEGER NOT NULL,
	team VARCHAR(3) NOT NULL,
	player_id INTEGER NOT NULL,
	period SMALLINT NOT NULL,
	shifts VARCHAR(512),
PRIMARY KEY(season, game_id, player_id, period)
);
```

```
CREATE TABLE game_strength_situations (
	season SMALLINT NOT NULL,
	game_id INTEGER NOT NULL,
	team VARCHAR(3) NOT NULL,
	period SMALLINT NOT NULL,
	strength_sit VARCHAR(16),
	timeranges VARCHAR(512),
PRIMARY KEY(season, game_id, team, period, strength_sit)
);
```

```
CREATE TABLE game_stats (
	season SMALLINT NOT NULL,
	game_id INTEGER NOT NULL,
	team VARCHAR(3) NOT NULL,
	player_id INTEGER NOT NULL,
	strength_sit VARCHAR(16) NOT NULL,
	score_sit SMALLINT NOT NULL,
	toi SMALLINT,
	ig SMALLINT,
	"is" SMALLINT,
	ibs SMALLINT,
	ims SMALLINT,
	ia1 SMALLINT,
	ia2 SMALLINT,
	blocked SMALLINT,
	gf SMALLINT,
	ga SMALLINT,
	sf SMALLINT,
	sa SMALLINT,
	bsf SMALLINT,
	bsa SMALLINT,
	msf SMALLINT,
	msa SMALLINT,
	fo_won SMALLINT,
	fo_lost SMALLINT,
	ofo SMALLINT,
	dfo SMALLINT,
	nfo SMALLINT,
	pen_taken SMALLINT,
	pen_drawn SMALLINT,
	cf_off SMALLINT,
	ca_off SMALLINT,
PRIMARY KEY(season, game_id, player_id, strength_sit, score_sit)
);
```

```
CREATE TABLE game_events (
		season SMALLINT NOT NULL,
		game_id INTEGER NOT NULL,
		event_id SMALLINT NOT NULL,
		period SMALLINT,
		"time" SMALLINT,
		a_score SMALLINT,
		h_score SMALLINT,
		a_skaters SMALLINT,
		h_skaters SMALLINT,
		h_zone VARCHAR(1),
		loc_x SMALLINT,
		loc_y SMALLINT,
		"desc" VARCHAR(256),
		"type" VARCHAR(64),
		subtype VARCHAR(128),
		team VARCHAR(3),
		venue VARCHAR(4),
		p1 INTEGER,
		p2 INTEGER,
		p3 INTEGER,
		p1_role VARCHAR(64),
		p2_role VARCHAR(64),
		p3_role VARCHAR(64),
		a_s1 INTEGER,
		a_s2 INTEGER,
		a_s3 INTEGER,
		a_s4 INTEGER,
		a_s5 INTEGER,
		a_s6 INTEGER,
		a_g INTEGER,
		h_s1 INTEGER,
		h_s2 INTEGER,
		h_s3 INTEGER,
		h_s4 INTEGER,
		h_s5 INTEGER,
		h_s6 INTEGER,
		h_g INTEGER,
	PRIMARY KEY(season, game_id, event_id)
	);
```
