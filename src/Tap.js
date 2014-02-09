var assert = require('assert')


var Tap = function(detachHandler) {
  this.init(detachHandler)
}

// default state
Tap.prototype.isDetached = false
// default handler
Tap.prototype.detachHandler = function() {}

Tap.prototype.init = function(detachHandler) {
  if (typeof detachHandler === 'undefined') return
  assert(typeof detachHandler === 'function', 'Tap can only be constructed with a detachment handler function.')
  this.detachHandler = detachHandler
}
Tap.prototype.detach = function() {
  if (!this.isDetached) {
    this.detachHandler()
    this.isDetached = true
    delete this.detachHandler
  }
}


module.exports = Tap
