var assert = require('assert')
var PL = require('../src/pipeline')
var Pipe = PL.Pipe
var Inlet = PL.Inlet
var Promise = PL.Promise
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
    var p_digits = Pipe.fromArray([0,1,2,3,4,5,6,7,8,9])
      .skip(5)
    _.assertAccum(p_digits, [5,6,7,8,9], done)
  })
  it('@take', function(done){
    var p_digits = Pipe.fromArray([0,1,2,3,4,5,6,7,8,9])
      .take(5)
    _.assertAccum(p_digits, [0,1,2,3,4], done)
  })
  it('@takeUntil', function(done){
    var p_digits = Pipe.fromArray([0,1,2,3,4,5,6,7,8,9])
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
    _.assertAccum(p_digits, [4,5,6,7], done)
  })

  it('sends an error', function(done){
    var pBroken = new Pipe(function(sub){
      sub.sendError(new Error('broken!'))
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
})
