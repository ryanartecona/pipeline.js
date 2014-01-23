var assert = require('assert')
var Pipe = require('./Pipe')
var Inlet = require('./Inlet')
var work_queue = require('./work_queue')


var HistoryInlet = function(capacity) {
  if (typeof capacity === 'undefined') capacity = 0
  assert(typeof capacity === 'number' && capacity >= 0, 'HistoryInlet can only be constructed with an integer capacity.')
  this.capacity = Math.floor(capacity)
}
HistoryInlet.prototype = new Inlet()

HistoryInlet.prototype.capacity = undefined

HistoryInlet.prototype._savedError = undefined
HistoryInlet.prototype._savedValues = undefined
HistoryInlet.prototype._oldestSavedValueIndex = 0
HistoryInlet.prototype._saveNextValue = function(v) {
  if (this.capacity <= 0) return
  if (this.isDone || typeof this._savedError !== 'undefined') return
  this._savedValues || this._savedValues = []
  this._savedValues[this._oldestSavedValueIndex] = v
  this._oldestSavedValueIndex = (this._oldestSavedValueIndex + 1) % this.capacity
}
HistoryInlet.prototype._valuesToReplay = function() {
  // cycle through the savedValues ring buffer,
  // starting at the oldest value index, and return an array
  if (this.capacity <= 0 || typeof this._savedValues === 'undefined') return
  var vs = new Array(this._savedValues.length)
  var i = this._oldestSavedValueIndex % this._savedValues.length
  for (var j = 0; j < this._savedValues.length; j++) {
    vs[j] = this._savedValues[i]
    i = (i + 1) % this._savedValues.length 
  }
  return vs
}
// override sendNext to save the newest value,
// and drop the oldest if at full capacity
HistoryInlet.prototype.sendNext = function(v) {
  assert(!this.isDone, 'cannot send `next` event on finished Pipe')
  var thisP = this
  work_queue.enqueue(function() {
    if (thisP.isDone) {
      throw new Error(this+' is already done.')
    }
    thisP._saveNextValue(v)
    thisP._broadcastToOutlets('sendNext', v)
  })
  return this
}
// override sendError to save the error to send after replayed values
HistoryInlet.prototype.sendError = function(e) {
  assert(!this.isDone, 'cannot send `error` event on finished Pipe')
  // TODO: should this be enqueued, or happen synchronously?
  var thisP = this
  work_queue.enqueue(function() {
    if (thisP.isDone) {
      throw new Error(this+' is already done.')
    }
    thisP.isDone = true
    thisP._savedError = e
    thisP._broadcastToOutlets('sendError', e)
    delete thisP.outlets
  })
  return this
}
// override attachOutlet to send savedValues on subscription,
// then send error (if one is saved) or done (if finished)
HistoryInlet.prototype.attachOutlet = function(outlet) {
  var thisP = this
  work_queue.exec_when_processing_queue(function() {
    var wasDone = thisP.isDone
    var hadError = typeof thisP._savedError !== 'undefined'
    var hadSavedValues = !!thisP._savedValues
    if (wasDone || hadSavedValues) {
      work_queue.enqueue(function() {
        if (hadSavedValues) {
          var vs = thisP._valuesToReplay()
          for (i in vs) {
            outlet.sendNext(vs[i])
          }
        }
        if (hadError) {
          outlet.sendError(thisP._savedError)
        } else if (wasDone) {
          outlet.sendDone()
        } else {
          Inlet.prototype.attachOutlet.call(thisP, outlet)
        }
      })
    } else {
      Inlet.prototype.attachOutlet.call(thisP, outlet)
    }
  })
  return this
}
