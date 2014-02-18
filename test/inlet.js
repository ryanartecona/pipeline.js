var assert = require('assert')
var PL = require('../src/pipeline')
var _ = require('./utils')


describe('Inlet', function() {
  this.timeout(500 /* ms */)

  beforeEach(function() {
    this.inlet = new PL.Inlet()
  })

  it('should send a next value', function(done) {
    _.assertAccum(this.inlet, [1], done)
    this.inlet.sendNext(1)
    this.inlet.sendDone()
  })

  it('should only send next values after outlet attachment', function(done) {
    this.inlet.sendNext(1)
    _.assertAccum(this.inlet, [2,3], done)
    this.inlet.sendNext(2)
    this.inlet.sendNext(3)
    this.inlet.sendDone()
  })

  it('should send an error', function(done) {
    this.inlet.on({
      error: function(e) {
        done()
      }
      ,done: function() {
        done('did not send an error :(')
      }
    })
    this.inlet.sendError('yay error!')
  })

  it('should finish immediately', function(done) {
    _.assertAccum(this.inlet, [], done)
    this.inlet.sendDone()
  })

  describe('attached outlet', function() {
    describe('cancellation', function() {

      it('can happen after values have been sent', function(done) {
        var bond = this.inlet.on({
          next: function(v) {
            done()
          }
          ,done: function() {
            done('done event should never be received')
          }
        })
        this.inlet.sendNext(1)
        bond.break()
        this.inlet.sendNext(2)
        this.inlet.sendDone()
      })

      it('can happen within an event handler', function(done) {
        var bond = this.inlet.on({
          next: function(v) {
            done()
            bond.break()
          }
          ,done: function() {
            done('done event should never be received')
          }
        })
        this.inlet.sendNext(1)
        this.inlet.sendNext(2)
        this.inlet.sendDone()
      })
    })
  })
})
