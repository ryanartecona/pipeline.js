var assert = require('assert')


var assertAccum = function(p, expectedValues, done){
  var accumValues = []
  var accumulate = function(v){
    accumValues.push(v)
  }
  p.on({
    next: accumulate
    ,error: done
    ,done: function(){
      assert.deepEqual(expectedValues, accumValues)
      done()
    }
  })
}


module.exports = {
  assertAccum: assertAccum
}
