var assert = require('assert')


var assertAccum = function(p, expectAccum, done){
  var accumValues = []
  var accumulate = function(v){
    accumValues.push(v)
  }
  p.on({
    next: accumulate
    ,error: done
    ,done: function(){
      assert.deepEqual(expectAccum, accumValues)
      done()
    }
  })
}


module.exports = {
  assertAccum: assertAccum
}
