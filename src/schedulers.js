/**
 * Thoughts:
 *
 * desired scheduling syntax?
 * perhaps:
 *   PL.schedule(jobFn)
 *   PL.scheduleSync(jobFn)
 *   PL.scheduleAsync(jobFn)
 * or:
 *   PL.schedule(jobFn)
 *   PL.SyncScheduler.schedule(jobFn)
 *   PL.AsyncScheduler.schedule(jobFn)
 */

var _current
var currentScheduler = function() {
  return _current || defaultScheduler()
}

var defaultScheduler = function() {
  return AsyncScheduler
}

var schedule = function(jobFn) {
  currentScheduler().schedule(jobFn)
}

var scheduleEager = function(jobFn) {
  currentScheduler().scheduleEager(jobFn)
}

var withCurrentScheduler = function(scheduler, jobFn) {
  if (_current === scheduler) {
    jobFn()
    return
  }
  else {
    var prevScheduler = _current
    _current = scheduler
    try {
      jobFn()
    }
    finally {
      _current = prevScheduler
    }
  }
}

var SyncScheduler = {
  schedule: function(userFn) {
    userFn()
  }
  ,scheduleEager: function(userFn) {
    userFn()
  }
}

var AsyncScheduler = (function() {
  var _queue = []
  var _queue_processor_is_scheduled = false
  var _is_currently_processing_queue = false

  var _drain_queue = function() {
    withCurrentScheduler(AsyncScheduler, function() {
      _is_currently_processing_queue = true
      while(_queue.length) {
        var job = _queue.shift()
        _do_user_job(job)
      }
      _is_currently_processing_queue = false
      _queue_processor_is_scheduled = false
    })
  }
  var _drain_queue_later = function() {
    if (_queue_processor_is_scheduled) return
    _schedule_later(_drain_queue)
    _queue_processor_is_scheduled = true
  }
  var _do_user_job = function(jobFn) {
    try {
      jobFn()
    }
    catch (e) {
      // TODO: configurable async error handling
      console.log(e.stack)
    }
  }

  // TODO: 
  //   automatically detect best async scheduler
  //   based on availability in environment:
  //    - process.nextTick
  //    - MutationObserver
  //    - setImmediate
  //    - postMessage
  //    - MessageChannel
  //    - script readystatechanged
  //    - setTimeout
  var _schedule_later = (function() {
    if (typeof process !== 'undefined'
      && typeof process.nextTick === 'undefined')
    {
      return process.nextTick
    }
    else if (typeof setImmediate === 'function')
    {
      return setImmediate
    }
    else if (typeof setTimeout === 'function')
    {
      return function (jobFn) {
        setTimeout(jobFn, 1)
      }
    }
    else
    {
      throw new Exception('this environment does not have a supported method of asynchronously scheduling a function invocation')
    }
  })()

  return {
    schedule: function(jobFn) {
      _queue.push(jobFn)
      _drain_queue_later()
    }
    ,scheduleEager: function(jobFn) {
      if (_is_currently_processing_queue) {
        _do_user_job(jobFn)
      }
      else {
        _queue.push(jobFn)
        _drain_queue_later()
      }
    }
  }
})()

module.exports = {
  schedule: schedule
  ,scheduleEager: scheduleEager
  ,currentScheduler: currentScheduler
  ,SyncScheduler: SyncScheduler
  ,AsyncScheduler: AsyncScheduler
}
