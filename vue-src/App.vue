<template>
	<div id="app">
		<div class="header">
			<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
				<path class="logo-r" d="M16,8V32h8V16h8V8Z"/>
				<path class="logo-d" d="M16,24v8H0V8H16V0h8v8H16v8H8v8Z"/>
			</svg
			><router-link to="/teams">Teams</router-link
			><router-link to="/skaters">Skaters</router-link
			><span class="test-tag">Test run</span>
		</div>
		<router-view></router-view>
		<div class="footer">
			<span>Contact</span>
			<a href="mailto:datarink@gmail.com">datarink@gmail.com</a>
			<a href="http://www.twitter.com/datarink">@datarink</a>
		</div>
	</div>
</template>

<style>
body {
  font-family: -apple-system, BlinkMacSystemFont, "Helvetica Neue", Helvetica, Arial, sans-serif;
  color: #37474f;
  font-size: 14px;
  line-height: 20px;
  margin: 0;
  overflow-x: hidden;
  min-width: 320px; }

h1 {
  font-size: 22px;
  line-height: 32px;
  font-weight: 400;
  margin: 0 0 16px 0; }

p {
  font-size: 14px;
  line-height: 20px;
  margin: 0; }

a,
a:visited {
  color: #008050;
  text-decoration: none; }

a:hover,
a:active,
a:focus {
  outline: 0;
  text-decoration: underline; }

/*
*
* Page header
*
*/
.header {
  height: 56px;
  background: #cfd8dc; }

.header > svg {
  display: inline-block;
  vertical-align: top;
  width: 32px;
  height: 32px;
  margin: 12px 0px 12px 24px; }

.header svg .logo-r {
  fill: #5bb271; }

.header svg .logo-d {
  fill: #008050; }

.header a {
  display: inline-block;
  vertical-align: top;
  color: #37474f;
  text-decoration: none;
  border-bottom: 2px solid transparent;
  margin: 18px 0 20px 24px; }

.header a:hover,
.header a:focus {
  border-color: #90a4ae;
  outline: 0; }

.header a.router-link-active {
  color: #37474f;
  border-color: #37474f; }

.header .test-tag {
  display: inline-block;
  background: #5bb271;
  color: #37474f;
  font-size: 11px;
  line-height: 20px;
  font-weight: 700;
  padding: 6px 8px;
  float: right;
  margin: 12px 24px 12px 0;
  border-radius: 4px;
  text-transform: uppercase;
  letter-spacing: -0.5px; }

.footer {
  padding: 48px 24px 32px 24px; }

.footer > * {
  display: inline-block; }

.footer > * + * {
  margin-left: 16px; }

/*
*
* Input controls
*
*/
select,
input[type="text"],
input[type="number"],
label,
button {
  -moz-appearance: none;
  -webkit-appearance: none;
  appearance: none;
  display: inline-block;
  vertical-align: top;
  box-sizing: border-box;
  height: 32px;
  line-height: 20px;
  border: 1px solid #cfd8dc;
  padding: 5px 15px;
  font-size: 14px;
  color: #37474f;
  background: #cfd8dc;
  margin: 0 8px 8px 0;
  border-radius: 4px; }

/* Hide number spinners */
input[type="number"] {
  -moz-appearance: textfield; }

input[type="number"]::-webkit-inner-spin-button,
input[type="number"]::-webkit-outer-spin-button {
  -webkit-appearance: none;
  margin: 0; }

select,
input[type="text"],
input[type="number"],
label.checkbox-label,
button {
  cursor: pointer; }

label.checkbox-label {
  padding-left: 11px; }

input[type="text"],
input[type="number"] {
  padding-left: 11px;
  padding-right: 11px;
  background: #fff;
  width: 110px; }

select:hover,
button:hover {
  background: #b0bec5;
  border-color: #b0bec5; }

select:active,
button:active {
  background: #90a4ae;
  border-color: #90a4ae; }

select:focus,
input[type="text"]:focus,
input[type="number"]:focus,
button:focus {
  outline: 0;
  border-color: #5bb271; }

select::-ms-expand {
  display: none; }

button.toggle-button {
  padding-left: 8px; }

button.toggle-button span.checkbox-container {
  display: inline-block;
  vertical-align: top;
  position: relative;
  box-sizing: border-box;
  height: 16px;
  width: 16px;
  margin-top: 2px;
  margin-right: 8px;
  border: 1px solid #b0bec5;
  border-radius: 2px;
  background: #fff; }

button.toggle-button.toggle-button-checked span.checkbox-checkmark {
  content: "";
  display: block;
  width: 3px;
  height: 6px;
  border: solid #008050;
  border-width: 0 2px 2px 0;
  transform: rotate(45deg);
  margin-top: 2px;
  margin-left: 4px; }

.search-with-menu {
  display: inline-block;
  vertical-align: top;
  height: 32px;
  position: relative;
  margin: 0 8px 8px 0; }

.search-with-menu select,
.search-with-menu label {
  border-top-right-radius: 0;
  border-bottom-right-radius: 0;
  margin: 0; }

.search-with-menu input[type="text"],
.search-with-menu input[type="number"] {
  border-top-left-radius: 0;
  border-bottom-left-radius: 0;
  margin: 0; }

.search-with-menu label {
  background: none;
  border-right: 0; }

.search-with-menu .tooltip {
  display: none;
  position: absolute;
  right: 0;
  margin: 4px 0 0 0;
  padding: 8px 16px;
  background: #37474f;
  color: #eceff1;
  z-index: 100; }

.search-with-menu input[type="text"]:focus + .tooltip {
  display: block; }

/*
*
* Data tables
*
*/
.table-header {
  background: #eceff1;
  padding: 24px 24px 16px 24px; }

.table-header .table-controls {
  padding-bottom: 8px; }

.table-container {
  overflow-x: auto;
  padding: 24px; }

table {
  border-collapse: collapse;
  width: 100%; }

table th,
table td {
  font-size: 14px;
  line-height: 16px;
  padding: 8px;
  margin: 0;
  text-align: right;
  border-bottom: 1px solid #dee3e7; }

table th.left-aligned,
table td.left-aligned {
  text-align: left; }

table th {
  color: #008050;
  border-top-left-radius: 4px;
  border-top-right-radius: 4px;
  vertical-align: top;
  font-size: 12px;
  line-height: 16px; }

table th.sort-asc:after {
  content: " ↑"; }

table th.sort-desc:after {
  content: " ↓"; }

/* Use tabindex="0" to identify sortable columns */
table th[tabindex="0"] {
  cursor: pointer; }

table th[tabindex="0"]:hover {
  background: #cfd8dc; }

table th[tabindex="0"]:active {
  background: #b0bec5; }

table th[tabindex="0"]:focus {
  border-color: #008050;
  outline: 0; }

table th span.pct,
table td span.pct {
  font-size: 12px; }

table th span.rank,
table td span.rank {
  position: relative;
  font-size: 12px; }

table th span.rank.tied:before,
table td span.rank.tied:before {
  content: "T";
  position: absolute;
  left: -6px;
  top: -6px;
  font-size: 8px; }

/* Control column visibility */
table:not(.cols-individual) .cols-individual,
table:not(.cols-on-ice-goals) .cols-on-ice-goals,
table:not(.cols-on-ice-corsi) .cols-on-ice-corsi {
  display: none; }

/*
*
* Table pagination controls
*
*/
.pagination {
  margin-top: 24px; }

.pagination button svg {
  width: 16px;
  height: 16px;
  margin: 2px;
  fill: #37474f; }

.pagination button {
  margin: 0;
  padding-left: 6px;
  padding-right: 6px; }

.pagination button.previous {
  border-top-right-radius: 0;
  border-bottom-right-radius: 0; }

.pagination button.next {
  border-top-left-radius: 0;
  border-bottom-left-radius: 0; }

.pagination > div,
.pagination > div > span {
  display: inline-block;
  vertical-align: top; }

.pagination > div {
  height: 32px;
  box-sizing: border-box;
  border-top: 1px solid #cfd8dc;
  border-bottom: 1px solid #cfd8dc;
  background: #eceff1;
  padding: 5px 4px;
  min-width: 80px;
  text-align: center; }

.pagination > div > span {
  padding: 0 2px; }

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
  border-left: 6px solid #5bb271;
  border-right: 6px solid #5bb271;
  border-bottom: 6px solid #5bb271;
  border-top: 6px solid #fff;
  border-radius: 50%; }

@-webkit-keyframes rotation {
  from {
    -webkit-transform: rotate(0deg); }
  to {
    -webkit-transform: rotate(360deg); } }
@-moz-keyframes rotation {
  from {
    -moz-transform: rotate(0deg); }
  to {
    -moz-transform: rotate(360deg); } }
@-o-keyframes rotation {
  from {
    -o-transform: rotate(0deg); }
  to {
    -o-transform: rotate(360deg); } }
@keyframes rotation {
  from {
    transform: rotate(0deg); }
  to {
    transform: rotate(360deg); } }
</style>