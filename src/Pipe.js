var assert = require('assert')
var Outlet = require('./Outlet')
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
    if (onAttach instanceof Function) {
      this.onAttach = onAttach
    }
  }
  // default state
  ,isDone: false
  // default subscription handler
  ,onAttach: function(outlet) {
    return outlet
  }

  ,attachOutlet: function(outlet) {
    assert(typeof outlet.sendNext === 'function'
        && typeof outlet.sendError === 'function'
        && typeof outlet.sendDone === 'function')
    this.outlets || (this.outlets = [])
    var thisP = this
    AttachmentScheduler.schedule(function() {
      if (thisP.onAttach) {
        thisP.onAttach(outlet)
      }
      thisP.outlets.push(outlet)
    })
    return this
  }
  ,on: function(handlers) {return this.attachOutlet(new Outlet(handlers))}
  ,onNext:  function(x) {return this.on({next:  x})}
  ,onError: function(x) {return this.on({error: x})}
  ,onDone:  function(x) {return this.on({done:  x})}

  ,_broadcastToOutlets: function(method, arg) {
    if (this.outlets) {
      for (i in this.outlets) {
        outlet = this.outlets[i]
        outlet[method](arg)
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

  ,concat: function(nextPipe) {
    var prevPipe = this
    var concatPipe = new Pipe(function(outlet) {
      prevPipe.on({
        next: function(x) {
          outlet.sendNext(x)
        },
        error: function(e) {
          outlet.sendError(e)
        },
        done: function() {
          nextPipe.attachOutlet(outlet)
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
      var activeAdjacentPipes = adjacentPipes
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
}


module.exports = Pipe
