var assert = require('assert')
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
