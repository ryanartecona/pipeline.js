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

  it('+empty', function(done){
    var pe = Pipe.empty()
    _.assertAccum(pe, [], done)
  })

  it('+return', function(done){
    var pr = Pipe.return(true)
    _.assertAccum(pr, [true], done)
  })

  it('+fromArray', function(done){
    var p = Pipe.fromArray([1,2,3])
    _.assertAccum(p, [1,2,3], done)
  })

  describe('+of', function() {
    it('should behave like +return with one arg', function(done) {
      _.assertAccum(new Pipe.of(1), [1], done)
    })
    it('should behave like +fromArray with multiple args', function(done) {
      _.assertAccum(new Pipe.of(1, 2, 3), [1, 2, 3], done)
    })
  })

  it('-concatWith', function(done){
    var p1 = new Pipe.fromArray([1,2])
    var p2 = new Pipe.fromArray([3])
    _.assertAccum(p1.concatWith(p2), [1,2,3], done)
  })

  it('-filter', function(done){
    var p = Pipe.fromArray([1,2,3,4,5,6])
      .filter(function(x){
        return (x % 2) === 0 // evens
      })
    _.assertAccum(p, [2,4,6], done)
  })

  it('-map', function(done){
    var p = Pipe.fromArray([1,2,3,4,5,6])
      .map(function(x){
        return Math.pow(x, 2)
      })
    _.assertAccum(p, [1,4,9,16,25,36], done)
  })

  it('-mapReplace', function(done) {
    var p = Pipe.of(1, 2, 3)
      .mapReplace(10)
    _.assertAccum(p, [10, 10, 10], done)
  })

  it('-merge', function(done) {
    var p = Pipe.fromArray([
        Pipe.of(1),
        Pipe.of(2, 2),
        Pipe.of(3, 3, 3)
      ])
      .merge()
    _.assertAccum(p, [1, 2,2, 3,3,3], done)
  })

  it('-concat', function(done) {
    var p = Pipe.fromArray([
        Pipe.of(1),
        Pipe.of(2, 2),
        Pipe.of(3, 3, 3)
      ])
      .concat()
    _.assertAccum(p, [1, 2,2, 3,3,3], done)
  })

  it('-skip', function(done){
    var pDigits = Pipe.fromArray([0,1,2,3,4,5,6,7,8,9])
      .skip(5)
    _.assertAccum(pDigits, [5,6,7,8,9], done)
  })
  it('-take', function(done){
    var pDigits = Pipe.fromArray([0,1,2,3,4,5,6,7,8,9])
      .take(5)
    _.assertAccum(pDigits, [0,1,2,3,4], done)
  })
  it('-takeUntil', function(done){
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
  it('-zipWith', function(done) {
    var nats = Pipe.of(0, 1, 2, 3, 4, 5, 6, 7)
    var primes = Pipe.of(2, 3, 5, 7)
    _.assertAccum(nats.zipWith(primes), [[0,2], [1,3], [2,5], [3,7]], done)
  })
  it('-scan', function(done) {
    var p = Pipe.of(1, -1, 2, -2, 10)
    var runningSum = p.scan(0, function(sum, v) {
      return sum + v
    })
    _.assertAccum(runningSum, [1, 0, 2, 0, 10], done)
  })
  it('-scan1', function(done) {
    var p = Pipe.of(1, -1, 2, -2, 10)
    var runningSum = p.scan1(function(sum, v) {
      return sum + v
    })
    _.assertAccum(runningSum, [0, 2, 0, 10], done)
  })
  it('-combineLatestWith', function(done) {
    var evens = new PL.Inlet()
    var odds = new PL.Inlet()

    _.assertAccum(
      evens.combineLatestWith(odds),
      [
        [2, 1],
        [2, 3],
        [4, 3],
        [6, 3]
      ],
      done
    )

    PL.schedule(function() {
      evens.sendNext(0)
      evens.sendNext(2)
      odds.sendNext(1)
      odds.sendNext(3)
      evens.sendNext(4)
      odds.sendDone()
      evens.sendNext(6)
      evens.sendDone()
    })
  })

  it('-not', function(done) {
    var p = PL.Pipe.fromArray([0,    1,     false, "true", null, {t:1}])
    _.assertAccum(p.not(),    [true, false, true,  false,  true, false], done)
  })
  it('-and', function(done) {
    var p1 = new PL.Inlet()
    var p2 = new PL.Inlet()

    _.assertAccum(p1.and(p2), [true, false, false, false, true], done)

    PL.schedule(function() {
      p1.sendNext(true)
      p2.sendNext(true)
      p1.sendNext(false)
      p2.sendNext(false)
      p1.sendNext(1)
      p2.sendNext(1)
      p1.sendDone()
      p2.sendDone()
    })
  })
  it('-or', function(done) {
    var p1 = new PL.Inlet()
    var p2 = new PL.Inlet()

    _.assertAccum(p1.or(p2), [true, true, false, true, true], done)

    PL.schedule(function() {
      p1.sendNext(true)
      p2.sendNext(true)
      p1.sendNext(false)
      p2.sendNext(false)
      p1.sendNext(1)
      p2.sendNext(1)
      p1.sendDone()
      p2.sendDone()      
    })
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
