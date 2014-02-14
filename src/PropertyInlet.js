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

PropertyInlet.prototype.currentValue = undefined

PropertyInlet.prototype.sendNext = function(v) {
  assert(!this.isDone, 'cannot send `next` event on finished Pipe')
  this.currentValue = v
  this._broadcastToOutlets('sendNext', v)
  return this
}
PropertyInlet.prototype.onAttach = function(outlet) {
  outlet.sendNext(this.currentValue)
}


module.exports = PropertyInlet
