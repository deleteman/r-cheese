var cheese = require("../").Cheese;

var ch = new cheese();
var throttle = require("../").Utils.throttle;

var source = [ 
	{v: "hola", d: 10},
	{v: "adios", d: 1},
	{v: "goodbye", d: 1},
	{v: "hello", d: 5}];

var lastTimestamp = 0;
var index = 0;
ch.fromFn(function(push) {

	if(Date.now() - lastTimestamp > source[index].d) {
		console.log("Pushing value: ", source[index].v, ":", Date.now()	)
		push(source[index].v)
		lastTimestamp = Date.now();
		index++;
	}
	if(index == source.length) {
		push(null);
	}

}).then(throttle(5)).each(function(n) {
	console.log("::Received value: ", n.toString(), ":", Date.now());
})
