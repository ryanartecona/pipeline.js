var assert = require('./assert')


var ProxyOutlet = function(outlet, bond) {
  this.outlet = outlet
  this.bond = bond
  this.outlet.attachedWithBond(bond)
}

ProxyOutlet.prototype.sendNext = function(v) {
  if (this.bond.isBroken) return
  this.outlet.sendNext(v)
}
ProxyOutlet.prototype.sendError = function(e) {
  if (this.bond.isBroken) return
  this.outlet.sendError(e)
}
ProxyOutlet.prototype.sendDone = function() {
  if (this.bond.isBroken) return
  this.outlet.sendDone()
}

ProxyOutlet.prototype.attachedWithBond = function(newBond) {
  if (newBond !== this.bond) {
    this.bond.addBond(newBond)
  }
}


module.exports = ProxyOutlet
