var _queue = []
var _queue_processor_is_scheduled = false
var _is_currently_processing_queue = false

var _process_queue = function() {
  _is_currently_processing_queue = true
  while(_queue.length) {
    job = _queue.shift()
    try {
      job()
    } catch (e) {}
  }
  _is_currently_processing_queue = false
  _queue_processor_is_scheduled = false
}
var _process_queue_later = function() {
  if (_queue_processor_is_scheduled) return
  _schedule_later(_process_queue)
  _queue_processor_is_scheduled = true
}

// TODO: automatically detect best async scheduler
//       based on environment
var _schedule_later = process.nextTick
// var _schedule_later = function(later_fn) {
//   setTimeout(later_fn, 4/* ms */)
// }

var enqueue = function(job) {
  _queue.push(job)
  _process_queue_later()
}
var exec_when_processing_queue = function(job) {
  if (_is_currently_processing_queue) {
    job()
  } else {
    enqueue(job)
  }
}

module.exports = {
  enqueue: enqueue
  ,exec_when_processing_queue: exec_when_processing_queue
}
