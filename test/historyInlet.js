var assert = require('assert')
var PL = require('../src/pipeline')
var _ = require('./utils')


describe('HistoryInlet', function() {
  this.timeout(500 /* ms */)

  describe('with a capacity of 1', function() {

    beforeEach(function() {
      this.historyInlet = new PL.HistoryInlet(1);
    })

    it('should send the most recent value', function(done) {
      this.historyInlet.sendNext('first')
      this.historyInlet.sendNext('second')

      this.historyInlet.onNext(function(v) {
        if (v === 'second') {
          done()
        } else {
          done('error!')
        }
      })
    })

    it('should, after finishing, should send the most recent value to new outlets', function(done) {
      this.historyInlet.sendNext('first')
      this.historyInlet.sendNext('second')
      this.historyInlet.sendDone()

      var values = []

      this.historyInlet.on({
        next: function(v) {
          values.push(v)
        }
        ,done: function() {
          assert.deepEqual(values, ['second'])
          done()
        }
      })
    })

    it('should not send values that were not received', function(done) {
      this.historyInlet.sendDone()

      // if done gets called with a value, it's treated as an error
      this.historyInlet.on({
        next: done
        ,error: done
        ,done: done
      })
    })

    it('should resend received errors to new outlets', function(done) {
      this.historyInlet.sendError('error!')

      this.historyInlet.on({
        next: done
        ,error: function(e) {
          done()
        }
        ,done: function() {
          done('error!')
        }
      })
    })

    it('can cancel between sent values', function(done) {
      var receivedValues = []
      var bond = this.historyInlet.on({
        next: function(v) {
          receivedValues.push(v)
        }
        ,error: done
        ,done: function() {
          done('should not be reached')
        }
      })

      this.historyInlet.sendNext(1)
      this.historyInlet.sendNext(2)
      bond.break()
      this.historyInlet.sendNext(3)
      this.historyInlet.sendDone()
      assert.deepEqual(receivedValues, [1, 2])
      done()
    })
  })

  describe('with an unlimited capacity', function() {

    beforeEach(function() {
      this.historyInlet = new PL.HistoryInlet
    })

    it('should, after finishing, send all received values to new outlets', function(done) {
      this.historyInlet.sendNext('first')
      this.historyInlet.sendNext('second')
      this.historyInlet.sendDone()

      _.assertAccum(this.historyInlet, ['first', 'second'], done)
    })

    it('should preserve order of saved values and live values', function(done) {
      this.historyInlet.sendNext('first')

      _.assertAccum(this.historyInlet, ['first', 'second', 'third'], done)

      var historyInlet = this.historyInlet
      setTimeout(function() {
        historyInlet.sendNext('third')
        historyInlet.sendDone()
      }, 5)
      this.historyInlet.sendNext('second')
    })
  })
})
