var assert = require('assert')
var PL = require('../src/pipeline')
var _ = require('./utils')


describe('MultiBond', function() {
    
  beforeEach(function() {
    thisTest = this
    this.breakCount = 0
    this.incBreakCount = function() {thisTest.breakCount++}
  })

  it('given no child bonds, does nothing when broken', function() {
    var multiBond = new PL.MultiBond()
    multiBond.break()
  })

  it('given multiple child bonds, breaks each of them once', function() {
    var multiBond = new PL.MultiBond([
      new PL.Bond(this.incBreakCount)
      ,new PL.Bond(this.incBreakCount)
      ,new PL.Bond(this.incBreakCount)
    ])
    multiBond.break()
    assert(this.breakCount === 3)
  })

  it('treats bonds given at construction time and those added later the same', function() {
    var multiBond = new PL.MultiBond([new PL.Bond(this.incBreakCount)])
    multiBond.addBond(new PL.Bond(this.incBreakCount))
    multiBond.break()
    assert(this.breakCount === 2)
  })

  it('when already broken, added child bonds are immediately broken', function() {
    var multiBond = new PL.MultiBond([new PL.Bond(this.incBreakCount)])
    multiBond.break()
    assert(this.breakCount === 1)

    multiBond.addBond(new PL.Bond(this.incBreakCount))
    assert(this.breakCount === 2)
  })
})
