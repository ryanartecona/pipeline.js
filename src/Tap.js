var assert = require('assert')
var work_queue = require('./work_queue')


var Tap = function(detacher) {
  this.init(detacher)
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
  var self = this
  if (!self.isDetached) {
    work_queue.exec_when_processing_queue(function() {
      if (!self.isDetached) {
        self.detachHandler()
        self.isDetached = true
        delete self.detachHandler
      }
    })
  }
}


module.exports = Tap
