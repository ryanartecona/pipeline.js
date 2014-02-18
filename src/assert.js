module.exports = function assert(testVal, message) {
  if (!testVal) {
    throw new TypeError(message)
  }
}
