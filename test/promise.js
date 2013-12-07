var P = require('../src/pipeline')


describe("Promises/A+ Tests", function() {
  require('promises-aplus-tests').mocha({
    deferred: function() {
      var p = new P.Promise
      return {
        promise: p
        ,resolve: function(v) {
          p.fulfill(v)
        }
        ,reject: function(r) {
          p.reject(r)
        }
      }
    }
  })
})
