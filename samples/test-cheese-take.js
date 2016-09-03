var cheese = require("../").Cheese;
var _ = require("lodash"); ///only required for the sample so not included on package.json

var take = require("../").Utils.take;
var takeUntil = require("../").Utils.takeUntil;
var takeWhile = require("../").Utils.takeWhile;



var ch = new cheese();
var ch1 = new cheese();
var ch2 = new cheese();


ch.fromArray(_.range(100)).then(take(10)).each(function(v) {
	console.log("Ch: ", v.toString());
});

ch1.fromArray(_.range(0, 100, 2)).then(takeWhile(function(v) {
	return +v < 15;
}))
.each(function(v) {
	console.log("Ch1: ", v.toString());
});

ch2.fromArray(_.range(100)).then(takeUntil(function(v) {
	return +v.toString() > 5;
}))
.each(function(v) {
	console.log("Ch2: ", v.toString());
})