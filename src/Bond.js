var assert = require('assert')


var Bond = function(userBreakHandler) {
  this.init(userBreakHandler)
}

// default state
Bond.prototype.isBroken = false
// default handler
Bond.prototype._userBreakHandler = function() {}

Bond.prototype.init = function(userBreakHandler) {
  assert(typeof userBreakHandler === 'function', 'Bond can only be constructed with a break handler function.')
  this._userBreakHandler = userBreakHandler
}
Bond.prototype.break = function() {
  if (!this.isBroken) {
    this.isBroken = true
    this._userBreakHandler()
    delete this.userBreakHandler
  }
}


module.exports = Bond
