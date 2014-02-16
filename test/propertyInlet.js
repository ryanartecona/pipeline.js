var assert = require('assert')
var PL = require('../src/pipeline')
// var AttachmentScheduler = require('../src/schedulers').AttachmentScheduler
var _ = require('./utils')

describe('PropertyInlet', function() {
  this.timeout(500 /* ms */)

  describe('given no initial value', function() {

    beforeEach(function() {
      this.propertyInlet = new PL.PropertyInlet()

      // this.finishPropertyInlet = function() {
      //   var thisTest = this
      //   AttachmentScheduler.schedule(function () {
      //     thisTest.propertyInlet.sendDone()
      //   })
      // }
    })

    it('sends `undefined` on attachment before being sent anything', function(done) {
      _.assertAccum(this.propertyInlet, [undefined], done)
      this.propertyInlet.sendDone()
    })

    it('sends a single value if it receives a single value', function(done) {
      this.propertyInlet.sendNext(true)
      _.assertAccum(this.propertyInlet, [true], done)
      this.propertyInlet.sendDone()
    })

    it('sends its currentValue before any new values', function(done) {
      this.propertyInlet.sendNext('current')
      _.assertAccum(this.propertyInlet, ['current', 'first', 'second'], done)
      this.propertyInlet.sendNext('first')
      this.propertyInlet.sendNext('second')
      this.propertyInlet.sendDone()
    })

    it('only sends the most recent received value on attachment', function(done) {
      this.propertyInlet.sendNext('old')
      this.propertyInlet.sendNext('current')
      _.assertAccum(this.propertyInlet, ['current', 'new'], done)
      this.propertyInlet.sendNext('new')
      this.propertyInlet.sendDone()
    })

    it('does not send values to new outlets once finished', function(done) {
      this.propertyInlet.sendDone()
      try {
        this.propertyInlet.on({
          next: function() {
            done('next handler should not be called')
          }
        })
        done('no exception when one was expected')
      }
      catch (e) {
        done()
      }
    })
  })
})
