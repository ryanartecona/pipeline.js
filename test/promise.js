var P = require('../src/pipeline')


describe("Promises/A+ Tests", function() {
  this.timeout(1000)
  
  require('promises-aplus-tests').mocha({
    deferred: function() {
      var p = new P.Promise
      return {
        promise: p
        ,resolve: function(v) {
          try {
            p.resolve(v)
          } catch (e) {}
        }
        ,reject: function(r) {
          try {
            p.reject(r)
          } catch (e) {}
        }
      }
    }
    ,resolved: P.Promise.fulfilled
    ,rejected: P.Promise.rejected
  })
})
