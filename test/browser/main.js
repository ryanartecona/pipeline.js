(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);throw new Error("Cannot find module '"+o+"'")}var f=n[o]={exports:{}};t[o][0].call(f.exports,function(e){var n=t[o][1][e];return s(n?n:e)},f,f.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
// http://wiki.commonjs.org/wiki/Unit_Testing/1.0
//
// THIS IS NOT TESTED NOR LIKELY TO WORK OUTSIDE V8!
//
// Originally from narwhal.js (http://narwhaljs.org)
// Copyright (c) 2009 Thomas Robinson <280north.com>
//
// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the 'Software'), to
// deal in the Software without restriction, including without limitation the
// rights to use, copy, modify, merge, publish, distribute, sublicense, and/or
// sell copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:
//
// The above copyright notice and this permission notice shall be included in
// all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED 'AS IS', WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN
// ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION
// WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

// when used in node, this will actually load the util module we depend on
// versus loading the builtin util module as happens otherwise
// this is a bug in node module loading as far as I am concerned
var util = require('util/');

var pSlice = Array.prototype.slice;
var hasOwn = Object.prototype.hasOwnProperty;

// 1. The assert module provides functions that throw
// AssertionError's when particular conditions are not met. The
// assert module must conform to the following interface.

var assert = module.exports = ok;

// 2. The AssertionError is defined in assert.
// new assert.AssertionError({ message: message,
//                             actual: actual,
//                             expected: expected })

assert.AssertionError = function AssertionError(options) {
  this.name = 'AssertionError';
  this.actual = options.actual;
  this.expected = options.expected;
  this.operator = options.operator;
  if (options.message) {
    this.message = options.message;
    this.generatedMessage = false;
  } else {
    this.message = getMessage(this);
    this.generatedMessage = true;
  }
  var stackStartFunction = options.stackStartFunction || fail;

  if (Error.captureStackTrace) {
    Error.captureStackTrace(this, stackStartFunction);
  }
  else {
    // non v8 browsers so we can have a stacktrace
    var err = new Error();
    if (err.stack) {
      var out = err.stack;

      // try to strip useless frames
      var fn_name = stackStartFunction.name;
      var idx = out.indexOf('\n' + fn_name);
      if (idx >= 0) {
        // once we have located the function frame
        // we need to strip out everything before it (and its line)
        var next_line = out.indexOf('\n', idx + 1);
        out = out.substring(next_line + 1);
      }

      this.stack = out;
    }
  }
};

// assert.AssertionError instanceof Error
util.inherits(assert.AssertionError, Error);

function replacer(key, value) {
  if (util.isUndefined(value)) {
    return '' + value;
  }
  if (util.isNumber(value) && (isNaN(value) || !isFinite(value))) {
    return value.toString();
  }
  if (util.isFunction(value) || util.isRegExp(value)) {
    return value.toString();
  }
  return value;
}

function truncate(s, n) {
  if (util.isString(s)) {
    return s.length < n ? s : s.slice(0, n);
  } else {
    return s;
  }
}

function getMessage(self) {
  return truncate(JSON.stringify(self.actual, replacer), 128) + ' ' +
         self.operator + ' ' +
         truncate(JSON.stringify(self.expected, replacer), 128);
}

// At present only the three keys mentioned above are used and
// understood by the spec. Implementations or sub modules can pass
// other keys to the AssertionError's constructor - they will be
// ignored.

// 3. All of the following functions must throw an AssertionError
// when a corresponding condition is not met, with a message that
// may be undefined if not provided.  All assertion methods provide
// both the actual and expected values to the assertion error for
// display purposes.

function fail(actual, expected, message, operator, stackStartFunction) {
  throw new assert.AssertionError({
    message: message,
    actual: actual,
    expected: expected,
    operator: operator,
    stackStartFunction: stackStartFunction
  });
}

// EXTENSION! allows for well behaved errors defined elsewhere.
assert.fail = fail;

// 4. Pure assertion tests whether a value is truthy, as determined
// by !!guard.
// assert.ok(guard, message_opt);
// This statement is equivalent to assert.equal(true, !!guard,
// message_opt);. To test strictly for the value true, use
// assert.strictEqual(true, guard, message_opt);.

function ok(value, message) {
  if (!value) fail(value, true, message, '==', assert.ok);
}
assert.ok = ok;

// 5. The equality assertion tests shallow, coercive equality with
// ==.
// assert.equal(actual, expected, message_opt);

assert.equal = function equal(actual, expected, message) {
  if (actual != expected) fail(actual, expected, message, '==', assert.equal);
};

// 6. The non-equality assertion tests for whether two objects are not equal
// with != assert.notEqual(actual, expected, message_opt);

assert.notEqual = function notEqual(actual, expected, message) {
  if (actual == expected) {
    fail(actual, expected, message, '!=', assert.notEqual);
  }
};

// 7. The equivalence assertion tests a deep equality relation.
// assert.deepEqual(actual, expected, message_opt);

assert.deepEqual = function deepEqual(actual, expected, message) {
  if (!_deepEqual(actual, expected)) {
    fail(actual, expected, message, 'deepEqual', assert.deepEqual);
  }
};

function _deepEqual(actual, expected) {
  // 7.1. All identical values are equivalent, as determined by ===.
  if (actual === expected) {
    return true;

  } else if (util.isBuffer(actual) && util.isBuffer(expected)) {
    if (actual.length != expected.length) return false;

    for (var i = 0; i < actual.length; i++) {
      if (actual[i] !== expected[i]) return false;
    }

    return true;

  // 7.2. If the expected value is a Date object, the actual value is
  // equivalent if it is also a Date object that refers to the same time.
  } else if (util.isDate(actual) && util.isDate(expected)) {
    return actual.getTime() === expected.getTime();

  // 7.3 If the expected value is a RegExp object, the actual value is
  // equivalent if it is also a RegExp object with the same source and
  // properties (`global`, `multiline`, `lastIndex`, `ignoreCase`).
  } else if (util.isRegExp(actual) && util.isRegExp(expected)) {
    return actual.source === expected.source &&
           actual.global === expected.global &&
           actual.multiline === expected.multiline &&
           actual.lastIndex === expected.lastIndex &&
           actual.ignoreCase === expected.ignoreCase;

  // 7.4. Other pairs that do not both pass typeof value == 'object',
  // equivalence is determined by ==.
  } else if (!util.isObject(actual) && !util.isObject(expected)) {
    return actual == expected;

  // 7.5 For all other Object pairs, including Array objects, equivalence is
  // determined by having the same number of owned properties (as verified
  // with Object.prototype.hasOwnProperty.call), the same set of keys
  // (although not necessarily the same order), equivalent values for every
  // corresponding key, and an identical 'prototype' property. Note: this
  // accounts for both named and indexed properties on Arrays.
  } else {
    return objEquiv(actual, expected);
  }
}

function isArguments(object) {
  return Object.prototype.toString.call(object) == '[object Arguments]';
}

function objEquiv(a, b) {
  if (util.isNullOrUndefined(a) || util.isNullOrUndefined(b))
    return false;
  // an identical 'prototype' property.
  if (a.prototype !== b.prototype) return false;
  //~~~I've managed to break Object.keys through screwy arguments passing.
  //   Converting to array solves the problem.
  if (isArguments(a)) {
    if (!isArguments(b)) {
      return false;
    }
    a = pSlice.call(a);
    b = pSlice.call(b);
    return _deepEqual(a, b);
  }
  try {
    var ka = objectKeys(a),
        kb = objectKeys(b),
        key, i;
  } catch (e) {//happens when one is a string literal and the other isn't
    return false;
  }
  // having the same number of owned properties (keys incorporates
  // hasOwnProperty)
  if (ka.length != kb.length)
    return false;
  //the same set of keys (although not necessarily the same order),
  ka.sort();
  kb.sort();
  //~~~cheap key test
  for (i = ka.length - 1; i >= 0; i--) {
    if (ka[i] != kb[i])
      return false;
  }
  //equivalent values for every corresponding key, and
  //~~~possibly expensive deep test
  for (i = ka.length - 1; i >= 0; i--) {
    key = ka[i];
    if (!_deepEqual(a[key], b[key])) return false;
  }
  return true;
}

// 8. The non-equivalence assertion tests for any deep inequality.
// assert.notDeepEqual(actual, expected, message_opt);

assert.notDeepEqual = function notDeepEqual(actual, expected, message) {
  if (_deepEqual(actual, expected)) {
    fail(actual, expected, message, 'notDeepEqual', assert.notDeepEqual);
  }
};

// 9. The strict equality assertion tests strict equality, as determined by ===.
// assert.strictEqual(actual, expected, message_opt);

assert.strictEqual = function strictEqual(actual, expected, message) {
  if (actual !== expected) {
    fail(actual, expected, message, '===', assert.strictEqual);
  }
};

// 10. The strict non-equality assertion tests for strict inequality, as
// determined by !==.  assert.notStrictEqual(actual, expected, message_opt);

assert.notStrictEqual = function notStrictEqual(actual, expected, message) {
  if (actual === expected) {
    fail(actual, expected, message, '!==', assert.notStrictEqual);
  }
};

function expectedException(actual, expected) {
  if (!actual || !expected) {
    return false;
  }

  if (Object.prototype.toString.call(expected) == '[object RegExp]') {
    return expected.test(actual);
  } else if (actual instanceof expected) {
    return true;
  } else if (expected.call({}, actual) === true) {
    return true;
  }

  return false;
}

function _throws(shouldThrow, block, expected, message) {
  var actual;

  if (util.isString(expected)) {
    message = expected;
    expected = null;
  }

  try {
    block();
  } catch (e) {
    actual = e;
  }

  message = (expected && expected.name ? ' (' + expected.name + ').' : '.') +
            (message ? ' ' + message : '.');

  if (shouldThrow && !actual) {
    fail(actual, expected, 'Missing expected exception' + message);
  }

  if (!shouldThrow && expectedException(actual, expected)) {
    fail(actual, expected, 'Got unwanted exception' + message);
  }

  if ((shouldThrow && actual && expected &&
      !expectedException(actual, expected)) || (!shouldThrow && actual)) {
    throw actual;
  }
}

// 11. Expected to throw an error:
// assert.throws(block, Error_opt, message_opt);

assert.throws = function(block, /*optional*/error, /*optional*/message) {
  _throws.apply(this, [true].concat(pSlice.call(arguments)));
};

// EXTENSION! This is annoying to write outside this module.
assert.doesNotThrow = function(block, /*optional*/message) {
  _throws.apply(this, [false].concat(pSlice.call(arguments)));
};

assert.ifError = function(err) { if (err) {throw err;}};

var objectKeys = Object.keys || function (obj) {
  var keys = [];
  for (var key in obj) {
    if (hasOwn.call(obj, key)) keys.push(key);
  }
  return keys;
};

},{"util/":3}],2:[function(require,module,exports){
module.exports = function isBuffer(arg) {
  return arg && typeof arg === 'object'
    && typeof arg.copy === 'function'
    && typeof arg.fill === 'function'
    && typeof arg.readUInt8 === 'function';
}
},{}],3:[function(require,module,exports){
(function (process,global){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

var formatRegExp = /%[sdj%]/g;
exports.format = function(f) {
  if (!isString(f)) {
    var objects = [];
    for (var i = 0; i < arguments.length; i++) {
      objects.push(inspect(arguments[i]));
    }
    return objects.join(' ');
  }

  var i = 1;
  var args = arguments;
  var len = args.length;
  var str = String(f).replace(formatRegExp, function(x) {
    if (x === '%%') return '%';
    if (i >= len) return x;
    switch (x) {
      case '%s': return String(args[i++]);
      case '%d': return Number(args[i++]);
      case '%j':
        try {
          return JSON.stringify(args[i++]);
        } catch (_) {
          return '[Circular]';
        }
      default:
        return x;
    }
  });
  for (var x = args[i]; i < len; x = args[++i]) {
    if (isNull(x) || !isObject(x)) {
      str += ' ' + x;
    } else {
      str += ' ' + inspect(x);
    }
  }
  return str;
};


// Mark that a method should not be used.
// Returns a modified function which warns once by default.
// If --no-deprecation is set, then it is a no-op.
exports.deprecate = function(fn, msg) {
  // Allow for deprecating things in the process of starting up.
  if (isUndefined(global.process)) {
    return function() {
      return exports.deprecate(fn, msg).apply(this, arguments);
    };
  }

  if (process.noDeprecation === true) {
    return fn;
  }

  var warned = false;
  function deprecated() {
    if (!warned) {
      if (process.throwDeprecation) {
        throw new Error(msg);
      } else if (process.traceDeprecation) {
        console.trace(msg);
      } else {
        console.error(msg);
      }
      warned = true;
    }
    return fn.apply(this, arguments);
  }

  return deprecated;
};


var debugs = {};
var debugEnviron;
exports.debuglog = function(set) {
  if (isUndefined(debugEnviron))
    debugEnviron = process.env.NODE_DEBUG || '';
  set = set.toUpperCase();
  if (!debugs[set]) {
    if (new RegExp('\\b' + set + '\\b', 'i').test(debugEnviron)) {
      var pid = process.pid;
      debugs[set] = function() {
        var msg = exports.format.apply(exports, arguments);
        console.error('%s %d: %s', set, pid, msg);
      };
    } else {
      debugs[set] = function() {};
    }
  }
  return debugs[set];
};


/**
 * Echos the value of a value. Trys to print the value out
 * in the best way possible given the different types.
 *
 * @param {Object} obj The object to print out.
 * @param {Object} opts Optional options object that alters the output.
 */
/* legacy: obj, showHidden, depth, colors*/
function inspect(obj, opts) {
  // default options
  var ctx = {
    seen: [],
    stylize: stylizeNoColor
  };
  // legacy...
  if (arguments.length >= 3) ctx.depth = arguments[2];
  if (arguments.length >= 4) ctx.colors = arguments[3];
  if (isBoolean(opts)) {
    // legacy...
    ctx.showHidden = opts;
  } else if (opts) {
    // got an "options" object
    exports._extend(ctx, opts);
  }
  // set default options
  if (isUndefined(ctx.showHidden)) ctx.showHidden = false;
  if (isUndefined(ctx.depth)) ctx.depth = 2;
  if (isUndefined(ctx.colors)) ctx.colors = false;
  if (isUndefined(ctx.customInspect)) ctx.customInspect = true;
  if (ctx.colors) ctx.stylize = stylizeWithColor;
  return formatValue(ctx, obj, ctx.depth);
}
exports.inspect = inspect;


// http://en.wikipedia.org/wiki/ANSI_escape_code#graphics
inspect.colors = {
  'bold' : [1, 22],
  'italic' : [3, 23],
  'underline' : [4, 24],
  'inverse' : [7, 27],
  'white' : [37, 39],
  'grey' : [90, 39],
  'black' : [30, 39],
  'blue' : [34, 39],
  'cyan' : [36, 39],
  'green' : [32, 39],
  'magenta' : [35, 39],
  'red' : [31, 39],
  'yellow' : [33, 39]
};

// Don't use 'blue' not visible on cmd.exe
inspect.styles = {
  'special': 'cyan',
  'number': 'yellow',
  'boolean': 'yellow',
  'undefined': 'grey',
  'null': 'bold',
  'string': 'green',
  'date': 'magenta',
  // "name": intentionally not styling
  'regexp': 'red'
};


function stylizeWithColor(str, styleType) {
  var style = inspect.styles[styleType];

  if (style) {
    return '\u001b[' + inspect.colors[style][0] + 'm' + str +
           '\u001b[' + inspect.colors[style][1] + 'm';
  } else {
    return str;
  }
}


function stylizeNoColor(str, styleType) {
  return str;
}


function arrayToHash(array) {
  var hash = {};

  array.forEach(function(val, idx) {
    hash[val] = true;
  });

  return hash;
}


function formatValue(ctx, value, recurseTimes) {
  // Provide a hook for user-specified inspect functions.
  // Check that value is an object with an inspect function on it
  if (ctx.customInspect &&
      value &&
      isFunction(value.inspect) &&
      // Filter out the util module, it's inspect function is special
      value.inspect !== exports.inspect &&
      // Also filter out any prototype objects using the circular check.
      !(value.constructor && value.constructor.prototype === value)) {
    var ret = value.inspect(recurseTimes, ctx);
    if (!isString(ret)) {
      ret = formatValue(ctx, ret, recurseTimes);
    }
    return ret;
  }

  // Primitive types cannot have properties
  var primitive = formatPrimitive(ctx, value);
  if (primitive) {
    return primitive;
  }

  // Look up the keys of the object.
  var keys = Object.keys(value);
  var visibleKeys = arrayToHash(keys);

  if (ctx.showHidden) {
    keys = Object.getOwnPropertyNames(value);
  }

  // IE doesn't make error fields non-enumerable
  // http://msdn.microsoft.com/en-us/library/ie/dww52sbt(v=vs.94).aspx
  if (isError(value)
      && (keys.indexOf('message') >= 0 || keys.indexOf('description') >= 0)) {
    return formatError(value);
  }

  // Some type of object without properties can be shortcutted.
  if (keys.length === 0) {
    if (isFunction(value)) {
      var name = value.name ? ': ' + value.name : '';
      return ctx.stylize('[Function' + name + ']', 'special');
    }
    if (isRegExp(value)) {
      return ctx.stylize(RegExp.prototype.toString.call(value), 'regexp');
    }
    if (isDate(value)) {
      return ctx.stylize(Date.prototype.toString.call(value), 'date');
    }
    if (isError(value)) {
      return formatError(value);
    }
  }

  var base = '', array = false, braces = ['{', '}'];

  // Make Array say that they are Array
  if (isArray(value)) {
    array = true;
    braces = ['[', ']'];
  }

  // Make functions say that they are functions
  if (isFunction(value)) {
    var n = value.name ? ': ' + value.name : '';
    base = ' [Function' + n + ']';
  }

  // Make RegExps say that they are RegExps
  if (isRegExp(value)) {
    base = ' ' + RegExp.prototype.toString.call(value);
  }

  // Make dates with properties first say the date
  if (isDate(value)) {
    base = ' ' + Date.prototype.toUTCString.call(value);
  }

  // Make error with message first say the error
  if (isError(value)) {
    base = ' ' + formatError(value);
  }

  if (keys.length === 0 && (!array || value.length == 0)) {
    return braces[0] + base + braces[1];
  }

  if (recurseTimes < 0) {
    if (isRegExp(value)) {
      return ctx.stylize(RegExp.prototype.toString.call(value), 'regexp');
    } else {
      return ctx.stylize('[Object]', 'special');
    }
  }

  ctx.seen.push(value);

  var output;
  if (array) {
    output = formatArray(ctx, value, recurseTimes, visibleKeys, keys);
  } else {
    output = keys.map(function(key) {
      return formatProperty(ctx, value, recurseTimes, visibleKeys, key, array);
    });
  }

  ctx.seen.pop();

  return reduceToSingleString(output, base, braces);
}


function formatPrimitive(ctx, value) {
  if (isUndefined(value))
    return ctx.stylize('undefined', 'undefined');
  if (isString(value)) {
    var simple = '\'' + JSON.stringify(value).replace(/^"|"$/g, '')
                                             .replace(/'/g, "\\'")
                                             .replace(/\\"/g, '"') + '\'';
    return ctx.stylize(simple, 'string');
  }
  if (isNumber(value))
    return ctx.stylize('' + value, 'number');
  if (isBoolean(value))
    return ctx.stylize('' + value, 'boolean');
  // For some reason typeof null is "object", so special case here.
  if (isNull(value))
    return ctx.stylize('null', 'null');
}


function formatError(value) {
  return '[' + Error.prototype.toString.call(value) + ']';
}


function formatArray(ctx, value, recurseTimes, visibleKeys, keys) {
  var output = [];
  for (var i = 0, l = value.length; i < l; ++i) {
    if (hasOwnProperty(value, String(i))) {
      output.push(formatProperty(ctx, value, recurseTimes, visibleKeys,
          String(i), true));
    } else {
      output.push('');
    }
  }
  keys.forEach(function(key) {
    if (!key.match(/^\d+$/)) {
      output.push(formatProperty(ctx, value, recurseTimes, visibleKeys,
          key, true));
    }
  });
  return output;
}


function formatProperty(ctx, value, recurseTimes, visibleKeys, key, array) {
  var name, str, desc;
  desc = Object.getOwnPropertyDescriptor(value, key) || { value: value[key] };
  if (desc.get) {
    if (desc.set) {
      str = ctx.stylize('[Getter/Setter]', 'special');
    } else {
      str = ctx.stylize('[Getter]', 'special');
    }
  } else {
    if (desc.set) {
      str = ctx.stylize('[Setter]', 'special');
    }
  }
  if (!hasOwnProperty(visibleKeys, key)) {
    name = '[' + key + ']';
  }
  if (!str) {
    if (ctx.seen.indexOf(desc.value) < 0) {
      if (isNull(recurseTimes)) {
        str = formatValue(ctx, desc.value, null);
      } else {
        str = formatValue(ctx, desc.value, recurseTimes - 1);
      }
      if (str.indexOf('\n') > -1) {
        if (array) {
          str = str.split('\n').map(function(line) {
            return '  ' + line;
          }).join('\n').substr(2);
        } else {
          str = '\n' + str.split('\n').map(function(line) {
            return '   ' + line;
          }).join('\n');
        }
      }
    } else {
      str = ctx.stylize('[Circular]', 'special');
    }
  }
  if (isUndefined(name)) {
    if (array && key.match(/^\d+$/)) {
      return str;
    }
    name = JSON.stringify('' + key);
    if (name.match(/^"([a-zA-Z_][a-zA-Z_0-9]*)"$/)) {
      name = name.substr(1, name.length - 2);
      name = ctx.stylize(name, 'name');
    } else {
      name = name.replace(/'/g, "\\'")
                 .replace(/\\"/g, '"')
                 .replace(/(^"|"$)/g, "'");
      name = ctx.stylize(name, 'string');
    }
  }

  return name + ': ' + str;
}


function reduceToSingleString(output, base, braces) {
  var numLinesEst = 0;
  var length = output.reduce(function(prev, cur) {
    numLinesEst++;
    if (cur.indexOf('\n') >= 0) numLinesEst++;
    return prev + cur.replace(/\u001b\[\d\d?m/g, '').length + 1;
  }, 0);

  if (length > 60) {
    return braces[0] +
           (base === '' ? '' : base + '\n ') +
           ' ' +
           output.join(',\n  ') +
           ' ' +
           braces[1];
  }

  return braces[0] + base + ' ' + output.join(', ') + ' ' + braces[1];
}


// NOTE: These type checking functions intentionally don't use `instanceof`
// because it is fragile and can be easily faked with `Object.create()`.
function isArray(ar) {
  return Array.isArray(ar);
}
exports.isArray = isArray;

function isBoolean(arg) {
  return typeof arg === 'boolean';
}
exports.isBoolean = isBoolean;

function isNull(arg) {
  return arg === null;
}
exports.isNull = isNull;

function isNullOrUndefined(arg) {
  return arg == null;
}
exports.isNullOrUndefined = isNullOrUndefined;

function isNumber(arg) {
  return typeof arg === 'number';
}
exports.isNumber = isNumber;

function isString(arg) {
  return typeof arg === 'string';
}
exports.isString = isString;

function isSymbol(arg) {
  return typeof arg === 'symbol';
}
exports.isSymbol = isSymbol;

function isUndefined(arg) {
  return arg === void 0;
}
exports.isUndefined = isUndefined;

function isRegExp(re) {
  return isObject(re) && objectToString(re) === '[object RegExp]';
}
exports.isRegExp = isRegExp;

function isObject(arg) {
  return typeof arg === 'object' && arg !== null;
}
exports.isObject = isObject;

function isDate(d) {
  return isObject(d) && objectToString(d) === '[object Date]';
}
exports.isDate = isDate;

function isError(e) {
  return isObject(e) &&
      (objectToString(e) === '[object Error]' || e instanceof Error);
}
exports.isError = isError;

function isFunction(arg) {
  return typeof arg === 'function';
}
exports.isFunction = isFunction;

function isPrimitive(arg) {
  return arg === null ||
         typeof arg === 'boolean' ||
         typeof arg === 'number' ||
         typeof arg === 'string' ||
         typeof arg === 'symbol' ||  // ES6 symbol
         typeof arg === 'undefined';
}
exports.isPrimitive = isPrimitive;

exports.isBuffer = require('./support/isBuffer');

function objectToString(o) {
  return Object.prototype.toString.call(o);
}


function pad(n) {
  return n < 10 ? '0' + n.toString(10) : n.toString(10);
}


var months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep',
              'Oct', 'Nov', 'Dec'];

// 26 Feb 16:19:34
function timestamp() {
  var d = new Date();
  var time = [pad(d.getHours()),
              pad(d.getMinutes()),
              pad(d.getSeconds())].join(':');
  return [d.getDate(), months[d.getMonth()], time].join(' ');
}


// log is just a thin wrapper to console.log that prepends a timestamp
exports.log = function() {
  console.log('%s - %s', timestamp(), exports.format.apply(exports, arguments));
};


/**
 * Inherit the prototype methods from one constructor into another.
 *
 * The Function.prototype.inherits from lang.js rewritten as a standalone
 * function (not on Function.prototype). NOTE: If this file is to be loaded
 * during bootstrapping this function needs to be rewritten using some native
 * functions as prototype setup using normal JavaScript does not work as
 * expected during bootstrapping (see mirror.js in r114903).
 *
 * @param {function} ctor Constructor function which needs to inherit the
 *     prototype.
 * @param {function} superCtor Constructor function to inherit prototype from.
 */
exports.inherits = require('inherits');

exports._extend = function(origin, add) {
  // Don't do anything if add isn't an object
  if (!add || !isObject(add)) return origin;

  var keys = Object.keys(add);
  var i = keys.length;
  while (i--) {
    origin[keys[i]] = add[keys[i]];
  }
  return origin;
};

function hasOwnProperty(obj, prop) {
  return Object.prototype.hasOwnProperty.call(obj, prop);
}

}).call(this,require("/Users/rartecon/Dropbox/Code/JavaScript/pipeline.js/node_modules/browserify/node_modules/insert-module-globals/node_modules/process/browser.js"),typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"./support/isBuffer":2,"/Users/rartecon/Dropbox/Code/JavaScript/pipeline.js/node_modules/browserify/node_modules/insert-module-globals/node_modules/process/browser.js":5,"inherits":4}],4:[function(require,module,exports){
if (typeof Object.create === 'function') {
  // implementation from standard node.js 'util' module
  module.exports = function inherits(ctor, superCtor) {
    ctor.super_ = superCtor
    ctor.prototype = Object.create(superCtor.prototype, {
      constructor: {
        value: ctor,
        enumerable: false,
        writable: true,
        configurable: true
      }
    });
  };
} else {
  // old school shim for old browsers
  module.exports = function inherits(ctor, superCtor) {
    ctor.super_ = superCtor
    var TempCtor = function () {}
    TempCtor.prototype = superCtor.prototype
    ctor.prototype = new TempCtor()
    ctor.prototype.constructor = ctor
  }
}

},{}],5:[function(require,module,exports){
// shim for using process in browser

var process = module.exports = {};

process.nextTick = (function () {
    var canSetImmediate = typeof window !== 'undefined'
    && window.setImmediate;
    var canPost = typeof window !== 'undefined'
    && window.postMessage && window.addEventListener
    ;

    if (canSetImmediate) {
        return function (f) { return window.setImmediate(f) };
    }

    if (canPost) {
        var queue = [];
        window.addEventListener('message', function (ev) {
            var source = ev.source;
            if ((source === window || source === null) && ev.data === 'process-tick') {
                ev.stopPropagation();
                if (queue.length > 0) {
                    var fn = queue.shift();
                    fn();
                }
            }
        }, true);

        return function nextTick(fn) {
            queue.push(fn);
            window.postMessage('process-tick', '*');
        };
    }

    return function nextTick(fn) {
        setTimeout(fn, 0);
    };
})();

process.title = 'browser';
process.browser = true;
process.env = {};
process.argv = [];

process.binding = function (name) {
    throw new Error('process.binding is not supported');
}

// TODO(shtylman)
process.cwd = function () { return '/' };
process.chdir = function (dir) {
    throw new Error('process.chdir is not supported');
};

},{}],6:[function(require,module,exports){
var assert = require('./assert')


var Bond = function(userBreakHandler) {
  this.init(userBreakHandler)
}

// default state
Bond.prototype.isBroken = false
// default handler
Bond.prototype._userBreakHandler = function() {}

Bond.prototype.init = function(userBreakHandler) {
  assert(typeof userBreakHandler === 'function', 'Bond can only be constructed with a break handler function.')
  this._userBreakHandler = userBreakHandler
}
Bond.prototype.break = function() {
  if (!this.isBroken) {
    this.isBroken = true
    this._userBreakHandler()
    delete this.userBreakHandler
  }
}


module.exports = Bond

},{"./assert":14}],7:[function(require,module,exports){
var assert = require('./assert')
var Pipe = require('./Pipe')
var Inlet = require('./Inlet')
var schedulers = require('./schedulers')


var HistoryInlet = function(capacity) {
  if (typeof capacity === 'undefined') capacity = 0
  assert(typeof capacity === 'number' && capacity >= 0, 'HistoryInlet can only be constructed with an integer capacity.')
  this.capacity = Math.floor(capacity)
  return this
}
HistoryInlet.prototype = new Inlet()

HistoryInlet.prototype.capacity = undefined

HistoryInlet.prototype._hasSavedError = false
HistoryInlet.prototype._savedError = undefined
HistoryInlet.prototype._savedValues = undefined
HistoryInlet.prototype._saveNextValue = function(v) {
  if (this.isDone || this._hasSavedError) return
  this._savedValues || (this._savedValues = [])
  this._savedValues.push(v)
  if (this.capacity && this._savedValues.length > this.capacity) {
    this._savedValues.shift()
  }
}
// override sendNext to save the newest value,
// and drop the oldest if at full capacity
HistoryInlet.prototype.sendNext = function(v) {
  assert(!this.isDone, 'cannot send `next` event on finished Pipe')
  this._saveNextValue(v)
  this._broadcastToOutlets('sendNext', v)
}
// override sendError to save the error to send after replayed values
HistoryInlet.prototype.sendError = function(e) {
  assert(!this.isDone, 'cannot send `error` event on finished Pipe')
  this.isDone = true
  this._hasSavedError = true
  this._savedError = e
  this._broadcastToOutlets('sendError', e)
  delete this.outlets
}
// override attachOutlet to send savedValues on subscription,
// then send error (if one is saved) or done (if finished)
HistoryInlet.prototype.attachOutlet = function(outlet) {
  var vs = this._savedValues
  if (vs && vs.length) {
    for (var i in vs) {
      outlet.sendNext(vs[i])
    }
  }
  if (this._hasSavedError) {
    outlet.sendError(this._savedError)
  } else if (this.isDone) {
    outlet.sendDone()
  } else {
    var attachmentBond = Inlet.prototype.attachOutlet.call(this, outlet)
  }
  return attachmentBond
}


module.exports = HistoryInlet

},{"./Inlet":8,"./Pipe":11,"./assert":14,"./schedulers":16}],8:[function(require,module,exports){
var assert = require('./assert')
var Pipe = require('./Pipe')
var Bond = require('./Bond')


var Inlet = function() {
  this.init()
}
Inlet.prototype = new Pipe()

Inlet.prototype.attachOutlet = function(outlet) {
  assert(typeof outlet.sendNext === 'function'
      && typeof outlet.sendError === 'function'
      && typeof outlet.sendDone === 'function')
  assert(!this.isDone, 'cannot attach an outlet to a finished Pipe')
  this.outlets || (this.outlets = [])
  this.outlets.push(outlet)
  var thisInlet = this
  return new Bond(function() {
    thisInlet._detachOutlet(outlet)
  })
}

Inlet.prototype.sendNext = function(v) {
  assert(!this.isDone, 'cannot send next event on finished Pipe')
  this._broadcastToOutlets('sendNext', v)
}
Inlet.prototype.sendError = function(e) {
  assert(!this.isDone, 'cannot send error event on finished Pipe')
  this.isDone = true
  this._broadcastToOutlets('sendError', e)
  delete this.outlets
}
Inlet.prototype.sendDone = function() {
  assert(!this.isDone, 'cannot send done event on finished Pipe')
  this.isDone = true
  this._broadcastToOutlets('sendDone')
  delete this.outlets
}


module.exports = Inlet

},{"./Bond":6,"./Pipe":11,"./assert":14}],9:[function(require,module,exports){
var Bond = require('./Bond')


var MultiBond = function(bonds) {
  this.init(bonds)
}
MultiBond.prototype = new Bond(function(){})

MultiBond._bonds = undefined

MultiBond.prototype.init = function(bonds) {
  (this._bonds = bonds) || (this._bonds = [])
}
MultiBond.prototype.addBond = function(newBond) {
  if (this.isBroken) {
    newBond.break()
  }
  else {
    this._bonds || (this._bonds = [])
    this._bonds.push(newBond)
  }
}
MultiBond.prototype.break = function() {
  if (!this.isBroken) {
    this.isBroken = true
    for (var i=0; i < this._bonds.length; i++) {
      this._bonds[i].break()
    }
    delete this._bonds
  }
}


module.exports = MultiBond

},{"./Bond":6}],10:[function(require,module,exports){
var assert = require('./assert')
var Bond = require('./Bond')
var MultiBond = require('./MultiBond')


var Outlet = function(handlers){
  this.init(handlers)
}
Outlet.prototype = {
  init: function(handlers) {
    var nextIsFunction = typeof handlers.next === 'function'
    var errorIsFunction = typeof handlers.error === 'function'
    var doneIsFunction = typeof handlers.done === 'function'
    
    assert(nextIsFunction || errorIsFunction || doneIsFunction)

    nextIsFunction && (this._nextHandler  = handlers.next)
    errorIsFunction && (this._errorHandler = handlers.error)
    doneIsFunction && (this._doneHandler  = handlers.done)

    var thisOutlet = this
    this.bond = new MultiBond([new Bond(function() {
      delete thisOutlet._nextHandler
      delete thisOutlet._errorHandler
      delete thisOutlet._doneHandler
    })])
  }

  // noop default handlers, overwritten by 
  // constructor args when supplied
  ,_nextHandler:  function(v) {}
  ,_errorHandler: function(e) {}
  ,_doneHandler:  function() {}
  
  // Outlet interface:
  //  sendNext(v), sendError(e), sendDone()
  ,sendNext: function(v) {
    this._nextHandler.call(null, v)
  }
  ,sendError: function(e) {
    if (this.hasOwnProperty('_errorHandler')) {
      var errorHandler = this._errorHandler
      this.bond.break()
      errorHandler(e)
    }
    else {
      this.bond.break()
    }
  }
  ,sendDone: function() {
    if (this.hasOwnProperty('_doneHandler')) {
      var doneHandler = this._doneHandler
      this.bond.break()
      doneHandler()
    }
    else {
      this.bond.break()
    }
  }
}


module.exports = Outlet

},{"./Bond":6,"./MultiBond":9,"./assert":14}],11:[function(require,module,exports){
var assert = require('./assert')
var Outlet = require('./Outlet')
var Bond = require('./Bond')
var MultiBond = require('./MultiBond')
var schedulers = require('./schedulers')
var _ = require('./utils')

"use strict"
var undefined


var Pipe = function(onAttach) {
  this.init(onAttach)
}
Pipe.empty = function() {
  return new Pipe(function(outlet) {
    outlet.sendDone()
  })
}
Pipe.return = function(x) {
  return new Pipe(function(outlet) {
    outlet.sendNext(x)
    outlet.sendDone()
  })
}
Pipe.fromArray = function(arr) {
  return new Pipe(function(outlet) {
    for (var i = 0; i < arr.length; i++) {
      outlet.sendNext(arr[i])
    }
    outlet.sendDone()
  })
}
Pipe.of = function(/*args...*/) {
  var args = [].slice.call(arguments)
  return Pipe.fromArray(args)
}

Pipe.prototype = {
  init: function(onAttach) {
    if (typeof onAttach === 'function') {
      this.onAttach = onAttach
    }
  }
  // default state
  ,isDone: false
  // user attachment handler
  ,onAttach: undefined

  ,attachOutlet: function(outlet) {
    assert(typeof outlet.sendNext === 'function'
        && typeof outlet.sendError === 'function'
        && typeof outlet.sendDone === 'function')
    assert(!this.isDone, 'cannot attach an outlet to a finished Pipe')
    if (outlet.bond.isBroken) return

    var thisP = this

    schedulers.schedule(function() {
      if (outlet.bond.isBroken) return
      if (thisP.onAttach) {
        var innerBond = thisP.onAttach(outlet)
        if (innerBond instanceof Bond) {
          outlet.bond.addBond(innerBond)
        }
      }

      if (outlet.bond.isBroken) return
      thisP.outlets || (thisP.outlets = [])
      thisP.outlets.push(outlet)
      outlet.bond.addBond(new Bond(function() {
        thisP._detachOutlet(outlet)
      }))
    })
  }

  ,on: function(handlers) {
    var outlet = new Outlet(handlers)
    if (typeof handlers.bond === 'function') {
      handlers.bond.call(null, outlet.bond)
    }
    return this.attachOutlet(outlet)
  }
  ,onNext:  function(handler) {return this.on({next:  handler})}
  ,onError: function(handler) {return this.on({error: handler})}
  ,onDone:  function(handler) {return this.on({done:  handler})}

  ,_detachOutlet: function(outletToDetach) {
    if (!this.outlets) return
    // search from newest to oldest outlets
    for (var i = this.outlets.length; i >= 0; i--) {
      if (this.outlets[i] === outletToDetach) {
        this.outlets.splice(i, 1)
        break;
      }
    }
  }
  ,_broadcastToOutlets: function(method, arg) {
    if (this.outlets) {
      for (var i in this.outlets) {
        var outlet = this.outlets[i]
        try {
          outlet[method](arg)
        } catch (e) {
          // TODO: handle outlet errors
        }
      }
    }
  }


  ,map: function(mapFn) {
    var upstream = this
    var downstream = new Pipe(function(downstreamOutlet) {
      upstream.on({
        next: function(x) {
          downstreamOutlet.sendNext(mapFn(x))
        }
        ,error: function(e) {downstreamOutlet.sendError(e)}
        ,done: function() {downstreamOutlet.sendDone()}
      })
    })
    return downstream
  }

  // monadic bind
  ,mergeMap: function(mapFn) {
    var upstream = this;
    var downstream = new Pipe(function(downstreamOutlet) {
      var interspersedPipes = []
      var upstreamIsDone = false
      var addNewPipe = function(p) {
        interspersedPipes.push(p)
        p.on({
          next: function(x) {downstreamOutlet.sendNext(x)}
          ,error: forwardError
          ,done: function() {finishPipe(p)}
        })
      }
      var finishPipe = function(p) {
        var indexToRemove = interspersedPipes.indexOf(p)
        if (indexToRemove > -1) {
          interspersedPipes.splice(indexToRemove, 1)
        }
        maybeFinishUpstream()
      }
      var forwardError = function(e) {
        downstreamOutlet.sendError(e)
      }
      var maybeFinishUpstream = (function() {
        var hasSentDownstreamDoneOnce = false
        return function() {
          if (!interspersedPipes.length && upstreamIsDone && !hasSentDownstreamDoneOnce) {
            hasSentDownstreamDoneOnce = true
            downstreamOutlet.sendDone()
          }
        }
      })()

      upstream.on({
        next: function(x_original) {
          if (!upstreamIsDone) {
            var should_stop = false
            var requestStop = function() {
              should_stop = true
            }
            var x_transformed = mapFn(x_original, requestStop)
            if (typeof x_transformed != 'undefined' && !should_stop) {
              assert(x_transformed instanceof Pipe)
              addNewPipe(x_transformed)
            } else if (should_stop) {
              upstreamIsDone = true
              maybeFinishUpstream()
            }
          }
        }
        ,error: forwardError
        ,done: function() {
          upstreamIsDone = true
          maybeFinishUpstream()
        }
      })
    })
    return downstream
  }

  ,merge: function() {
    return this.mergeMap(function(innerPipe) {
      return innerPipe
    })
  }

  ,concat: function() {
    var sourcePipe = this
    var sourcePipeHasFinished = false
    var pipesToConcat = []
    var activePipe
    var receivingOutlet

    var receiveNextPipeToConcat = function(p) {
      pipesToConcat.push(p)
      if (typeof activePipe === 'undefined') {
        attachToNextPipe()
      }
      finishConcatPipeIfNecessary()
    }
    var attachToNextPipe = function() {
      if (typeof activePipe !== 'undefined') return
      var nextPipe = pipesToConcat.shift()
      activePipe = nextPipe
      nextPipe.on({
        bond: function(b) {
          receivingOutlet.bond.addBond(b)
        }
        ,next: function(v) {
          receivingOutlet.sendNext(v)
        }
        ,error: function(e) {
          receivingOutlet.sendError(e)
        }
        ,done: function() {
          activePipe = undefined
          finishConcatPipeIfNecessary()
          if (receivingOutlet.bond.isBroken) return
          schedulers.schedule(attachToNextPipe)
        }
      })
    }
    var finishConcatPipeIfNecessary = function() {
      if ( typeof activePipe === 'undefined'
        && sourcePipeHasFinished === true
        && pipesToConcat.length === 0
        && !receivingOutlet.bond.isBroken)
      {
        receivingOutlet.sendDone()
      }
    }

    return new Pipe(function (outlet) {
      receivingOutlet = outlet
      sourcePipe.on({
        next: function(innerPipe) {
          receiveNextPipeToConcat(innerPipe)
        }
        ,error: function(e) {
          outlet.sendError(e)
        }
        ,done: function() {
          sourcePipeHasFinished = true
          finishConcatPipeIfNecessary()
        }
      })
    })
  }

  ,concatMap: function(mapFn) {
    return this.map(mapFn).concat()
  }

  ,concatWith: function(nextPipe1, nextPipe2, nextPipeN) {
    var firstPipe = this
    var nextPipes = [].slice.call(arguments)
    var concatPipe = new Pipe(function(outlet) {
      firstPipe.on({
        next: function(x) {
          outlet.sendNext(x)
        },
        error: function(e) {
          outlet.sendError(e)
        },
        done: function() {
          if (nextPipes.length) {
            (nextPipes.shift()).attachOutlet(outlet)
          } else {
            outlet.sendDone()
          }
        }
      })
    })
    return concatPipe
  }  

  ,filter: function(predicateFn) {
    return this.mergeMap(function(x) {
      if (predicateFn(x)) {
        return Pipe.return(x)
      } else {
        return Pipe.empty()
      }
    })
  }

  ,mapReplace: function(replacement) {
    return this.map(function() {
      return replacement
    })
  }

  ,skipWhile: function(shouldKeepSkipping) {
    var hasStoppedSkipping = false
    return this.filter(function(x) {
      if (hasStoppedSkipping) {
        return true
      } else if (shouldKeepSkipping(x)) {
        return false
      } else {
        hasStoppedSkipping = true
        return true
      }
    })
  }

  ,skipUntil: function(shouldStopSkipping) {
    return this.skipWhile(function(x) {
      return !shouldStopSkipping(x)
    })
  }

  ,skip: function(n) {
    return this.skipWhile(function(x) {
      if (n > 0) {
        n -= 1
        return true
      } else {
        return false
      }
    })
  }

  ,takeWhile: function(shouldKeepTaking) {
    return this.mergeMap(function(x, requestStop) {
      if (shouldKeepTaking(x)) {
        return Pipe.return(x)
      } else {
        requestStop()
        return Pipe.empty()
      }
    })
  }

  ,takeUntil: function(shouldStopTaking) {
    return this.takeWhile(function(x) {
      return !shouldStopTaking(x)
    })
  }

  ,take: function(n) {
    return this.takeWhile(function() {
      if (n > 0) {
        n -= 1
        return true
      } else {
        return false
      }
    })
  }

  ,mergeWith: function(adjacent1, adjacent2, adjacentN) {
    var adjacentPipes = [].slice.call(arguments)
    adjacentPipes.unshift(this)
    return new Pipe(function(outlet) {
      var activeAdjacentPipes = adjacentPipes.slice()
      for (var i = 0; i < adjacentPipes.length; i++) {
        (function(i) {
          var thisAdjacentPipe = adjacentPipes[i]
          thisAdjacentPipe.on({
            next: function(x) {
              outlet.sendNext(x)
            }
            ,error: function(e) {
              outlet.sendError(e)
            }
            ,done: function() {
              activeAdjacentPipes.splice(activeAdjacentPipes.indexOf(thisAdjacentPipe), 1)
              if (activeAdjacentPipes.length == 0) {
                outlet.sendDone()
              }
            }
          })
        })(i)
      }
    })
  }

  ,zipWith: function(adjacent1, adjacent2, adjacentN) {
    var adjacentPipes = [].slice.call(arguments)
    adjacentPipes.unshift(this)
    var numAdjacentPipes = adjacentPipes.length

    return new Pipe(function (outlet) {
      var hasFinished = new Array(numAdjacentPipes)
      var nextValues = new Array(numAdjacentPipes)
      
      for (var i = 0; i < numAdjacentPipes; i++) {(function(i) {
        hasFinished[i] = false
        nextValues[i] = []

        var sendNextTupleIfNecessary = function(v) {
          nextValues[i].push(v)
          for (var j = 0; j < numAdjacentPipes; j++) {
            if (!nextValues[j].length) return
          }
          var tupleToSend = []
          for (j = 0; j < numAdjacentPipes; j++) {
            tupleToSend.push(nextValues[j].shift())
          }
          outlet.sendNext(tupleToSend)
          sendDoneIfNecessary()
        }
        var sendDoneIfNecessary = function() {
          for (var j = 0; j < numAdjacentPipes; j++) {
            if (hasFinished[j] && !nextValues[j].length) {
              outlet.sendDone()
            }
          }
        }

        adjacentPipes[i].on({
          bond: function(b) {
            outlet.bond.addBond(b)
          }
          ,next: sendNextTupleIfNecessary
          ,error: function(e) {
            outlet.sendError()
          }
          ,done: function() {
            hasFinished[i] = true
            sendDoneIfNecessary()
          }
        })
      })(i)}
    })
  }

  ,scan: function(seed, reduceFn) {
    var acc = seed
    return this.map(function(v) {
      return (acc = reduceFn(acc, v))
    })
  }

  ,scan1: function(reduceFn) {
    var acc
    var hasReceivedFirstVal = false
    return this.concatMap(function(v) {
      if (hasReceivedFirstVal) {
        return Pipe.return(acc = reduceFn(acc, v))
      }
      else {
        hasReceivedFirstVal = true
        acc = v
        return Pipe.empty()
      }
    })
  }

  ,deliverOn: function(scheduler) {
    var thisP = this
    return new Pipe(function(outlet) {
      return thisP.on({
        next: function(v) {
          scheduler.schedule(function() {
            outlet.sendNext(v)
          })
        }
        ,error: function(e) {
          scheduler.schedule(function() {
            outlet.sendError(e)
          })
        }
        ,done: function() {
          scheduler.schedule(function() {
            outlet.sendDone()
          })
        }
      })
    })
  }
}


module.exports = Pipe

},{"./Bond":6,"./MultiBond":9,"./Outlet":10,"./assert":14,"./schedulers":16,"./utils":17}],12:[function(require,module,exports){
var assert = require('./assert')
var Pipe = require('./Pipe')
var MultiBond = require('./MultiBond')
var Bond = require('./Bond')
var schedulers = require('./schedulers')
var AsyncScheduler = schedulers.AsyncScheduler

"use strict"
var undefined


var Promise = function() {
  this.init()
}
Promise.prototype = new Pipe()

Promise.statusTypePending   = 1
Promise.statusTypeFulfilled = 2
Promise.statusTypeRejected  = 3

Promise.fulfilled = function(value) {
  var p = new Promise()
  p.status = Promise.statusTypeFulfilled
  p.value = value
  return p
}
Promise.rejected = function(reason) {
  var p = new Promise()
  p.status = Promise.statusTypeRejected
  p.reason = reason
  return p
}

Promise.prototype.status = Promise.statusTypePending
Promise.prototype.value = undefined
Promise.prototype.reason = undefined

Promise.prototype.init = function() {}

Promise.prototype.attachOutlet = function(outlet) {
  var thisP = this
  var multiBond = new MultiBond()
  AsyncScheduler.schedule(function() {
    if (multiBond.isBroken) return
    if (thisP.status === Promise.statusTypePending) {
      thisP.outlets || (thisP.outlets = [])
      thisP.outlets.push(outlet)
      multiBond.addBond(new Bond(function() {
        thisP._detachOutlet(outlet)
      }))
    } else if (thisP.status === Promise.statusTypeFulfilled) {
      AsyncScheduler.schedule(function() {
        if (multiBond.isBroken) return
        outlet.sendNext(thisP.value)
      })
    } else if (thisP.status === Promise.statusTypeRejected) {
      AsyncScheduler.schedule(function() {
        if (multiBond.isBroken) return
        outlet.sendError(thisP.reason)
      })
    }
  })
  return multiBond
}
Promise.prototype.then = function(onFulfilled, onRejected) {
  var thenPromise = new Promise()
  var resolveWithHandler = function(handler, value, isFulfillment, resolvingPromise) {
    var x
    if (typeof handler === 'function') {
      try {
        x = handler(value)
      } catch (e) {
        resolvingPromise.reject(e)
        return
      }
      resolvingPromise.resolve(x)
    } else {
      resolvingPromise[isFulfillment? 'fulfill': 'reject'](value)
    }
  }
  this.on({
    next: function(v) {
      resolveWithHandler(onFulfilled, v, true, thenPromise)
    }
    ,error: function(r) {
      resolveWithHandler(onRejected, r, false, thenPromise)
    }
  })
  return thenPromise
}
Promise.prototype.sendNext = function(v) {
  assert(this.status === Promise.statusTypePending, 'can only fulfill a pending Promise')
  var thisP = this
  AsyncScheduler.schedule(function() {
    if (thisP.status === Promise.statusTypePending) {
      thisP.status = Promise.statusTypeFulfilled
      thisP.value = v
      thisP._broadcastToOutlets('sendNext', v)
      thisP.isDone = true
      thisP._broadcastToOutlets('sendDone')
      delete thisP.outlets
    }
  })
}
Promise.prototype.sendError = function(r) {
  assert(this.status === Promise.statusTypePending, 'can only reject a pending Promise')
  var thisP = this
  AsyncScheduler.schedule(function() {
    if (thisP.status === Promise.statusTypePending) {
      thisP.status = Promise.statusTypeRejected
      thisP.reason = r
      thisP.isDone = true
      thisP._broadcastToOutlets('sendError', r)
      delete thisP.outlets
    }
  })
}
Promise.prototype.sendDone = function() {
  assert(this.status !== Promise.statusTypePending && !this.isDone
        ,'can only finish a fulfilled or rejected Promise')
  Pipe.prototype.sendDone.call(this)
}
var resolveToPromise = function resolveToPromise(promise, x) {
  assert(promise.status = Promise.statusTypePending, 'can only resolve a pending Promise')
  // Promise Resolution Procedure ©
  if (x === promise) {
    promise.reject(new TypeError('promise cycle detected'))
    return
  }
  if (x instanceof Promise) {
    // (implementation-specific)
    // make promise adopt the state of x
  }
  if (x === Object(x) /* x is an Object */) {
    var then
    try {
      then = x.then
    } catch (e) {
      promise.reject(e)
      return
    }
    if (typeof then === 'function') {
      var aHandlerHasBeenCalled = false
      try {
        then.call(x,
          function resolvePromise(y) {
            if (aHandlerHasBeenCalled) {
              return
            }
            aHandlerHasBeenCalled = true
            try {
              resolveToPromise(promise, y)
            } catch (e) {}
          },
          function rejectPromise(r) {
            if (aHandlerHasBeenCalled) {
              return
            }
            aHandlerHasBeenCalled = true
            try {
              promise.reject(r)
            } catch (e) {}
          }
        )
      } catch (e) {
        AsyncScheduler.schedule(function() {
          if (!aHandlerHasBeenCalled) {
            promise.reject(e)
          }
        })
      }
      return
    }
  }
  promise.fulfill(x)
}
Promise.prototype.fulfill = Promise.prototype.sendNext
Promise.prototype.reject = Promise.prototype.sendError
Promise.prototype.resolve = function(x) {
  resolveToPromise(this, x)
}


module.exports = Promise

},{"./Bond":6,"./MultiBond":9,"./Pipe":11,"./assert":14,"./schedulers":16}],13:[function(require,module,exports){
var assert = require('./assert')
var Pipe = require('./Pipe')
var Inlet = require('./Inlet')
var schedulers = require('./schedulers')


// TOOD: should this be the constructor,
//   or something like PropertyInlet.withInitial?
var PropertyInlet = function(initialValue) {
  this._currentValue = initialValue
  return this
}
PropertyInlet.prototype = new Inlet()

PropertyInlet.prototype._currentValue = undefined

// public getter for _currentValue
PropertyInlet.prototype.currentValue = function() {
  return this._currentValue
}

PropertyInlet.prototype.attachOutlet = function(outlet) {
  var bond = Inlet.prototype.attachOutlet.call(this, outlet)
  if (bond.isBroken) return
  outlet.sendNext(this._currentValue)
  return bond
}
PropertyInlet.prototype.sendNext = function(v) {
  assert(!this.isDone, 'cannot send `next` event on finished Pipe')
  this._currentValue = v
  this._broadcastToOutlets('sendNext', v)
}


module.exports = PropertyInlet

},{"./Inlet":8,"./Pipe":11,"./assert":14,"./schedulers":16}],14:[function(require,module,exports){
module.exports = function assert(testVal, message) {
  if (!testVal) {
    throw new TypeError(message)
  }
}

},{}],15:[function(require,module,exports){
var Pipe = require('./Pipe')
var Inlet = require('./Inlet')
var HistoryInlet = require('./HistoryInlet')
var PropertyInlet = require('./PropertyInlet')
var Outlet = require('./Outlet')
var Promise = require('./Promise')
var Bond = require('./Bond')
var MultiBond = require('./MultiBond')
var schedulers = require('./schedulers')

module.exports = {
  Pipe: Pipe
  ,Inlet: Inlet
  ,HistoryInlet: HistoryInlet
  ,PropertyInlet: PropertyInlet
  ,Outlet: Outlet
  ,Promise: Promise
  ,Bond: Bond
  ,MultiBond: MultiBond
  ,SyncScheduler: schedulers.SyncScheduler
  ,AsyncScheduler: schedulers.AsyncScheduler
  ,currentScheduler: schedulers.currentScheduler
  ,schedule: schedulers.schedule
}

},{"./Bond":6,"./HistoryInlet":7,"./Inlet":8,"./MultiBond":9,"./Outlet":10,"./Pipe":11,"./Promise":12,"./PropertyInlet":13,"./schedulers":16}],16:[function(require,module,exports){
(function (process){
/**
 * Thoughts:
 *
 * desired scheduling syntax?
 * perhaps:
 *   PL.schedule(jobFn)
 *   PL.scheduleSync(jobFn)
 *   PL.scheduleAsync(jobFn)
 * or:
 *   PL.schedule(jobFn)
 *   PL.SyncScheduler.schedule(jobFn)
 *   PL.AsyncScheduler.schedule(jobFn)
 */

var _current
var currentScheduler = function() {
  return _current || defaultScheduler()
}

var defaultScheduler = function() {
  return AsyncScheduler
}

var schedule = function(jobFn) {
  currentScheduler().schedule(jobFn)
}

var withCurrentScheduler = function(scheduler, jobFn) {
  if (_current === scheduler) {
    jobFn()
    return
  }
  else {
    var prevScheduler = _current
    _current = scheduler
    try {
      jobFn()
    }
    finally {
      _current = prevScheduler
    }
  }
}

var SyncScheduler = {
  schedule: function(userFn) {
    userFn()
  }
}

var AsyncScheduler = (function() {
  var _queue = []
  var _queue_processor_is_scheduled = false
  var _is_currently_processing_queue = false

  var _drain_queue = function() {
    withCurrentScheduler(AsyncScheduler, function() {
      _is_currently_processing_queue = true
      while(_queue.length) {
        var job = _queue.shift()
        try {
          job()
        } catch (e) {}
      }
      _is_currently_processing_queue = false
      _queue_processor_is_scheduled = false
    })
  }
  var _drain_queue_later = function() {
    if (_queue_processor_is_scheduled) return
    _schedule_later(_drain_queue)
    _queue_processor_is_scheduled = true
  }

  // TODO: 
  //   automatically detect best async scheduler
  //   based on availability in environment:
  //    - process.nextTick
  //    - MutationObserver
  //    - setImmediate
  //    - postMessage
  //    - MessageChannel
  //    - script readystatechanged
  //    - setTimeout
  var _schedule_later = (function() {
    if (typeof process !== 'undefined'
      && typeof process.nextTick === 'undefined')
    {
      return process.nextTick
    }
    else if (typeof setImmediate === 'function')
    {
      return setImmediate
    }
    else if (typeof setTimeout === 'function')
    {
      return function (jobFn) {
        setTimeout(jobFn, 1)
      }
    }
    else
    {
      throw new Exception('this environment does not have a supported method of asynchronously scheduling a function invocation')
    }
  })()

  return {
    schedule: function(jobFn) {
      _queue.push(jobFn)
      _drain_queue_later()
    }
  }
})()

module.exports = {
  schedule: schedule
  ,currentScheduler: currentScheduler
  ,SyncScheduler: SyncScheduler
  ,AsyncScheduler: AsyncScheduler
}

}).call(this,require("/Users/rartecon/Dropbox/Code/JavaScript/pipeline.js/node_modules/browserify/node_modules/insert-module-globals/node_modules/process/browser.js"))
},{"/Users/rartecon/Dropbox/Code/JavaScript/pipeline.js/node_modules/browserify/node_modules/insert-module-globals/node_modules/process/browser.js":5}],17:[function(require,module,exports){
var debug_mode = false
var debug = function debug() {
  if (debug_mode) {
    console.log.apply(console, [].slice.call(arguments))
  }
}

module.exports = {
  debug: debug
}

},{}],18:[function(require,module,exports){
var assert = require('assert')
var PL = require('../src/pipeline')
var _ = require('./utils')


describe('Bond', function() {

  it('calls its break handler when broken', function(done) {
    var bond = new PL.Bond(function() {
      done()
    })
    bond.break()
  })

  it('can only be broken once', function() {
    var breakCount = 0
    var bond = new PL.Bond(function() {
      breakCount++
    })
    bond.break()
    bond.break()
    assert(breakCount === 1)
  })

  it('cannot be broken from within its own break handler', function() {
    var breakCount = 0
    var bond = new PL.Bond(function() {
      breakCount++
      bond.break()
    })
    bond.break()
    assert(breakCount === 1)
  })
})

},{"../src/pipeline":15,"./utils":25,"assert":1}],19:[function(require,module,exports){
var assert = require('assert')
var PL = require('../src/pipeline')
var _ = require('./utils')


describe('HistoryInlet', function() {
  this.timeout(500 /* ms */)

  describe('with a capacity of 1', function() {

    beforeEach(function() {
      this.historyInlet = new PL.HistoryInlet(1);
    })

    it('should send the most recent value', function(done) {
      this.historyInlet.sendNext('first')
      this.historyInlet.sendNext('second')

      this.historyInlet.onNext(function(v) {
        if (v === 'second') {
          done()
        } else {
          done('error!')
        }
      })
    })

    it('should, after finishing, should send the most recent value to new outlets', function(done) {
      this.historyInlet.sendNext('first')
      this.historyInlet.sendNext('second')
      this.historyInlet.sendDone()

      var values = []

      this.historyInlet.on({
        next: function(v) {
          values.push(v)
        }
        ,done: function() {
          assert.deepEqual(values, ['second'])
          done()
        }
      })
    })

    it('should not send values that were not received', function(done) {
      this.historyInlet.sendDone()

      // if done gets called with a value, it's treated as an error
      this.historyInlet.on({
        next: done
        ,error: done
        ,done: done
      })
    })

    it('should resend received errors to new outlets', function(done) {
      this.historyInlet.sendError('error!')

      this.historyInlet.on({
        next: done
        ,error: function(e) {
          done()
        }
        ,done: function() {
          done('error!')
        }
      })
    })

    it('can cancel between sent values', function(done) {
      var receivedValues = []
      var bond = this.historyInlet.on({
        next: function(v) {
          receivedValues.push(v)
        }
        ,error: done
        ,done: function() {
          done('should not be reached')
        }
      })

      this.historyInlet.sendNext(1)
      this.historyInlet.sendNext(2)
      bond.break()
      this.historyInlet.sendNext(3)
      this.historyInlet.sendDone()
      assert.deepEqual(receivedValues, [1, 2])
      done()
    })
  })

  describe('with an unlimited capacity', function() {

    beforeEach(function() {
      this.historyInlet = new PL.HistoryInlet
    })

    it('should, after finishing, send all received values to new outlets', function(done) {
      this.historyInlet.sendNext('first')
      this.historyInlet.sendNext('second')
      this.historyInlet.sendDone()

      _.assertAccum(this.historyInlet, ['first', 'second'], done)
    })

    it('should preserve order of saved values and live values', function(done) {
      this.historyInlet.sendNext('first')

      _.assertAccum(this.historyInlet, ['first', 'second', 'third'], done)

      var historyInlet = this.historyInlet
      setTimeout(function() {
        historyInlet.sendNext('third')
        historyInlet.sendDone()
      }, 5)
      this.historyInlet.sendNext('second')
    })
  })
})

},{"../src/pipeline":15,"./utils":25,"assert":1}],20:[function(require,module,exports){
var assert = require('assert')
var PL = require('../src/pipeline')
var _ = require('./utils')


describe('Inlet', function() {
  this.timeout(500 /* ms */)

  beforeEach(function() {
    this.inlet = new PL.Inlet()
  })

  it('should send a next value', function(done) {
    _.assertAccum(this.inlet, [1], done)
    this.inlet.sendNext(1)
    this.inlet.sendDone()
  })

  it('should only send next values after outlet attachment', function(done) {
    this.inlet.sendNext(1)
    _.assertAccum(this.inlet, [2,3], done)
    this.inlet.sendNext(2)
    this.inlet.sendNext(3)
    this.inlet.sendDone()
  })

  it('should send an error', function(done) {
    this.inlet.on({
      error: function(e) {
        done()
      }
      ,done: function() {
        done('did not send an error :(')
      }
    })
    this.inlet.sendError('yay error!')
  })

  it('should finish immediately', function(done) {
    _.assertAccum(this.inlet, [], done)
    this.inlet.sendDone()
  })

  describe('attached outlet', function() {
    describe('cancellation', function() {

      it('can happen after values have been sent', function(done) {
        var bond = this.inlet.on({
          next: function(v) {
            done()
          }
          ,done: function() {
            done('done event should never be received')
          }
        })
        this.inlet.sendNext(1)
        bond.break()
        this.inlet.sendNext(2)
        this.inlet.sendDone()
      })

      it('can happen within an event handler', function(done) {
        var bond = this.inlet.on({
          next: function(v) {
            done()
            bond.break()
          }
          ,done: function() {
            done('done event should never be received')
          }
        })
        this.inlet.sendNext(1)
        this.inlet.sendNext(2)
        this.inlet.sendDone()
      })
    })
  })
})

},{"../src/pipeline":15,"./utils":25,"assert":1}],21:[function(require,module,exports){
require('./pipe')
require('./inlet')
require('./historyInlet')
require('./propertyInlet')
require('./bond')
require('./multiBond')
},{"./bond":18,"./historyInlet":19,"./inlet":20,"./multiBond":22,"./pipe":23,"./propertyInlet":24}],22:[function(require,module,exports){
var assert = require('assert')
var PL = require('../src/pipeline')
var _ = require('./utils')


describe('MultiBond', function() {
    
  beforeEach(function() {
    var thisTest = this
    this.breakCount = 0
    this.incBreakCount = function() {thisTest.breakCount++}
  })

  it('given no child bonds, does nothing when broken', function() {
    var multiBond = new PL.MultiBond()
    multiBond.break()
  })

  it('given multiple child bonds, breaks each of them once', function() {
    var multiBond = new PL.MultiBond([
      new PL.Bond(this.incBreakCount)
      ,new PL.Bond(this.incBreakCount)
      ,new PL.Bond(this.incBreakCount)
    ])
    multiBond.break()
    assert(this.breakCount === 3)
  })

  it('treats bonds given at construction time and those added later the same', function() {
    var multiBond = new PL.MultiBond([new PL.Bond(this.incBreakCount)])
    multiBond.addBond(new PL.Bond(this.incBreakCount))
    multiBond.break()
    assert(this.breakCount === 2)
  })

  it('when already broken, added child bonds are immediately broken', function() {
    var multiBond = new PL.MultiBond([new PL.Bond(this.incBreakCount)])
    multiBond.break()
    assert(this.breakCount === 1)

    multiBond.addBond(new PL.Bond(this.incBreakCount))
    assert(this.breakCount === 2)
  })
})

},{"../src/pipeline":15,"./utils":25,"assert":1}],23:[function(require,module,exports){
var assert = require('assert')
var PL = require('../src/pipeline')
var Pipe = PL.Pipe
var _ = require('./utils')

describe('Pipe', function(){
  this.timeout(500 /* ms */)


  it('should basically work', function(done){
    var p1 = new Pipe(function(outlet) {
      outlet.sendNext(1)
      outlet.sendNext(2)
      outlet.sendNext(3)
      outlet.sendDone()
    })
    _.assertAccum(p1, [1,2,3], done)
  })

  it('+empty', function(done){
    var pe = Pipe.empty()
    _.assertAccum(pe, [], done)
  })

  it('+return', function(done){
    var pr = Pipe.return(true)
    _.assertAccum(pr, [true], done)
  })

  it('+fromArray', function(done){
    var p = Pipe.fromArray([1,2,3])
    _.assertAccum(p, [1,2,3], done)
  })

  describe('+of', function() {
    it('should behave like +return with one arg', function(done) {
      _.assertAccum(new Pipe.of(1), [1], done)
    })
    it('should behave like +fromArray with multiple args', function(done) {
      _.assertAccum(new Pipe.of(1, 2, 3), [1, 2, 3], done)
    })
  })

  it('-concatWith', function(done){
    var p1 = new Pipe.fromArray([1,2])
    var p2 = new Pipe.fromArray([3])
    _.assertAccum(p1.concatWith(p2), [1,2,3], done)
  })

  it('-filter', function(done){
    var p = Pipe.fromArray([1,2,3,4,5,6])
      .filter(function(x){
        return (x % 2) === 0 // evens
      })
    _.assertAccum(p, [2,4,6], done)
  })

  it('-map', function(done){
    var p = Pipe.fromArray([1,2,3,4,5,6])
      .map(function(x){
        return Math.pow(x, 2)
      })
    _.assertAccum(p, [1,4,9,16,25,36], done)
  })

  it('-mapReplace', function(done) {
    var p = Pipe.of(1, 2, 3)
      .mapReplace(10)
    _.assertAccum(p, [10, 10, 10], done)
  })

  it('-merge', function(done) {
    var p = Pipe.fromArray([
        Pipe.of(1),
        Pipe.of(2, 2),
        Pipe.of(3, 3, 3)
      ])
      .merge()
    _.assertAccum(p, [1, 2,2, 3,3,3], done)
  })

  it('-concat', function(done) {
    var p = Pipe.fromArray([
        Pipe.of(1),
        Pipe.of(2, 2),
        Pipe.of(3, 3, 3)
      ])
      .concat()
    _.assertAccum(p, [1, 2,2, 3,3,3], done)
  })

  it('-skip', function(done){
    var pDigits = Pipe.fromArray([0,1,2,3,4,5,6,7,8,9])
      .skip(5)
    _.assertAccum(pDigits, [5,6,7,8,9], done)
  })
  it('-take', function(done){
    var pDigits = Pipe.fromArray([0,1,2,3,4,5,6,7,8,9])
      .take(5)
    _.assertAccum(pDigits, [0,1,2,3,4], done)
  })
  it('-takeUntil', function(done){
    var pDigits = Pipe.fromArray([0,1,2,3,4,5,6,7,8,9])
      .skip(4)
      .takeUntil((function() {
        var initialVal;
        // runs until it encounters a value
        // at least 2x the initial value encountered
        return function(x) {
          if (typeof initialVal === 'undefined') {
            initialVal = x
          }
          return x >= (2 * initialVal)
        }
      })())
    _.assertAccum(pDigits, [4,5,6,7], done)
  })
  it('-zipWith', function(done) {
    var nats = Pipe.of(0, 1, 2, 3, 4, 5, 6, 7)
    var primes = Pipe.of(2, 3, 5, 7)
    _.assertAccum(nats.zipWith(primes), [[0,2], [1,3], [2,5], [3,7]], done)
  })
  it('-scan', function(done) {
    var p = Pipe.of(1, -1, 2, -2, 10)
    var runningSum = p.scan(0, function(sum, v) {
      return sum + v
    })
    _.assertAccum(runningSum, [1, 0, 2, 0, 10], done)
  })
  it('-scan1', function(done) {
    var p = Pipe.of(1, -1, 2, -2, 10)
    var runningSum = p.scan1(function(sum, v) {
      return sum + v
    })
    _.assertAccum(runningSum, [0, 2, 0, 10], done)
  })

  describe('attached outlet', function() {

    it('receives an error', function(done) {
      var pBroken = new Pipe(function(outlet) {
        outlet.sendError(new Error('broken!'))
      })
      pBroken.on({
        error: function(e){
          assert.equal(e.message, 'broken!')
          done()
        }
        ,done: function() {
          done('no done event should be sent!')
        }
      })
    })

    it('receives a done event', function(done) {
      var pEmpty = new Pipe(function(outlet) {
        outlet.sendDone()
      })
      // `done` event is the only one called without an argument
      pEmpty.on({next: done, error: done, done: done})
    })

    describe('cancellation', function() {

      it('can happen immediately', function(done) {
        var pipe = Pipe.of(1, 2, 3)
        pipe.on({
          next: done
          ,error: done
          ,done: done
          ,bond: function(bond) {
            bond.break()
          }})
        done()
      })

      it('can happen within the `next` handler', function(done) {
        var pipe = Pipe.of(1, 2, 3)
        var bond;
        pipe.on({
          next: function(v) {
            done()
            bond.break()
          }
          ,error: function(e) {
            done('error should never be received')
          }
          ,done: function() {
            done('done should never be received')
          }
          ,bond: function(b) {
            bond = b
          }
        })
      })

      it('works on a pre-cancelled Outlet', function(done) {
        var pipe = Pipe.of(1, 2, 3)
        var outlet = new PL.Outlet({
          next: done
          ,error: done
          ,done: done
        })
        outlet.bond.break()

        pipe.attachOutlet(outlet)
        done()
      })
    })
  })
})

},{"../src/pipeline":15,"./utils":25,"assert":1}],24:[function(require,module,exports){
var assert = require('assert')
var PL = require('../src/pipeline')
var _ = require('./utils')

describe('PropertyInlet', function() {
  this.timeout(500 /* ms */)

  describe('(given no initial value)', function() {

    beforeEach(function() {
      this.propertyInlet = new PL.PropertyInlet()
    })

    it('sends `undefined` on attachment before being sent anything', function(done) {
      _.assertAccum(this.propertyInlet, [undefined], done)
      this.propertyInlet.sendDone()
    })

    it('sends a single value if it receives a single value', function(done) {
      this.propertyInlet.sendNext(true)
      _.assertAccum(this.propertyInlet, [true], done)
      this.propertyInlet.sendDone()
    })

    it('sends its currentValue before any new values', function(done) {
      this.propertyInlet.sendNext('current')
      _.assertAccum(this.propertyInlet, ['current', 'first', 'second'], done)
      this.propertyInlet.sendNext('first')
      this.propertyInlet.sendNext('second')
      this.propertyInlet.sendDone()
    })

    it('only sends the most recent received value on attachment', function(done) {
      this.propertyInlet.sendNext('old')
      this.propertyInlet.sendNext('current')
      _.assertAccum(this.propertyInlet, ['current', 'new'], done)
      this.propertyInlet.sendNext('new')
      this.propertyInlet.sendDone()
    })

    it('does not send values to new outlets once finished', function(done) {
      this.propertyInlet.sendDone()
      try {
        this.propertyInlet.on({
          next: function() {
            done('next handler should not be called')
          }
        })
        done('no exception when one was expected')
      }
      catch (e) {
        done()
      }
    })

    describe('outlet attachment', function() {
      describe('cancellation', function() {

        it('can happen after the first `next` event is sent', function(done) {
          var prop = new PL.PropertyInlet(1)
          var bond = prop.on({error: done, done: done, next: function(v) {
            if (v === 1) done()
            else done('next should only be sent once')
          }})
          bond.break()
          prop.sendNext(2)
          prop.sendDone()
        })
      })
    })
  })
})

},{"../src/pipeline":15,"./utils":25,"assert":1}],25:[function(require,module,exports){
var assert = require('assert')


var assertAccum = function(p, expectedValues, done){
  var accumValues = []
  var accumulate = function(v){
    accumValues.push(v)
  }
  p.on({
    next: accumulate
    ,error: done
    ,done: function(){
      try {
        assert.deepEqual(expectedValues, accumValues)
      }
      catch (e) {
        done(e)
        return
      }
      done()
    }
  })
}


module.exports = {
  assertAccum: assertAccum
}

},{"assert":1}]},{},[21])