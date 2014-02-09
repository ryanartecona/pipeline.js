var assert = require('assert')
var Pipe = require('./Pipe')


var Inlet = function() {
  this.init()
}
Inlet.prototype = new Pipe()

Inlet.prototype.attachOutlet = function(outlet) {
  assert(typeof outlet.sendNext === 'function'
      && typeof outlet.sendError === 'function'
      && typeof outlet.sendDone === 'function')
  this.outlets || (this.outlets = [])
  this.outlets.push(outlet)
  return this
}

Inlet.prototype.sendNext = function(x) {
  assert(!this.isDone, 'cannot send `next` event on finished Pipe')
  this._broadcastToOutlets('sendNext', x)
  return this
}
Inlet.prototype.sendError = function(e) {
  assert(!this.isDone, 'cannot send `error` event on finished Pipe')
  this._broadcastToOutlets('sendError', e)
  this.isDone = true
  delete this.outlets
  return this
}
Inlet.prototype.sendDone = function() {
  assert(!this.isDone, 'cannot send `done` event on finished Pipe')
  this._broadcastToOutlets('sendDone')
  this.isDone = true
  delete this.outlets
  return this
}


module.exports = Inlet
