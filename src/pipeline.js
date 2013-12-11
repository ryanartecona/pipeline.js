var assert = require('assert')
var work_queue = require('./work_queue')
"use strict"
var undefined

var debug_mode = false
var debug = function debug() {
  if (debug_mode) {
    console.log.apply(console, Array.prototype.slice.call(arguments))
  }
}

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
  //  onNext(v), onError(e), onDone()
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
    if (onSubscribe instanceof Function) {
      this.onSubscribe = onSubscribe
    }
  }
  // default state
  ,isDone: false
  // default subscription handler
  ,onSubscribe: function(subscriber) {
    return subscriber
  }

  ,subscribe: function(subscriber) {
    this.subscribers || (this.subscribers = [])
    assert(subscriber.onNext instanceof Function
        && subscriber.onError instanceof Function
        && subscriber.onDone instanceof Function)
    var thisP = this
    work_queue.exec_when_processing_queue(function() {
      if (thisP.onSubscribe) {
        thisP.onSubscribe(subscriber)
      }
      thisP.subscribers.push(subscriber)
      debug('new subscribers on', thisP, ':', thisP.subscribers)
    })
    return this
  }
  ,subscribeOn: function(handlers) {return this.subscribe(new Subscriber(handlers))}
  ,subscribeNext:  function(x) {return this.subscribeOn({next:  x})}
  ,subscribeError: function(x) {return this.subscribeOn({error: x})}
  ,subscribeDone:  function(x) {return this.subscribeOn({done:  x})}

  ,_broadcastToSubscribers: function(method, arg) {
    if (this.subscribers) {
      for (i in this.subscribers) {
        subscriber = this.subscribers[i]
        subscriber[method](arg)
      }
    }
  }
  ,sendNext: function(x) {
    assert(!this.isDone, 'cannot send `next` event on finished Pipe')
    var thisP = this
    work_queue.enqueue(function() {
      if (thisP.isDone) {
        throw new Error(this+' is already done.')
      }
      debug('broadcasting error on', thisP)
      thisP._broadcastToSubscribers('onNext', x)
    })
    return this
  }
  ,sendError: function(e) {
    assert(!this.isDone, 'cannot send `error` event on finished Pipe')
    // TODO: should this be enqueued, or happen synchronously?
    var thisP = this
    work_queue.enqueue(function() {
      if (thisP.isDone) {
        throw new Error(this+' is already done.')
      }
      debug('broadcasting error on', thisP)
      thisP._broadcastToSubscribers('onError', e)
      thisP.isDone = true
      delete thisP.subscribers
    })
    return this
  }
  ,sendDone: function() {
    assert(!this.isDone, 'cannot send `done` event on finished Pipe')
    var thisP = this
    work_queue.enqueue(function() {
      if (thisP.isDone) {
        throw new Error(this+' is already done.')
      }
      thisP._broadcastToSubscribers('onDone')
      thisP.isDone = true
      delete thisP.subscribers
    })
    return this
  }

  ,map: function(mapFn) {
    var upstream = this
    var downstream = new Pipe(function(downstreamSubscriber) {
      upstream.subscribeOn({
        next: function(x) {
          downstreamSubscriber.onNext(mapFn(x))
        }
        ,error: function(e) {downstreamSubscriber.onError(e)}
        ,done: function() {downstreamSubscriber.onDone()}
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
    var concatPipe = new Pipe(function(subscriber) {
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

Promise.prototype.subscribe = function(subscriber) {
  var thisP = this
  debug('scheduling subscriber', subscriber, 'on', this)
  work_queue.exec_when_processing_queue(function() {
    debug('subscribing subscriber', subscriber, 'to', thisP)
    if (thisP.status === Promise.statusTypePending) {
      Pipe.prototype.subscribe.call(thisP, subscriber)
      debug('subscribed', subscriber, 'to', thisP)
    } else if (thisP.status === Promise.statusTypeFulfilled) {
      work_queue.enqueue(function() {
        subscriber.onNext(thisP.value)
      })
    } else if (thisP.status === Promise.statusTypeRejected) {
      work_queue.enqueue(function() {
        subscriber.onError(thisP.reason)
      })
    }
  })
  return this
}
Promise.prototype.then = function(onFulfilled, onRejected) {
  var thenPromise = new Promise()
  var resolveWithHandler = function(handler, value, isFulfillment, resolvingPromise) {
    var x
    if (typeof handler === 'function') {
      try {
        x = handler(value)
      } catch (e) {
        debug('rejecting promise', resolvingPromise, 'with', e)
        resolvingPromise.reject(e)
        return
      }
      debug('resolving promise', resolvingPromise, 'with', x)
      resolvingPromise.resolve(x)
    } else {
      debug('scheduling to ' + (isFulfillment? 'fullfill value': 'reject with reason'), value)
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
  assert(this.status === Promise.statusTypePending, 'can only fulfill a pending Promise')
  var thisP = this
  work_queue.enqueue(function() {
    if (thisP.status === Promise.statusTypePending) {
      debug('fulfilling', thisP, 'with', v)
      thisP.status = Promise.statusTypeFulfilled
      thisP.value = v
      thisP._broadcastToSubscribers('onNext', v)
      thisP.isDone = true
      thisP._broadcastToSubscribers('onDone')
      delete thisP.subscribers
    }
  })
}
Promise.prototype.sendError = function(r) {
  assert(this.status === Promise.statusTypePending, 'can only reject a pending Promise')
  var thisP = this
  work_queue.enqueue(function() {
    if (thisP.status === Promise.statusTypePending) {
      debug('rejecting', thisP, 'with', r)
      thisP.status = Promise.statusTypeRejected
      thisP.reason = r
      thisP._broadcastToSubscribers('onError', r)
      thisP.isDone = true
      thisP._broadcastToSubscribers('onDone')
      delete thisP.subscribers
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
        work_queue.enqueue(function() {
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


/**
 * Exports
 */
module.exports = {
  Pipe: Pipe
  ,Subscriber: Subscriber
  ,Promise: Promise
}
