var Bond = require('./Bond')


var MultiBond = function(bonds) {
  this.init(bonds)
}
MultiBond.prototype = new Bond(function(){})

MultiBond._bonds = undefined

MultiBond.prototype.init = function(bonds) {
  (this._bonds = bonds) || (this._bonds = [])
}
MultiBond.prototype.addBond = function(newBond) {
  if (this.isBroken) {
    newBond.break()
  }
  else {
    this._bonds || (this._bonds = [])
    this._bonds.push(newBond)
  }
}
MultiBond.prototype.break = function() {
  if (!this.isBroken) {
    this.isBroken = true
    for (var i=0; i < this._bonds.length; i++) {
      this._bonds[i].break()
    }
    delete this._bonds
  }
}


module.exports = MultiBond
