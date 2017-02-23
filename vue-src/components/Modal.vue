<template>
	<div class="modal-mask" @click="$emit('close')">
		<div class="modal-container" @click.stop>
			<div class="modal-header">
				<slot name="header">
				</slot>
				<button class="close-button" @click="$emit('close')">
					<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 16 16"><path d="M7,9,2,14,0,12,5,7,0,2,2,0,7,5l5-5,2,2L9,7l5,5-2,2Z" transform="translate(1 1)"/></svg>
				</button>
			</div>
			<div class="modal-body">
				<slot name="body">
				</slot>
			</div>
		</div>
	</div>
</template>

<style lang="scss">

@import "../variables";
$bar-h: 24px;

.modal-mask {
	position: fixed;
	top: 0;
	left: 0;
	z-index: 900;
	width: 100%;
	height: 100%;
	background-color: rgba($gray9, 0.6);
}

.modal-container {
	width: calc(100% - 16px);
	min-width: 304px;
	max-height: calc(100% - 48px);
	box-sizing: border-box;
	padding-bottom: $v-whitespace;
	position: fixed;
	right: 8px;
	top: 24px;
	background: #fff;
	overflow: auto;
	z-index: 1000;
}

.modal-header {
	position: fixed;
	background: #fff;
	padding: $v-whitespace $h-whitespace;
	padding-bottom: $v-whitespace - 1px;
	border-bottom: 1px solid $gray2;
	width: calc(100% - 64px);
	z-index: 200;
}

@media (min-width: 351px) {
	.modal-container {
		width: calc(100% - 48px);
		right: 24px;
	}
	.modal-header {
		width: calc(100% - 96px);
	}
}

.close-button {
	float: right;
	padding: 0;
	position: relative;
	width: 32px;
	margin: 0;
}

.close-button svg {
	box-sizing: border-box;
	height: 100%;
	width: 100%;
	padding: 10px;
	fill: $gray8;
}

/*
*
* Tiled player comparison tables
*
*/

.tile-container {
	min-height: 160px;
	padding-left: 0;
	padding-right: 0;
	padding-top: 80px;
}

.tile {
	display: inline-block;
	vertical-align: top;
	box-sizing: border-box;
	padding: $v-whitespace $h-whitespace $v-whitespace $h-whitespace;
	width: 100%;
	position: relative;
}

/* When width is 640px or wider */
@media (min-width: 641px) {
	.tile {
		width: 50%;
	}
}

@media (min-width: 961px) {
	.tile {
		width: 33.33333%;
	}
}

/*
*
* Bars for player comparison tables
*
*/

table.barchart td.label {
	font-size: $small-font-size;
	line-height: $small-line-height;
	white-space: nowrap;
}

table.barchart td .barchart-bar {
	position: relative;
	width: 100%;
}

table.barchart td .barchart-bar span {
	color: $gray9;
	font-size: $small-font-size;
	line-height: $bar-h;
	margin-left: 6px;
	position: absolute;
	z-index: 100;
}

table.barchart td .barchart-bar div {
	height: $bar-h;
	background: $gray3;
	display: inline-block;
	vertical-align: top;
}

table.barchart td .barchart-bar div:nth-child(3) {
	opacity: 0.5;
}

table.barchart td .barchart-bar div.fill-0 {
	background: #66c2a5;
}

table.barchart td .barchart-bar div.fill-1 {
	background: #fc8d62;
}

table.barchart td .barchart-bar div.fill-2 {
	background: #8da0cb;
}

table.barchart td .barchart-bar div.fill-3 {
	background: #e78ac3;
}

table.barchart td .barchart-bar div.fill-4 {
	background: #a6d854;
}

table.barchart td .barchart-bar div.fill-5 {
	background: #ffd92f;
}

table.barchart td .barchart-bar div.fill-6 {
	background: #e5c494;
}

</style>
