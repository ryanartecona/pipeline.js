var assert = require('assert')
var Pipe = require('./Pipe')
var Inlet = require('./Inlet')
var schedulers = require('./schedulers')
var AttachmentScheduler = schedulers.AttachmentScheduler


// TOOD: should this be the constructor,
//   or something like PropertyInlet.withInitial?
var PropertyInlet = function(initialValue) {
  this.currentValue = initialValue
  return this
}
PropertyInlet.prototype = new Inlet()

PropertyInlet.prototype._currentValue = undefined
PropertyInlet.prototype.currentValue = function() {
  return this._currentValue
}

PropertyInlet.prototype.sendNext = function(v) {
  assert(!this.isDone, 'cannot send `next` event on finished Pipe')
  this._currentValue = v
  this._broadcastToOutlets('sendNext', v)
  return this
}
PropertyInlet.prototype.attachOutlet = function(outlet) {
  Inlet.prototype.attachOutlet.call(this, outlet)
  var thisP = this
  AttachmentScheduler.schedule(function() {
    outlet.sendNext(thisP._currentValue)
  })
}


module.exports = PropertyInlet
