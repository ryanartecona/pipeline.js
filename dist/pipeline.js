!function(e){if("object"==typeof exports)module.exports=e();else if("function"==typeof define&&define.amd)define(e);else{var f;"undefined"!=typeof window?f=window:"undefined"!=typeof global?f=global:"undefined"!=typeof self&&(f=self),f.PL=e()}}(function(){var define,module,exports;return (function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);throw new Error("Cannot find module '"+o+"'")}var f=n[o]={exports:{}};t[o][0].call(f.exports,function(e){var n=t[o][1][e];return s(n?n:e)},f,f.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(_dereq_,module,exports){
var assert = _dereq_('./assert')


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

},{"./assert":10}],2:[function(_dereq_,module,exports){
var assert = _dereq_('./assert')
var Pipe = _dereq_('./Pipe')
var Inlet = _dereq_('./Inlet')
var schedulers = _dereq_('./schedulers')
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

},{"./Inlet":3,"./Pipe":6,"./assert":10,"./schedulers":12}],3:[function(_dereq_,module,exports){
var assert = _dereq_('./assert')
var Pipe = _dereq_('./Pipe')
var Bond = _dereq_('./Bond')


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

},{"./Bond":1,"./Pipe":6,"./assert":10}],4:[function(_dereq_,module,exports){
var Bond = _dereq_('./Bond')


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

},{"./Bond":1}],5:[function(_dereq_,module,exports){
var assert = _dereq_('./assert')
var Bond = _dereq_('./Bond')
var MultiBond = _dereq_('./MultiBond')


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

},{"./Bond":1,"./MultiBond":4,"./assert":10}],6:[function(_dereq_,module,exports){
var assert = _dereq_('./assert')
var Outlet = _dereq_('./Outlet')
var Bond = _dereq_('./Bond')
var MultiBond = _dereq_('./MultiBond')
var ProxyOutlet = _dereq_('./ProxyOutlet')
var schedulers = _dereq_('./schedulers')
var AttachmentScheduler = schedulers.AttachmentScheduler
var _ = _dereq_('./utils')

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

},{"./Bond":1,"./MultiBond":4,"./Outlet":5,"./ProxyOutlet":9,"./assert":10,"./schedulers":12,"./utils":13}],7:[function(_dereq_,module,exports){
var assert = _dereq_('./assert')
var Pipe = _dereq_('./Pipe')
var MultiBond = _dereq_('./MultiBond')
var Bond = _dereq_('./Bond')
var schedulers = _dereq_('./schedulers')
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

},{"./Bond":1,"./MultiBond":4,"./Pipe":6,"./assert":10,"./schedulers":12}],8:[function(_dereq_,module,exports){
var assert = _dereq_('./assert')
var Pipe = _dereq_('./Pipe')
var Inlet = _dereq_('./Inlet')
var schedulers = _dereq_('./schedulers')
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

},{"./Inlet":3,"./Pipe":6,"./assert":10,"./schedulers":12}],9:[function(_dereq_,module,exports){
var assert = _dereq_('./assert')


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

},{"./assert":10}],10:[function(_dereq_,module,exports){
module.exports = function assert(testVal, message) {
  if (!testVal) {
    throw new TypeError(message)
  }
}

},{}],11:[function(_dereq_,module,exports){
var Pipe = _dereq_('./Pipe')
var Inlet = _dereq_('./Inlet')
var HistoryInlet = _dereq_('./HistoryInlet')
var PropertyInlet = _dereq_('./PropertyInlet')
var Outlet = _dereq_('./Outlet')
var Promise = _dereq_('./Promise')
var Bond = _dereq_('./Bond')
var MultiBond = _dereq_('./MultiBond')
var schedulers = _dereq_('./schedulers')

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

},{"./Bond":1,"./HistoryInlet":2,"./Inlet":3,"./MultiBond":4,"./Outlet":5,"./Pipe":6,"./Promise":7,"./PropertyInlet":8,"./schedulers":12}],12:[function(_dereq_,module,exports){
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

},{}],13:[function(_dereq_,module,exports){
var debug_mode = false
var debug = function debug() {
  if (debug_mode) {
    console.log.apply(console, [].slice.call(arguments))
  }
}

module.exports = {
  debug: debug
}

},{}]},{},[11])
(11)
});