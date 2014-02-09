var Pipe = require('./Pipe')
var Inlet = require('./Inlet')
var HistoryInlet = require('./HistoryInlet')
var Outlet = require('./Outlet')
var Promise = require('./Promise')
var schedulers = require('./schedulers')

module.exports = {
  Pipe: Pipe
  ,Inlet: Inlet
  ,HistoryInlet: HistoryInlet
  ,Outlet: Outlet
  ,Promise: Promise
  ,SyncScheduler: schedulers.SyncScheduler
  ,AsyncScheduler: schedulers.AsyncScheduler
  // ,AttachmentScheduler: schedulers.AttachmentScheduler // TODO: remove
  ,currentScheduler: schedulers.currentScheduler
}
