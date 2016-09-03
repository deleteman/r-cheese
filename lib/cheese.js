var Streams = require("stream");
var inherits = require("util").inherits;

var Transform = Streams.Transform;

function OutputStream() {
	Transform.call(this);
}

inherits(OutputStream, Transform);

OutputStream.prototype._transform = function(chunk, encoding, callback) {
	callback(null, chunk);
}

var DEFAULT_ARRAY_DELAY = 100; //ms
var DEFAULT_FN_DELAY = 100; //ms


/**

- helper methods included? YES
	* onError : -  
	* fromStream - 
	* fromFn - 
	* fromArray (with a time delay for emitting the values and a default value ) - 
	* each - starts the process - 
	* then - 

*/

function Cheese(stream, transformations) {
	this._stream = stream || null;
	this._stream_ended = false;
	this._outputStream = new OutputStream();
	var self = this;
	if(this._stream !== null) {
		this._stream.on('data', function(d) {
			self._writeToOutput(d);
		});
	}

	this._transformations = transformations || [];
	this._error_transformations = [];
	this.error = false;
	this._source_name = null;
	this._source_interval = null;
}

Cheese.prototype.fromStream = function(stream) {
	var self = this;
	this._stream = stream;
	this._source_name = 'stream';
	this._stream.on('data', function(d) {
		self._writeToOutput(d);
	});
	return this;
};

Cheese.prototype.fromFn = function(fn, delay) {
	if(typeof delay == 'undefined') {
		delay = DEFAULT_FN_DELAY;
	}

	this._source_name = 'fn';
	var self = this;
	this._source_interval = setInterval(function() {
		fn(function(value) {
			if(value === null) {
				return self._endSource();
			}
			self._writeToOutput(value);
		})
	}, delay);
	return this;
};

Cheese.prototype.fromArray = function(arr, delay) {
	if(typeof delay == 'undefined') {
		delay = DEFAULT_ARRAY_DELAY;
	}

	this._source_name = 'array';

	var self = this;
	this._source_interval = setInterval(function() {
		if(arr.length > 0) {
			self._writeToOutput(arr.shift()); 
		} else {
			self._endSource();
		}
	}, delay);
	return this;
};

Cheese.prototype._writeToOutput = function(val) {
	if(!this._stream_ended) {
		if(val !== null) {
			val = val.toString();
		} 
		this._outputStream.write(val);
	} 
}

Cheese.prototype._execute_filter = function(idx, value, handler, transforms) {
	var self = this;

	transforms[idx](value, function(err, resp) {
		if(!err && !!resp === true) {
			if(transforms.length > idx + 1) {
				self._execute(++idx, value, handler, transforms)
			} else {
				handler(value);
			}
		}
	});
};

Cheese.prototype._execute_normal = function(idx, value, handler, transforms) {
	var self = this;

	if(transforms.length == 0) {
		return handler(value);
	}
	var fn = transforms[idx];

	if(fn.length == 2) {
		fn(value, function(err, resp) {
			if(err) {
				return self._execute(0, err, handler, self._error_transformations);
			}
			if(transforms.length > idx + 1) {
				self._execute(++idx, resp, handler, transforms);
			} else {
				handler(resp);
			}
		});
	} else {
		try { 
			var resp = fn(value);
			if(transforms.length > idx + 1) {
				self._execute(++idx, resp, handler, transforms);
			} 
		} catch (e) {
			self._execute(0, e, handler, self._error_transformations);
		}
	}
};

Cheese.prototype._execute_reduce = function(idx, value, handler, transforms) {

	var self = this;

	transforms[idx](this._outputStream, value, function(resp) {
		if(transforms.length > idx + 1) {
			idx++;
			self._execute(idx, resp, handler, transforms);
		} else {
			handler(resp);
		}
	});

};

Cheese.prototype._execute_split = function(idx, value, handler, transforms) {
	var self = this;
	var parts = transforms[idx](value);
	if(transforms.length > idx + 1) {
		idx++;
		self._execute(idx, parts, handler, transforms);
	} else {
		handler(parts);
	}
};

Cheese.prototype._execute_async_transform = function(idx, value, handler, transforms) {
	var self = this;
	transforms[idx](this._outputStream, value, function(err, resp) {
		if(err) {
			return self._execute(0, err, handler, self._error_transformations);
		}
		if(transforms.length > idx + 1) {
			idx++;
			self._execute(idx, resp, handler, transforms);
		} else {
			handler(resp);
		}
	});
	
};

Cheese.prototype._execute_debounce_throttle = function(idx, value, handler, transforms) {

	var self = this;
	transforms[idx](this, value, idx, handler, transforms, function(newStream) {
		if(transforms.length > idx + 1) {
			idx++;
			self._execute(idx, value, handler, transforms);
		} else {
			handler(value);
		}
	});
};

Cheese.prototype._execute = function(idx, value, handler, transforms) {

	var fnType = transforms.length > 0 ? transforms[idx].__fn_type : null;
	
	var execs = {
		'filter': this._execute_filter.bind(this),
		'reduce': this._execute_reduce.bind(this),
		'split': this._execute_split.bind(this),
		'take': this._execute_async_transform.bind(this), //takes care of all 3 types of take
		'debounce': this._execute_debounce_throttle.bind(this),
		'throttle': this._execute_debounce_throttle.bind(this),
		'flatMap': this._execute_normal.bind(this)
	};

	if(execs[fnType]) {
		execs[fnType](idx, value, handler, transforms);
	} else {
		this._execute_normal(idx, value, handler, transforms);
	}
};

Cheese.prototype.merge = function(newStream) {
	var self = this;
	newStream.on('data', function(d) {
		self._writeToOutput(d);
	});
	return this;
}

Cheese.prototype.each = function(handler) {
	var self = this;
	var index = 0;
	//we need to create a new list of transformations up to this point
	//that way when the 'data' event is triggered, only the current list of transformations
	//will be executed for this handler
	var transforms = this._transformations.map(function(t) {
		if(t.newInstance) {
			return t.newInstance(); 
		}
		return t;
	});

	//start the chain of transformations
	this._outputStream.on('data', function(d) {
		self.error = false;
		self._execute(index, d, handler, transforms);
	});

	this._outputStream.on('finish', function() {
		self._endSource();
	});
};

Cheese.prototype._endSource = function() {
	this._stream_ended = true;
	switch(this._source_name) {
		case 'stream': 
			this._stream.end();
			break;
		case 'array': 
		case 'fn':
			clearInterval(this._source_interval);
			break;
	}
}

Cheese.prototype.then = function(fn) {
	this._transformations.push(fn);
	return this;
};

Cheese.prototype.onError = function(fn) {
	this._error_transformations.push(fn);
	return this;
};

module.exports = Cheese;
