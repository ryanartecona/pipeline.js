var assert = require('assert')
var _      = require('underscore')
"use strict";

var Subscriber = function(args){
  this.init(args)
}
Subscriber.prototype = {
  init: function(args) {
    assert(args.next || args.done || args.error)
    args.next  && (this.next  = args.next)
    args.error && (this.error = args.error)
    args.done  && (this.done  = args.done)
    return this
  }

  // stub functions, overwritten by 
  // constructor args when supplied
  ,next:  function(v) {}
  ,error: function(e) {}
  ,done:  function() {}
  
  // Subscriber interface:
  //  onNext(v){}, onError(e){}, onDone(){}
  ,onNext: function(v) {
    try {
      this.next(v)
    } catch (e) {
      this.onError(e)
    }
  }
  ,onError: function(e) {
    var maybeV = this.error(e)
    if (typeof maybeV != "undefined") {
      this.onNext(maybeV)
    }
  }
  ,onDone: function() {
    this.done()
  }
}


var Pipe = function(onSubscribe) {
  this.init(onSubscribe)
}
Pipe.empty = function() {
  return new Pipe(function(subscriber) {
    subscriber.onDone()
  })
}
Pipe.return = function(x) {
  return new Pipe(function(subscriber) {
    subscriber.onNext(x)
    subscriber.onDone()
  })
}
Pipe.fromArray = function(arr) {
  return new Pipe(function(subscriber) {
    for (var i = 0; i < arr.length; i++) {
      subscriber.onNext(arr[i])
    }
    subscriber.onDone()
  })
}
Pipe.prototype = {
  init: function(onSubscribe) {
    onSubscribe && (this.onSubscribe = onSubscribe)
  }
  // default state
  ,isDone: false

  ,subscribe: function(subscriber) {
    this.subscribers || (this.subscribers = [])
    this.subscribers.push(subscriber)
    this.onSubscribe && this.onSubscribe(subscriber)
    return this
  }
  ,subscribeOn: function(handlers) {return this.subscribe(new Subscriber(handlers))}
  ,subscribeNext:  function(x) {return this.subscribeOn({next:  x})}
  ,subscribeError: function(x) {return this.subscribeOn({error: x})}
  ,subscribeDone:  function(x) {return this.subscribeOn({done:  x})}

  ,sendNext: function(x) {
    if (this.subscribers) {
      _.each(this.subscribers, function(subscriber) {
        subscriber.onNext(x)
      })
    }
    return this
  }
  ,sendError: function(x) {
    if (this.subscribers) {
      _.each(this.subscribers, function(subscriber) {
        subscriber.onError(x)
      })
    }
    return this
  }
  ,sendDone: function() {
    if (this.subscribers) {
      _.each(this.subscribers, function(subscriber) {
        subscriber.onDone()
      })
    }
    this.isDone = true
    delete this.subscribers
    return this
  }

  ,map: function(mapFn) {
    var upstream = this
    var downstream = new Pipe(function(downstreamSubscriber) {
      upstream.subscribeOn({
        next: function(x) {
          downstream.sendNext(mapFn(x))
        }
        ,error: function(e) {downstream.sendError(e)}
        ,done: function() {downstream.sendDone()}
      })
    })
    return downstream
  }

  // monadic bind
  ,mbind: function(bindFn) {
    var upstream = this;
    var downstream = new Pipe(function(downstreamSubscriber) {
      var interspersedPipes = []
      var upstreamIsDone = false
      var addNewPipe = function(p) {
        interspersedPipes.push(p)
        p.subscribeOn({
          next: function(x) {downstreamSubscriber.onNext(x)}
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
        downstreamSubscriber.onError(e)
      }
      var maybeFinishUpstream = (function() {
        var hasSentDownstreamDoneOnce = false
        return function() {
          if (!interspersedPipes.length && upstreamIsDone && !hasSentDownstreamDoneOnce) {
            hasSentDownstreamDoneOnce = true
            downstreamSubscriber.onDone()
          }
        }
      })()

      upstream.subscribeOn({
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

  ,concat: function(nextPipe) {
    var prevPipe = this
    return new Pipe(function(subscriber) {
      prevPipe.subscribeOn({
        next: function(x) {
          subscriber.onNext(x)
        },
        error: function(e) {
          subscriber.onError(e)
        },
        done: function() {
          nextPipe.subscribe(subscriber)
        }
      })
    })
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

  ,merge: function(/* adjacent1, adjacent2, ... */) {
    var adjacentPipes = [].slice.call(arguments)
    adjacentPipes.unshift(this)
    return new Pipe(function(subscriber) {
      var activeAdjacentPipes = adjacentPipes
      for (var i = 0; i < adjacentPipes.length; i++) {
        (function(i) {
          var thisAdjacentPipe = adjacentPipes[i]
          thisAdjacentPipe.subscribeOn({
            next: function(x) {
              subscriber.onNext(x)
            }
            ,error: function(e) {
              subscriber.onError(e)
            }
            ,done: function() {
              activeAdjacentPipes.splice(activeAdjacentPipes.indexOf(thisAdjacentPipe), 1)
              if (activeAdjacentPipes.length == 0) {
                subscriber.onDone()
              }
            }
          })
        })(i)
      }
    })
  }
}

var Promise = function(/* onSubscribe? */) {
  this.init(/* onSubscribe? */)
}
Promise.prototype = new Pipe()

Promise.statusTypePending   = 1
Promise.statusTypeFulfilled = 2
Promise.statusTypeRejected  = 3
Promise.prototype.status = Promise.statusTypePending
Promise.prototype.value = null
Promise.prototype.reason = null

Promise.prototype.init = function(/* onSubscribe? */) {
  //...
}
Promise.prototype.then = function(onFulfilled, onRejected) {
  var thenPromise = new Promise()
  var resolveWithHandler = function(handler, value, isFulfillment, resolvingPromise) {
    var x
    if (handler instanceof Function) {
      try {
        x = handler(value)
      } catch (e) {
        resolvingPromise.reject(e)
        return
      }
      resolveToPromise(resolvingPromise, x)
    } else {
      resolvingPromise[isFulfillment? 'fulfill': 'reject'](value)
    }
  }
  this.subscribeOn({
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
  this.status = Promise.statusTypeFulfilled
  this.value = v
  Pipe.prototype.sendNext.call(this, v)
  this.sendDone()
}
Promise.prototype.sendError = function(r) {
  this.status = Promise.statusTypeRejected
  this.reason = r
  Pipe.prototype.sendError.call(this, r)
  this.sendDone()
}
Promise.prototype.fulfill = Promise.prototype.sendNext
Promise.prototype.reject = Promise.prototype.sendError
function resolveToPromise(promise, x) {
  // Promise Resolution Procedure ©
  if (x === promise) {
    promise.reject(new TypeError('promise cycle detected'))
    return
  }
  if (x instanceof Promise) {
    // (implementation-specific)
    // make promise adopt the state of x
  }
  if (x instanceof Object) {
    var then
    try {
      then = x.then
    } catch (e) {
      promise.reject(e)
      return
    }
    if (then instanceof Function) {
      var aHandlerHasBeenCalled = false
      then.call(x,
        function resolvePromise(y) {
          if (aHandlerHasBeenCalled) {
            aHandlerHasBeenCalled = true
            return
          }
          resolveToPromise(promise, y)
        },
        function rejectPromise(r) {
          if (aHandlerHasBeenCalled) {
            aHandlerHasBeenCalled = true
            return
          }
          promise.reject(r)
        }
      )
    }
  }
  promise.fulfill(x)
}

/**
 * Utils
 */
// var noOp = function(){}t

/**
 * Exports
 */
module.exports = {
  Pipe: Pipe
  ,Subscriber: Subscriber
  ,Promise: Promise
}
