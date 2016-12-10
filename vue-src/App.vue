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