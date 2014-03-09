var assert = require('assert')
var PL = require('../src/pipeline')
var Pipe = PL.Pipe
var _ = require('./utils')

describe('Pipe', function(){
  this.timeout(500 /* ms */)


  it('should basically work', function(done){
    var p1 = new Pipe(function(outlet) {
      outlet.sendNext(1)
      outlet.sendNext(2)
      outlet.sendNext(3)
      outlet.sendDone()
    })
    _.assertAccum(p1, [1,2,3], done)
  })

  it('#empty', function(done){
    var pe = Pipe.empty()
    _.assertAccum(pe, [], done)
  })

  it('#return', function(done){
    var pr = Pipe.return(true)
    _.assertAccum(pr, [true], done)
  })

  it('#fromArray', function(done){
    var p = Pipe.fromArray([1,2,3])
    _.assertAccum(p, [1,2,3], done)
  })

  describe('#of', function() {
    it('should behave like #return with one arg', function(done) {
      _.assertAccum(new Pipe.of(1), [1], done)
    })
    it('should behave like #fromArray with multiple args', function(done) {
      _.assertAccum(new Pipe.of(1, 2, 3), [1, 2, 3], done)
    })
  })

  it('@concat', function(done){
    var p1 = new Pipe.fromArray([1,2])
    var p2 = new Pipe.fromArray([3])
    _.assertAccum(p1.concat(p2), [1,2,3], done)
  })

  it('@filter', function(done){
    var p = Pipe.fromArray([1,2,3,4,5,6])
      .filter(function(x){
        return (x % 2) === 0 // evens
      })
    _.assertAccum(p, [2,4,6], done)
  })

  it('@map', function(done){
    var p = Pipe.fromArray([1,2,3,4,5,6])
      .map(function(x){
        return Math.pow(x, 2)
      })
    _.assertAccum(p, [1,4,9,16,25,36], done)
  })

  it('@skip', function(done){
    var pDigits = Pipe.fromArray([0,1,2,3,4,5,6,7,8,9])
      .skip(5)
    _.assertAccum(pDigits, [5,6,7,8,9], done)
  })
  it('@take', function(done){
    var pDigits = Pipe.fromArray([0,1,2,3,4,5,6,7,8,9])
      .take(5)
    _.assertAccum(pDigits, [0,1,2,3,4], done)
  })
  it('@takeUntil', function(done){
    var pDigits = Pipe.fromArray([0,1,2,3,4,5,6,7,8,9])
      .skip(4)
      .takeUntil((function() {
        var initialVal;
        // runs until it encounters a value
        // at least 2x the initial value encountered
        return function(x) {
          if (typeof initialVal === 'undefined') {
            initialVal = x
          }
          return x >= (2 * initialVal)
        }
      })())
    _.assertAccum(pDigits, [4,5,6,7], done)
  })

  describe('attached outlet', function() {

    it('receives an error', function(done) {
      var pBroken = new Pipe(function(outlet) {
        outlet.sendError(new Error('broken!'))
      })
      pBroken.on({
        error: function(e){
          assert.equal(e.message, 'broken!')
          done()
        }
        ,done: function() {
          done('no done event should be sent!')
        }
      })
    })

    it('receives a done event', function(done) {
      var pEmpty = new Pipe(function(outlet) {
        outlet.sendDone()
      })
      // `done` event is the only one called without an argument
      pEmpty.on({next: done, error: done, done: done})
    })

    describe('cancellation', function() {

      it('can happen immediately', function(done) {
        var pipe = Pipe.of(1, 2, 3)
        pipe.on({
          next: done
          ,error: done
          ,done: done
          ,bond: function(bond) {
            bond.break()
          }})
        done()
      })

      it('can happen within the `next` handler', function(done) {
        var pipe = Pipe.of(1, 2, 3)
        var bond;
        pipe.on({
          next: function(v) {
            done()
            bond.break()
          }
          ,error: function(e) {
            done('error should never be received')
          }
          ,done: function() {
            done('done should never be received')
          }
          ,bond: function(b) {
            bond = b
          }
        })
      })

      it('works on a pre-cancelled Outlet', function(done) {
        var pipe = Pipe.of(1, 2, 3)
        var outlet = new PL.Outlet({
          next: done
          ,error: done
          ,done: done
        })
        outlet.bond.break()

        pipe.attachOutlet(outlet)
        done()
      })
    })
  })
})
