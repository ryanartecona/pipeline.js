var assert = require('./assert')
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
