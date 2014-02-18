var assert = require('./assert')
var Pipe = require('./Pipe')
var Bond = require('./Bond')


var Inlet = function() {
  this.init()
}
Inlet.prototype = new Pipe()

Inlet.prototype.attachOutlet = function(outlet) {
  assert(typeof outlet.sendNext === 'function'
      && typeof outlet.sendError === 'function'
      && typeof outlet.sendDone === 'function')
  assert(!this.isDone, 'cannot attach an outlet to a finished Pipe')
  this.outlets || (this.outlets = [])
  this.outlets.push(outlet)
  var thisInlet = this
  return new Bond(function() {
    thisInlet._detachOutlet(outlet)
  })
}

Inlet.prototype.sendNext = function(v) {
  assert(!this.isDone, 'cannot send next event on finished Pipe')
  this._broadcastToOutlets('sendNext', v)
}
Inlet.prototype.sendError = function(e) {
  assert(!this.isDone, 'cannot send error event on finished Pipe')
  this.isDone = true
  this._broadcastToOutlets('sendError', e)
  delete this.outlets
}
Inlet.prototype.sendDone = function() {
  assert(!this.isDone, 'cannot send done event on finished Pipe')
  this.isDone = true
  this._broadcastToOutlets('sendDone')
  delete this.outlets
}


module.exports = Inlet
