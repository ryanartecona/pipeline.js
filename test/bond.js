var assert = require('assert')
var PL = require('../src/pipeline')
var _ = require('./utils')


describe('Bond', function() {

  it('calls its break handler when broken', function(done) {
    var bond = new PL.Bond(function() {
      done()
    })
    bond.break()
  })

  it('can only be broken once', function() {
    var breakCount = 0
    var bond = new PL.Bond(function() {
      breakCount++
    })
    bond.break()
    bond.break()
    assert(breakCount === 1)
  })

  it('cannot be broken from within its own break handler', function() {
    var breakCount = 0
    var bond = new PL.Bond(function() {
      breakCount++
      bond.break()
    })
    bond.break()
    assert(breakCount === 1)
  })
})
