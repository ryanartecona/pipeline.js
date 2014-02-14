TODO
====

## Tasks:
  - Support outlet detachment
  - Event class to represent next/error/done events
  - PropertyInlet [done]
  - Scheduler replace work_queue
    - SyncScheduler [done]
    - AsyncScheduler [done]
      - with autodetecting async method for exec env
        (see Bluebird's impl)
    - AttachmentScheduler (private) [done]
    - CurrentScheduler (?)
  - Refactor to reduce sendNext/sendError/sendDone/attachOutlet code dupe [done?]
  - SharedPipe
  - Make a browser build
    - Include an in-browser test runner
  - Populate important RAC/Rx combinators

## Decisions:
  - How to handle/propagate errors?
  - Include AsyncInlet?
  - Nomenclature
    - Go with 'Pipe' analogies?
      - If so, what to call cancellable subscription handles?
        Tap/Coupling/Subscription
    - Or fall back to RAC names? (Signal et al.)
  - How to expose a scheduling API (see src/schedulers)
  - Clean API for different merge strategies
    - mergeMap/concatMap & mergeJoin/concatJoin?

## Ideas:
  - A+ compliant Promise with monadic interface
  - A debug mode that captures & extends stack traces
  - Automatically track important properties on Pipe, e.g.
    - will it finish? yes/no/maybe
    - value(s) sent on attachment? yes/no
    - side effects? no/maybe
