var cheese = require("../").Cheese;
var fs =  require("fs");

var flatMap = require("../").Utils.flatMap;



var ch = new cheese();

var filenames = ['./test-cheese1.js', './test-cheese2.js'];

ch.fromArray(filenames)
.then(flatMap(function(name) {
	return fs.createReadStream(name.toString())
})).each(function(cnt) {
	console.log("Ch: ", cnt.toString());
});
