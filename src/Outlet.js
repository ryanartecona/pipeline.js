var assert = require('assert')
var Bond = require('./Bond')
var MultiBond = require('./MultiBond')


var Outlet = function(handlers){
  this.init(handlers)
}
Outlet.prototype = {
  init: function(handlers) {
    var nextIsFunction = typeof handlers.next === 'function'
    var errorIsFunction = typeof handlers.error === 'function'
    var doneIsFunction = typeof handlers.done === 'function'
    
    assert(nextIsFunction || errorIsFunction || doneIsFunction)

    nextIsFunction && (this._nextHandler  = handlers.next)
    errorIsFunction && (this._errorHandler = handlers.error)
    doneIsFunction && (this._doneHandler  = handlers.done)

    var thisOutlet = this
    this._bond = new MultiBond([new Bond(function() {
      delete thisOutlet._nextHandler
      delete thisOutlet._errorHandler
      delete thisOutlet._doneHandler
    })])
  }

  // noop default handlers, overwritten by 
  // constructor args when supplied
  ,_nextHandler:  function(v) {}
  ,_errorHandler: function(e) {}
  ,_doneHandler:  function() {}
  
  // Outlet interface:
  //  sendNext(v), sendError(e), sendDone()
  ,sendNext: function(v) {
    this._nextHandler.call(null, v)
  }
  ,sendError: function(e) {
    if (!this.hasOwnProperty('_errorHandler')) return
    var errorHandler = this._errorHandler
    this._bond.break()
    errorHandler(e)
  }
  ,sendDone: function() {
    if (!this.hasOwnProperty('_doneHandler')) return
    var doneHandler = this._doneHandler
    this._bond.break()
    doneHandler()
  }

  ,attachedWithBond: function(newBond) {
    this._bond.addBond(newBond)
  }
}


module.exports = Outlet
