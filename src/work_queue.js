var _queue = []
var _queue_processor_is_scheduled = false

var enqueue = function(job) {
  // console.log('job scheduled:')
  _queue.push(job)
  _process_queue_later()
}
var _process_queue = function() {
  while(_queue.length) {
    job = _queue.shift()
    try {
      // console.log('job processed:')
      job()
    } catch (e) {
      // don't care
    }
  }
  _queue_processor_is_scheduled = false
}
var _process_queue_later = function() {
  if (_queue_processor_is_scheduled) return
  _schedule_later(_process_queue)
  _queue_processor_is_scheduled = true
}
// var _schedule_later = process.nextTick
var _schedule_later = function(later_fn) {
  setTimeout(later_fn, 4/* ms */)
}

module.exports = {
  enqueue: enqueue
}
