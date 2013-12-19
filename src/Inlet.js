var assert = require('assert')
var Pipe = require('./Pipe')
var work_queue = require('./work_queue')


var Inlet = function() {
  this.init()
}
Inlet.prototype = new Pipe()

Inlet.prototype.sendNext = function(x) {
  assert(!this.isDone, 'cannot send `next` event on finished Pipe')
  var thisP = this
  work_queue.enqueue(function() {
    if (thisP.isDone) {
      throw new Error(this+' is already done.')
    }
    thisP._broadcastToOutlets('sendNext', x)
  })
  return this
}
Inlet.prototype.sendError = function(e) {
  assert(!this.isDone, 'cannot send `error` event on finished Pipe')
  // TODO: should this be enqueued, or happen synchronously?
  var thisP = this
  work_queue.enqueue(function() {
    if (thisP.isDone) {
      throw new Error(this+' is already done.')
    }
    thisP._broadcastToOutlets('sendError', e)
    thisP.isDone = true
    delete thisP.outlets
  })
  return this
}
Inlet.prototype.sendDone = function() {
  assert(!this.isDone, 'cannot send `done` event on finished Pipe')
  var thisP = this
  work_queue.enqueue(function() {
    if (thisP.isDone) {
      throw new Error(this+' is already done.')
    }
    thisP._broadcastToOutlets('sendDone')
    thisP.isDone = true
    delete thisP.outlets
  })
  return this
}


module.exports = Inlet
