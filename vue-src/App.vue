<template>
	<div id="app">
		<div class="header">
			<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 32 32">
				<rect class="logo-r" x="20" y="24" width="8" height="8"/>
				<path class="logo-d" d="M4,8V32h8V16h16V0h-8v8Z"/>
			</svg
			><router-link to="/home">Home</router-link
			><router-link to="/teams">Teams</router-link
			><router-link to="/lines">Lines</router-link
			><router-link to="/skaters">Skaters</router-link>
		</div>
		<keep-alive include="Home,Skaters,Teams,Lines">
			<router-view/>
		</keep-alive>
		<div class="section section-footer">
			<a href="mailto:datarink@gmail.com">datarink@gmail.com</a
			><a href="http://www.twitter.com/datarink">@datarink</a>
		</div>
	</div>
</template>

<script>
if (window.location.hostname.toLowerCase() !== "localhost") {
	(function(i,s,o,g,r,a,m){i["GoogleAnalyticsObject"]=r;i[r]=i[r]||function(){
	(i[r].q=i[r].q||[]).push(arguments)},i[r].l=1*new Date();a=s.createElement(o),
	m=s.getElementsByTagName(o)[0];a.async=1;a.src=g;m.parentNode.insertBefore(a,m)
	})(window,document,"script","https://www.google-analytics.com/analytics.js","ga");
	ga("create", "UA-88347694-1", "auto");
}
</script>

<style lang="scss">

@import "variables";

body {
	font-family: $font-stack;
	color: $gray8;
	font-size: $base-font-size;
	line-height: $base-line-height;
	margin: 0;
	overflow-x: hidden;
	min-width: 320px;
}

h1 {
	font-size: 22px;
	line-height: 32px;
	font-weight: 400;
	margin: 0;
}

h2 {
	font-size: 18px;
	line-height: 24px;
	font-weight: 400;
	margin: 0;
}

p {
	font-size: 14px;
	line-height: 20px;
	margin: 0;
}

a,
a:visited {
	color: $green8;
	text-decoration: none;
}

a:hover,
a:active,
a:focus {
	outline: 0;
	text-decoration: underline;
}

/*
*
* Floating message
*
*/

.floating-message {
	position: fixed;
	width: 248px;
	height: 40px;
	left: 16px;
	bottom: 16px;
	z-index: 100;
}

.floating-message p {
	height: 100%;
	width: 100%;
	background: $gray8;
	color: $gray1;
	border-radius: 4px;
	padding: 10px 100px 10px 12px;
	box-sizing: border-box;
	white-space: nowrap;
	text-overflow: ellipsis;
	overflow: hidden;
	box-shadow: 0 0 2px rgba(0,0,0,.12), 0 2px 4px rgba(0,0,0,.24);
}

.floating-message button {
	position: absolute;
	top: 0;
	right: 0;
	height: 40px;
	border-top-left-radius: 0;
	border-bottom-left-radius: 0;
	background: $green4;
	border-color: $green4;
	margin: 0;
}

.floating-message button:hover {
	color: $gray9;
	background: $green5;
	border-color: $green5;
}

.floating-message button:active {
	color: $gray9;
	background: $green6;
	border-color: $green6;
}

.floating-message button:focus {
	border-color: $green7;
}

/*
*
* Page header
*
*/

.header {
	height: 64px;
	position: relative;
	background: $gray1;
}

.header > svg {
	display: none;
	vertical-align: top;
	width: 32px;
	height: 32px;
	margin: 16px 0px 16px 24px;
}

/* When width is 380px or wider */
@media (min-width: 381px) {
	.header > svg {
		display: inline-block;
	}
}

.header svg .logo-r {
	fill: $green6;
}

.header svg .logo-d {
	fill: $green6;
}

.header a {
	display: inline-block;
	vertical-align: top;

	color: $gray8;
	text-decoration: none;

	height: 100%;
	padding: 22px 0;
	margin: 0 0 0 24px;
	box-sizing: border-box;
}

.header a:hover,
.header a:focus {
	border-bottom: 4px solid $gray4;
	outline: 0;
}

.header a.router-link-active {
	border-bottom: 4px solid $green6;
}

.section {
	padding: $v-whitespace $h-whitespace;
	border: 0px solid $gray2;
}

.section.section-table {
	overflow-x: auto;
}

/*
* Page header
*/

.section.section-header {
	padding-top: $v-whitespace-lg;
	padding-bottom: $v-whitespace-lg - 1px;
	border-bottom-width: 1px;
}

.section.section-header h1,
.section.section-header h2 {
	margin-bottom: 0;
}

/*
* Control section
*/

.section.section-control {
	padding-top: $v-whitespace - 1px;
	border-bottom-width: 1px;
	padding-bottom: $v-whitespace - 8px; /* 8px is the bottom-margin on controls */
}

.section.section-control.section-control-table {
	border-bottom-width: 0;
	padding-bottom: 0;
	margin-bottom: -8px; /* Accounts for the 8px bottom-margin on controls */
	margin-right: -8px; /* Accounts for the 8px right-margin on controls */
}

/*
* Page footer
*/

.section.section-footer {
	border-top-width: 1px;
	padding-top: $v-whitespace-lg - 1px;
	padding-bottom: $v-whitespace-lg;
	padding-left: 16px;
	padding-right: 16px;
}

.section.section-footer > * {
	display: inline-block;
	vertical-align: top;
	margin: 0 8px;
}

/*
*
* Input controls
*
*/

input[type="checkbox"] {
	position: absolute;
	opacity: 0;
}

select,
input[type="text"],
input[type="number"],
.search-with-menu label,
button {
	-moz-appearance: none;
	-webkit-appearance: none;
	appearance: none;

	display: inline-block;
	vertical-align: top;

	box-sizing: border-box;
	height: $control-height;
	line-height: $base-line-height;
	border: 1px solid $gray2;
	padding: 0 15px;

	font-size: $base-font-size;
	color: $gray8;
	background: $gray2;
	margin: 0 8px 8px 0;
	border-radius: $border-radius;
}

select {
	margin: 0;
}

/* Hide number spinners */
input[type="number"] {
	-moz-appearance: textfield;
}
input[type="number"]::-webkit-inner-spin-button,
input[type="number"]::-webkit-outer-spin-button {
	-webkit-appearance: none;
	margin: 0;
}

select,
input[type="text"],
input[type="number"],
button {
	cursor: pointer;
}

input[type="text"],
input[type="number"] {
	padding-left: 11px;
	padding-right: 11px;
	background: #fff;
	width: 110px;
}

select:hover,
button:hover {
	background: $gray3;
	border-color: $gray3;
}

select:active,
button:active {
	background: $gray4;
	border-color: $gray4;
}

select:focus,
input[type="text"]:focus,
input[type="number"]:focus,
button:focus {
	outline: 0;
	border-color: $green6;
}

.select-container {
	display: inline-block;
	vertical-align: top;
	height: $control-height;
	position: relative;
	margin: 0 8px 8px 0;
}

.select-container::after {
	position: absolute;
	right: 22px;
	top: 14px;
	content: "";
	border: 4px solid $gray8;
	border-right-color: transparent;
	border-bottom-color: transparent;
	border-left-color: transparent;
}

.search-with-menu .select-container,
.search-with-menu label {
	margin-right: 0;
}

.search-with-menu .select-container::after {
	right: 14px; /* Reduce by 8px because these controls don't have 8px right-margin (they're beside a text field) */
}

select {
	padding-right: 31px; /* Increase right-padding so there's space for caret */
}

select::-ms-expand {
	display: none;
}

button.toggle-button {
	padding-left: 8px;
}

button.toggle-button span.checkbox-container,
input[type="checkbox"] + label.checkbox-container {
	display: inline-block;
	vertical-align: top;
	position: relative;

	box-sizing: border-box;
	height: 16px;
	width: 16px;
	margin-top: 2px;
	margin-right: 8px;

	border: 1px solid $gray3;
	border-radius: 2px;
	background: #fff;
	cursor: pointer;
}

input[type="checkbox"] + label.checkbox-container:hover {
	background: $gray1;
}

input[type="checkbox"] + label.checkbox-container:focus {
	border-color: $green6;
	outline: 0;
}

button.toggle-button.toggle-button-checked span.checkbox-checkmark,
input[type="checkbox"]:checked + label.checkbox-container span.checkbox-checkmark {
	content: "";
	display: block;

	width: 3px;
	height: 6px;
	border: solid $green8;
	border-width: 0 2px 2px 0;

	transform: rotate(45deg);
	margin-top: 2px;
	margin-left: 4px;
}

.search-with-menu {
	display: inline-block;
	vertical-align: top;
	height: $control-height;
	position: relative;
	margin: 0 8px 8px 0
}

.search-with-menu select,
.search-with-menu label {
	border-top-right-radius: 0;
	border-bottom-right-radius: 0;
}

.search-with-menu input[type="text"],
.search-with-menu input[type="number"] {
	border-top-left-radius: 0;
	border-bottom-left-radius: 0;
	margin: 0;
}

.search-with-menu label {
	background: $gray1;
	border-right: 0;
	line-height: $control-height;
}

.search-with-menu .tooltip {
	display: none;
	position: absolute;
	right: 0;
	margin: 4px 0 0 0;
	padding: 8px 16px;
	background: $gray8;
	color: $gray1;
	z-index: 100;
}

.search-with-menu input[type="text"]:focus + .tooltip {
	display: block;
}

.toggle {
	margin: 0 8px 8px 0;
	display: inline-block;
	vertical-align: top;
}

.toggle button {
	margin: 0;
	border-radius: 0;
}

.toggle button:first-child {
	border-top-left-radius: 4px;
	border-bottom-left-radius: 4px;
}

.toggle button:last-child {
	border-top-right-radius: 4px;
	border-bottom-right-radius: 4px;
}

.toggle button.selected {
	background: $green4;
	border-color: $green4;
}

/*
*
* Bulletchart section and legend
*
*/

.section.section-tiled-charts {
	padding-left: 0;
	padding-right: 0;
}

.section.section-tiled-charts .chart-tile {
	display: inline-block;
	vertical-align: top;
	white-space: nowrap;
	position: relative;
	box-sizing: border-box;
	min-width: 320px;
	padding: 0 $h-whitespace $v-whitespace $h-whitespace;
}

.section.section-tiled-charts .chart-tile {
	width: 100%;
}

/* When width is 640px or wider */
@media (min-width: 641px) {
	.section.section-tiled-charts .chart-tile {
		width: 50%;
	}
}

/* When width is 961px or wider */
@media (min-width: 961px) {
	.section.section-tiled-charts .chart-tile {
		width: 33%;
	}
}

/* When width is 1281px or wider */
@media (min-width: 1281px) {
	.section.section-tiled-charts .chart-tile {
		width: 25%;
	}
}

.section.section-legend {
	padding-top: 0;
	padding-left: 16px;
	padding-right: 16px;
	padding-bottom: $v-whitespace - 1px - 8px; /* 8px accounts for the bottom-margin on the legend entries */
	border-bottom-width: 1px;
}

.section-legend > div {
	display: inline-block;
	vertical-align: top;
	margin: 0 8px 8px 8px;
}

.section-legend > div > span {
	display: inline-block;
	vertical-align: top;
	font-size: $base-font-size;
	line-height: $base-line-height;
}

.section-legend > div > span:first-child {
	height: 12px;
	width: 12px;
	margin-top: 4px;
	border-radius: $border-radius;
	margin-right: 6px;
}

/*
*
* Data tables
*
*/

table {
	border-collapse: collapse;
	width: 100%;
}

table th,
table td {
	font-size: 14px;
	line-height: 16px;
	padding: 8px;
	margin: 0;
	text-align: right;
	border-bottom: 1px solid $gray2;
}

table.left-aligned th,
table.left-aligned td {
	text-align: left;
}

table th.left-aligned,
table td.left-aligned {
	text-align: left;
}

table th {
	border-top: 1px solid $gray2;
	background: $gray1;
	vertical-align: top;
	font-size: $small-font-size;
	line-height: $small-line-height;
}

table th.sort-asc:after {
	content: " ↑";
}

table th.sort-desc:after {
	content: " ↓";
}

/* Use tabindex="0" to identify sortable columns */
table th[tabindex="0"] {
	cursor: pointer;
}

table th[tabindex="0"]:hover {
	background: $gray2;
}

table th[tabindex="0"]:active {
	background: $gray3;
}

table th[tabindex="0"]:focus {
	background: $gray2;
	outline: 0;
}

table th span.pct,
table td span.pct {
	font-size: $small-font-size;
	line-height: $small-font-size;
}

table th span.rank,
table td span.rank {
	position: relative;
	font-size: $small-font-size;
}

table th span.rank.tied:before,
table td span.rank.tied:before {
	content: "T";
	position: absolute;
	left: -6px;
	top: -6px;
	font-size: 8px;
}

/* Control column visibility */
table:not(.cols-individual) .cols-individual,
table:not(.cols-on-ice-goals) .cols-on-ice-goals,
table:not(.cols-on-ice-corsi) .cols-on-ice-corsi {
	display: none;
}

/*
*
* Table pagination controls
*
*/

.pagination {
	margin-top: 24px;
}

.pagination button svg {
	width: 16px;
	height: 16px;
	margin: 2px;
	fill: $gray8;
}

.pagination button {
	margin: 0;
	padding-left: 6px;
	padding-right: 6px;
}

.pagination button.previous {
	border-top-right-radius: 0;
	border-bottom-right-radius: 0;
}

.pagination button.next {
	border-top-left-radius: 0;
	border-bottom-left-radius: 0;
}

.pagination > div,
.pagination > div > span {
	display: inline-block;
	vertical-align: top;
}

.pagination > div {
	height: $control-height;
	box-sizing: border-box;
	border-top: 1px solid $gray2;
	border-bottom: 1px solid $gray2;
	background: $gray1;
	padding: 5px 4px;
	min-width: 80px;
	text-align: center;
}

.pagination > div > span {
	padding: 0 2px;
}

/*
*
* Loading spinner
*
*/

.loader {
	height: 64px;
	width: 64px;
	margin: 64px auto;
	position: relative;
	-webkit-animation: rotation 1s infinite linear;
	-moz-animation: rotation 1s infinite linear;
	-o-animation: rotation 1s infinite linear;
	animation: rotation 1s infinite linear;
	border-left: 6px solid $green6;
	border-right: 6px solid $green6;
	border-bottom: 6px solid $green6;
	border-top: 6px solid #fff;
	border-radius: 50%;
}

@-webkit-keyframes rotation {
	from { -webkit-transform: rotate(0deg); }
	to { -webkit-transform: rotate(360deg); }
}

@-moz-keyframes rotation {
	from { -moz-transform: rotate(0deg); }
	to { -moz-transform: rotate(360deg); }
}

@-o-keyframes rotation {
	from { -o-transform: rotate(0deg); }
	to { -o-transform: rotate(360deg); }
}

@keyframes rotation {
	from { transform: rotate(0deg);
	} to { transform: rotate(360deg); }
}
</style>
