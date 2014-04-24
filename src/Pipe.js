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
Pipe.never = function() {
  return new Pipe(function(){})
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

    schedulers.scheduleEager(function() {
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
    return new Pipe(function(outlet) {
      upstream.on({
        bond: function(b) {
          outlet.bond.addBond(b)
        }
        ,next: function(x) {
          outlet.sendNext(mapFn(x))
        }
        ,error: function(e) {
          outlet.sendError(e)
        }
        ,done: function() {
          outlet.sendDone()
        }
      })
    })
  }

  // monadic bind
  ,mapMerge: function(mapFn) {
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
    return this.mapMerge(function(innerPipe) {
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
        attachToNextPipeIfNecessary()
      }
      finishConcatPipeIfNecessary()
    }
    var attachToNextPipeIfNecessary = function() {
      if (typeof activePipe !== 'undefined') return
      if (!pipesToConcat.length) return
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
          attachToNextPipeIfNecessary()
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

  ,mapConcat: function(mapFn) {
    return this.map(mapFn).concat()
  }

  ,takeFromLatest: function() {
    var sourcePipe = this

    return new Pipe(function(outlet) {
      var currentInnerBond = null
      var sourcePipeHasFinished = false

      function didReceiveNewInnerPipe(newInnerPipe) {
        breakCurrentBondIfNecessary()

        newInnerPipe.on({
          bond: function(b) {
            breakCurrentBondIfNecessary()
            currentInnerBond = b
          }
          ,next: function(v) {
            outlet.sendNext(v)
          }
          ,error: function(e) {
            outlet.sendError(e)
          }
          ,done: function() {
            currentInnerBond = null
            sendDoneIfNecessary()
          }
        })
      }

      function breakCurrentBondIfNecessary() {
        if (currentInnerBond !== null) {
          currentInnerBond.break()
          currentInnerBond = null
        }
      }

      function sendDoneIfNecessary() {
        if (sourcePipeHasFinished && currentInnerBond === null) {
          outlet.sendDone()
        }
      }

      outlet.bond.addBond(new Bond(breakCurrentBondIfNecessary))

      sourcePipe.on({
        bond: function(b) {
          outlet.bond.addBond(b)
        }
        ,next: didReceiveNewInnerPipe
        ,error: function(e) {
          outlet.sendError(e)
        }
        ,done: function() {
          sourcePipeHasFinished = true
          sendDoneIfNecessary()
        }
      })
    })
  }

  ,mapTakingFromLatest: function(mapFn) {
    return this.map(mapFn).takeFromLatest()
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
    return this.mapMerge(function(x) {
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
    return this.mapMerge(function(x, requestStop) {
      if (shouldKeepTaking(x)) {
        return Pipe.return(x)
      } else {
        requestStop()
        return Pipe.empty()
      }
    })
  }

  ,takeUntilNext: function(stopPipe) {
    var mainPipe = this

    return new Pipe(function(mainOutlet) {
      stopPipe.on({
        bond: function(stopBond) {
          mainOutlet.bond.addBond(stopBond)
        }
        ,next: function(v) {
          mainOutlet.sendDone(v)
        }
        ,error: function(e) {
          mainOutlet.sendError(e)
        }
        ,done: function() {
          mainOutlet.sendDone()
        }
      })

      mainPipe.attachOutlet(mainOutlet)
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
      
      for (var i = 0; i < numAdjacentPipes; i++) {
        hasFinished[i] = false
        nextValues[i] = []
      }

      for (var i = 0; i < numAdjacentPipes; i++) {(function(i) {

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
    return this.mapConcat(function(v) {
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

  ,combineLatestWith: function(otherPipe) {
    var pipesToCombine = [].slice.call(arguments)
    pipesToCombine.unshift(this)
    var numPipesToCombine = pipesToCombine.length


    return new Pipe(function(outlet) {
      var recentValues = new Array(numPipesToCombine)
      var hasSentFirst = new Array(numPipesToCombine)
      var hasFinished = new Array(numPipesToCombine)

      for (var i = 0; i < numPipesToCombine; i++) {(function(i) {
        recentValues[i] = undefined
        hasSentFirst[i] = false
        hasFinished[i] = false

        pipesToCombine[i].on({
          bond: function(b) {
            outlet.bond.addBond(b)
          }
          ,next: function(v) {
            if (!hasSentFirst[i]) hasSentFirst[i] = true
            recentValues[i] = v
            for (var j = 0; j < numPipesToCombine; j++) {
              if (!hasSentFirst[j]) return
            }
            outlet.sendNext(recentValues.slice())
          }
          ,error: function(e) {
            outlet.sendError(e)
          }
          ,done: function() {
            hasFinished[i] = true
            for (var j = 0; j < numPipesToCombine; j++) {
              if (!hasFinished[j]) return
            }
            outlet.sendDone()
          }
        })
      })(i)}
    })
  }

  ,not: function() {
    return this.map(function(x) {
      return !x
    })
  }
  ,and: function(otherPipe) {
    return this.combineLatestWith(otherPipe).map(function(xs) {
      return !!xs[0] && !!xs[1]
    })
  }
  ,or: function(otherPipe) {
    return this.combineLatestWith(otherPipe).map(function(xs) {
      return !!xs[0] || !!xs[1]
    })
  }

  ,filterAdjacent: function(comparingFn) {
    return this.filter((function() {

      var hasSentFirstValue = false
      var previousValue

      return function(x) {
        if (!hasSentFirstValue) {
          hasSentFirstValue = true
          previousValue = x
          return true
        }
        else if (comparingFn(previousValue, x)) {
          previousValue = x
          return true
        }
        return false
      }
    })())
  }
  ,dedupe: function() {
    return this.filterAdjacent(function(prev, current) {
      return prev !== current
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
