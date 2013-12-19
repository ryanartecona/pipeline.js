var assert = require('assert')


var Outlet = function(args){
  this.init(args)
}
Outlet.prototype = {
  init: function(args) {
    assert(args.next || args.done || args.error)
    args.next  && (this.next  = args.next)
    args.error && (this.error = args.error)
    args.done  && (this.done  = args.done)
    return this
  }

  // stub functions, overwritten by 
  // constructor args when supplied
  ,next:  function(v) {}
  ,error: function(e) {}
  ,done:  function() {}
  
  // Outlet interface:
  //  sendNext(v), sendError(e), sendDone()
  ,sendNext: function(v) {
    try {
      this.next(v)
    } catch (e) {
      this.sendError(e)
    }
  }
  ,sendError: function(e) {
    var maybeV = this.error(e)
    if (typeof maybeV != "undefined") {
      this.sendNext(maybeV)
    }
  }
  ,sendDone: function() {
    this.done()
  }
}


module.exports = Outlet
