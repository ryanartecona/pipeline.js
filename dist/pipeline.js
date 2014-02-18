(function (root, factory) {
    if (typeof define === 'function' && define.amd) {
        // AMD. Register as an anonymous module.
        define([], factory);
    } else if (typeof exports === 'object') {
        // Node. Does not work with strict CommonJS, but
        // only CommonJS-like environments that support module.exports,
        // like Node.
        module.exports = factory();
    } else {
        // Browser globals (root is window)
        root.PL = root.Pipeline = factory();
  }
}(this, function () {
/**
 * @license almond 0.2.9 Copyright (c) 2011-2014, The Dojo Foundation All Rights Reserved.
 * Available via the MIT or new BSD license.
 * see: http://github.com/jrburke/almond for details
 */
//Going sloppy to avoid 'use strict' string cost, but strict practices should
//be followed.
/*jslint sloppy: true */
/*global setTimeout: false */

var requirejs, require, define;
(function (undef) {
    var main, req, makeMap, handlers,
        defined = {},
        waiting = {},
        config = {},
        defining = {},
        hasOwn = Object.prototype.hasOwnProperty,
        aps = [].slice,
        jsSuffixRegExp = /\.js$/;

    function hasProp(obj, prop) {
        return hasOwn.call(obj, prop);
    }

    /**
     * Given a relative module name, like ./something, normalize it to
     * a real name that can be mapped to a path.
     * @param {String} name the relative name
     * @param {String} baseName a real name that the name arg is relative
     * to.
     * @returns {String} normalized name
     */
    function normalize(name, baseName) {
        var nameParts, nameSegment, mapValue, foundMap, lastIndex,
            foundI, foundStarMap, starI, i, j, part,
            baseParts = baseName && baseName.split("/"),
            map = config.map,
            starMap = (map && map['*']) || {};

        //Adjust any relative paths.
        if (name && name.charAt(0) === ".") {
            //If have a base name, try to normalize against it,
            //otherwise, assume it is a top-level require that will
            //be relative to baseUrl in the end.
            if (baseName) {
                //Convert baseName to array, and lop off the last part,
                //so that . matches that "directory" and not name of the baseName's
                //module. For instance, baseName of "one/two/three", maps to
                //"one/two/three.js", but we want the directory, "one/two" for
                //this normalization.
                baseParts = baseParts.slice(0, baseParts.length - 1);
                name = name.split('/');
                lastIndex = name.length - 1;

                // Node .js allowance:
                if (config.nodeIdCompat && jsSuffixRegExp.test(name[lastIndex])) {
                    name[lastIndex] = name[lastIndex].replace(jsSuffixRegExp, '');
                }

                name = baseParts.concat(name);

                //start trimDots
                for (i = 0; i < name.length; i += 1) {
                    part = name[i];
                    if (part === ".") {
                        name.splice(i, 1);
                        i -= 1;
                    } else if (part === "..") {
                        if (i === 1 && (name[2] === '..' || name[0] === '..')) {
                            //End of the line. Keep at least one non-dot
                            //path segment at the front so it can be mapped
                            //correctly to disk. Otherwise, there is likely
                            //no path mapping for a path starting with '..'.
                            //This can still fail, but catches the most reasonable
                            //uses of ..
                            break;
                        } else if (i > 0) {
                            name.splice(i - 1, 2);
                            i -= 2;
                        }
                    }
                }
                //end trimDots

                name = name.join("/");
            } else if (name.indexOf('./') === 0) {
                // No baseName, so this is ID is resolved relative
                // to baseUrl, pull off the leading dot.
                name = name.substring(2);
            }
        }

        //Apply map config if available.
        if ((baseParts || starMap) && map) {
            nameParts = name.split('/');

            for (i = nameParts.length; i > 0; i -= 1) {
                nameSegment = nameParts.slice(0, i).join("/");

                if (baseParts) {
                    //Find the longest baseName segment match in the config.
                    //So, do joins on the biggest to smallest lengths of baseParts.
                    for (j = baseParts.length; j > 0; j -= 1) {
                        mapValue = map[baseParts.slice(0, j).join('/')];

                        //baseName segment has  config, find if it has one for
                        //this name.
                        if (mapValue) {
                            mapValue = mapValue[nameSegment];
                            if (mapValue) {
                                //Match, update name to the new value.
                                foundMap = mapValue;
                                foundI = i;
                                break;
                            }
                        }
                    }
                }

                if (foundMap) {
                    break;
                }

                //Check for a star map match, but just hold on to it,
                //if there is a shorter segment match later in a matching
                //config, then favor over this star map.
                if (!foundStarMap && starMap && starMap[nameSegment]) {
                    foundStarMap = starMap[nameSegment];
                    starI = i;
                }
            }

            if (!foundMap && foundStarMap) {
                foundMap = foundStarMap;
                foundI = starI;
            }

            if (foundMap) {
                nameParts.splice(0, foundI, foundMap);
                name = nameParts.join('/');
            }
        }

        return name;
    }

    function makeRequire(relName, forceSync) {
        return function () {
            //A version of a require function that passes a moduleName
            //value for items that may need to
            //look up paths relative to the moduleName
            return req.apply(undef, aps.call(arguments, 0).concat([relName, forceSync]));
        };
    }

    function makeNormalize(relName) {
        return function (name) {
            return normalize(name, relName);
        };
    }

    function makeLoad(depName) {
        return function (value) {
            defined[depName] = value;
        };
    }

    function callDep(name) {
        if (hasProp(waiting, name)) {
            var args = waiting[name];
            delete waiting[name];
            defining[name] = true;
            main.apply(undef, args);
        }

        if (!hasProp(defined, name) && !hasProp(defining, name)) {
            throw new Error('No ' + name);
        }
        return defined[name];
    }

    //Turns a plugin!resource to [plugin, resource]
    //with the plugin being undefined if the name
    //did not have a plugin prefix.
    function splitPrefix(name) {
        var prefix,
            index = name ? name.indexOf('!') : -1;
        if (index > -1) {
            prefix = name.substring(0, index);
            name = name.substring(index + 1, name.length);
        }
        return [prefix, name];
    }

    /**
     * Makes a name map, normalizing the name, and using a plugin
     * for normalization if necessary. Grabs a ref to plugin
     * too, as an optimization.
     */
    makeMap = function (name, relName) {
        var plugin,
            parts = splitPrefix(name),
            prefix = parts[0];

        name = parts[1];

        if (prefix) {
            prefix = normalize(prefix, relName);
            plugin = callDep(prefix);
        }

        //Normalize according
        if (prefix) {
            if (plugin && plugin.normalize) {
                name = plugin.normalize(name, makeNormalize(relName));
            } else {
                name = normalize(name, relName);
            }
        } else {
            name = normalize(name, relName);
            parts = splitPrefix(name);
            prefix = parts[0];
            name = parts[1];
            if (prefix) {
                plugin = callDep(prefix);
            }
        }

        //Using ridiculous property names for space reasons
        return {
            f: prefix ? prefix + '!' + name : name, //fullName
            n: name,
            pr: prefix,
            p: plugin
        };
    };

    function makeConfig(name) {
        return function () {
            return (config && config.config && config.config[name]) || {};
        };
    }

    handlers = {
        require: function (name) {
            return makeRequire(name);
        },
        exports: function (name) {
            var e = defined[name];
            if (typeof e !== 'undefined') {
                return e;
            } else {
                return (defined[name] = {});
            }
        },
        module: function (name) {
            return {
                id: name,
                uri: '',
                exports: defined[name],
                config: makeConfig(name)
            };
        }
    };

    main = function (name, deps, callback, relName) {
        var cjsModule, depName, ret, map, i,
            args = [],
            callbackType = typeof callback,
            usingExports;

        //Use name if no relName
        relName = relName || name;

        //Call the callback to define the module, if necessary.
        if (callbackType === 'undefined' || callbackType === 'function') {
            //Pull out the defined dependencies and pass the ordered
            //values to the callback.
            //Default to [require, exports, module] if no deps
            deps = !deps.length && callback.length ? ['require', 'exports', 'module'] : deps;
            for (i = 0; i < deps.length; i += 1) {
                map = makeMap(deps[i], relName);
                depName = map.f;

                //Fast path CommonJS standard dependencies.
                if (depName === "require") {
                    args[i] = handlers.require(name);
                } else if (depName === "exports") {
                    //CommonJS module spec 1.1
                    args[i] = handlers.exports(name);
                    usingExports = true;
                } else if (depName === "module") {
                    //CommonJS module spec 1.1
                    cjsModule = args[i] = handlers.module(name);
                } else if (hasProp(defined, depName) ||
                           hasProp(waiting, depName) ||
                           hasProp(defining, depName)) {
                    args[i] = callDep(depName);
                } else if (map.p) {
                    map.p.load(map.n, makeRequire(relName, true), makeLoad(depName), {});
                    args[i] = defined[depName];
                } else {
                    throw new Error(name + ' missing ' + depName);
                }
            }

            ret = callback ? callback.apply(defined[name], args) : undefined;

            if (name) {
                //If setting exports via "module" is in play,
                //favor that over return value and exports. After that,
                //favor a non-undefined return value over exports use.
                if (cjsModule && cjsModule.exports !== undef &&
                        cjsModule.exports !== defined[name]) {
                    defined[name] = cjsModule.exports;
                } else if (ret !== undef || !usingExports) {
                    //Use the return value from the function.
                    defined[name] = ret;
                }
            }
        } else if (name) {
            //May just be an object definition for the module. Only
            //worry about defining if have a module name.
            defined[name] = callback;
        }
    };

    requirejs = require = req = function (deps, callback, relName, forceSync, alt) {
        if (typeof deps === "string") {
            if (handlers[deps]) {
                //callback in this case is really relName
                return handlers[deps](callback);
            }
            //Just return the module wanted. In this scenario, the
            //deps arg is the module name, and second arg (if passed)
            //is just the relName.
            //Normalize module name, if it contains . or ..
            return callDep(makeMap(deps, callback).f);
        } else if (!deps.splice) {
            //deps is a config object, not an array.
            config = deps;
            if (config.deps) {
                req(config.deps, config.callback);
            }
            if (!callback) {
                return;
            }

            if (callback.splice) {
                //callback is an array, which means it is a dependency list.
                //Adjust args if there are dependencies
                deps = callback;
                callback = relName;
                relName = null;
            } else {
                deps = undef;
            }
        }

        //Support require(['a'])
        callback = callback || function () {};

        //If relName is a function, it is an errback handler,
        //so remove it.
        if (typeof relName === 'function') {
            relName = forceSync;
            forceSync = alt;
        }

        //Simulate async callback;
        if (forceSync) {
            main(undef, deps, callback, relName);
        } else {
            //Using a non-zero value because of concern for what old browsers
            //do, and latest browsers "upgrade" to 4 if lower value is used:
            //http://www.whatwg.org/specs/web-apps/current-work/multipage/timers.html#dom-windowtimers-settimeout:
            //If want a value immediately, use require('id') instead -- something
            //that works in almond on the global level, but not guaranteed and
            //unlikely to work in other AMD implementations.
            setTimeout(function () {
                main(undef, deps, callback, relName);
            }, 4);
        }

        return req;
    };

    /**
     * Just drops the config on the floor, but returns req in case
     * the config return value is used.
     */
    req.config = function (cfg) {
        return req(cfg);
    };

    /**
     * Expose module registry for debugging and tooling
     */
    requirejs._defined = defined;

    define = function (name, deps, callback) {

        //This module may not have dependencies
        if (!deps.splice) {
            //deps is not an array, so probably means
            //an object literal or factory function for
            //the value. Adjust args.
            callback = deps;
            deps = [];
        }

        if (!hasProp(defined, name) && !hasProp(waiting, name)) {
            waiting[name] = [name, deps, callback];
        }
    };

    define.amd = {
        jQuery: true
    };
}());

define("../node_modules/almond/almond", function(){});

define('assert',['require','exports','module'],function (require, exports, module) {module.exports = function assert(testVal, message) {
  if (!testVal) {
    throw new TypeError(message)
  }
}

});

define('Bond',['require','exports','module','./assert'],function (require, exports, module) {var assert = require('./assert')


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

});

define('MultiBond',['require','exports','module','./Bond'],function (require, exports, module) {var Bond = require('./Bond')


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

});

define('Outlet',['require','exports','module','./assert','./Bond','./MultiBond'],function (require, exports, module) {var assert = require('./assert')
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
    this._bond = new MultiBond([new Bond(function() {
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
    if (!this.hasOwnProperty('_errorHandler')) return
    var errorHandler = this._errorHandler
    this._bond.break()
    errorHandler(e)
  }
  ,sendDone: function() {
    if (!this.hasOwnProperty('_doneHandler')) return
    var doneHandler = this._doneHandler
    this._bond.break()
    doneHandler()
  }

  ,attachedWithBond: function(newBond) {
    this._bond.addBond(newBond)
  }
}


module.exports = Outlet

});

define('ProxyOutlet',['require','exports','module','./assert'],function (require, exports, module) {var assert = require('./assert')


var ProxyOutlet = function(outlet, bond) {
  this.outlet = outlet
  this.bond = bond
  this.outlet.attachedWithBond(bond)
}

ProxyOutlet.prototype.sendNext = function(v) {
  if (this.bond.isBroken) return
  this.outlet.sendNext(v)
}
ProxyOutlet.prototype.sendError = function(e) {
  if (this.bond.isBroken) return
  this.outlet.sendError(e)
}
ProxyOutlet.prototype.sendDone = function() {
  if (this.bond.isBroken) return
  this.outlet.sendDone()
}

ProxyOutlet.prototype.attachedWithBond = function(newBond) {
  if (newBond !== this.bond) {
    this.bond.addBond(newBond)
  }
}


module.exports = ProxyOutlet

});

define('schedulers',['require','exports','module'],function (require, exports, module) {/**
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
  return _current || SyncScheduler
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
    prevScheduler = _current
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
        job = _queue.shift()
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

var AttachmentScheduler = {
  schedule: function(jobFn) {
    typeof _current !== 'undefined' 
      ? jobFn()
      : AsyncScheduler.schedule(jobFn)
    // jobFn()
  }
}

module.exports = {
  schedule: schedule
  ,currentScheduler: currentScheduler
  ,SyncScheduler: SyncScheduler
  ,AsyncScheduler: AsyncScheduler
  ,AttachmentScheduler: AttachmentScheduler
}

});

define('utils',['require','exports','module'],function (require, exports, module) {var debug_mode = false
var debug = function debug() {
  if (debug_mode) {
    console.log.apply(console, [].slice.call(arguments))
  }
}

module.exports = {
  debug: debug
}

});

define('Pipe',['require','exports','module','./assert','./Outlet','./Bond','./MultiBond','./ProxyOutlet','./schedulers','./utils'],function (require, exports, module) {var assert = require('./assert')
var Outlet = require('./Outlet')
var Bond = require('./Bond')
var MultiBond = require('./MultiBond')
var ProxyOutlet = require('./ProxyOutlet')
var schedulers = require('./schedulers')
var AttachmentScheduler = schedulers.AttachmentScheduler
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
  args = [].slice.call(arguments)
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

    this.outlets || (this.outlets = [])
    var thisP = this
    var multiBond = new MultiBond()
    var proxyOutlet = new ProxyOutlet(outlet, multiBond)

    AttachmentScheduler.schedule(function() {
      if (multiBond.isBroken) return
      if (thisP.onAttach) {
        var innerBond = thisP.onAttach(proxyOutlet)
        if (innerBond instanceof Bond) {
          multiBond.addBond(innerBond)
        }
      }

      if (multiBond.isBroken) return
      thisP.outlets || (this.outlets = [])
      thisP.outlets.push(proxyOutlet)
      multiBond.addBond(new Bond(function() {
        thisP._detachOutlet(proxyOutlet)
      }))
    })

    return multiBond
  }

  ,on: function(handlers) {return this.attachOutlet(new Outlet(handlers))}
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
      for (i in this.outlets) {
        outlet = this.outlets[i]
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
  ,mbind: function(bindFn) {
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
            var x_transformed = bindFn(x_original, requestStop)
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

  ,concat: function(nextPipe1, nextPipe2, nextPipeN) {
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
    return this.mbind(function(x) {
      if (predicateFn(x)) {
        return Pipe.return(x)
      } else {
        return Pipe.empty()
      }
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
    return this.mbind(function(x, requestStop) {
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

  ,merge: function(adjacent1, adjacent2, adjacentN) {
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

});

define('Inlet',['require','exports','module','./assert','./Pipe','./Bond'],function (require, exports, module) {var assert = require('./assert')
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

});

define('HistoryInlet',['require','exports','module','./assert','./Pipe','./Inlet','./schedulers'],function (require, exports, module) {var assert = require('./assert')
var Pipe = require('./Pipe')
var Inlet = require('./Inlet')
var schedulers = require('./schedulers')
var AttachmentScheduler = schedulers.AttachmentScheduler


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
    for (i in vs) {
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

});

define('PropertyInlet',['require','exports','module','./assert','./Pipe','./Inlet','./schedulers'],function (require, exports, module) {var assert = require('./assert')
var Pipe = require('./Pipe')
var Inlet = require('./Inlet')
var schedulers = require('./schedulers')
var AttachmentScheduler = schedulers.AttachmentScheduler


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

});

define('Promise',['require','exports','module','./assert','./Pipe','./MultiBond','./Bond','./schedulers'],function (require, exports, module) {var assert = require('./assert')
var Pipe = require('./Pipe')
var MultiBond = require('./MultiBond')
var Bond = require('./Bond')
var schedulers = require('./schedulers')
var AttachmentScheduler = schedulers.AttachmentScheduler
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
  AttachmentScheduler.schedule(function() {
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

});

define('pipeline',['require','exports','module','./Pipe','./Inlet','./HistoryInlet','./PropertyInlet','./Outlet','./Promise','./Bond','./MultiBond','./schedulers'],function (require, exports, module) {var Pipe = require('./Pipe')
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

// define([
//     'Pipe'
//     ,'Inlet'
//     ,'HistoryInlet'
//     ,'PropertyInlet'
//     ,'Outlet'
//     ,'Promise'
//     ,'Bond'
//     ,'MultiBond'
//     ,'schedulers'
//   ], function(Pipe, Inlet, HistoryInlet, PropertyInlet, Outlet, Promise, Bond, MultiBond, schedulers) {
//     return {
//       Pipe: Pipe
//       ,Inlet: Inlet
//       ,HistoryInlet: HistoryInlet
//       ,PropertyInlet: PropertyInlet
//       ,Outlet: Outlet
//       ,Promise: Promise
//       ,Bond: Bond
//       ,MultiBond: MultiBond
//       ,SyncScheduler: schedulers.SyncScheduler
//       ,AsyncScheduler: schedulers.AsyncScheduler
//       ,currentScheduler: schedulers.currentScheduler
//       ,schedule: schedulers.schedule
//     }
// })

});

    return require('pipeline');
}));