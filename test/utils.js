var assert = require('assert')


var assertAccum = function(p, expectedValues, done){
  var accumValues = []
  var accumulate = function(v){
    accumValues.push(v)
  }
  try {
    p.on({
      next: accumulate
      ,error: done
      ,done: function(){
        try {
          assert.deepEqual(expectedValues, accumValues)
        }
        catch (e) {
          done(e)
          return
        }
        done()
      }
    })
  }
  catch (e) {
    done(e)
  }
}


module.exports = {
  assertAccum: assertAccum
}
