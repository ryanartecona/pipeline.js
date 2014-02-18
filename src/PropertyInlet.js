var assert = require('./assert')
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
