var debug_mode = false
var debug = function debug() {
  if (debug_mode) {
    console.log.apply(console, [].slice.call(arguments))
  }
}

module.exports = {
  debug: debug
}
