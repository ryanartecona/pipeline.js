TODO
====

## Tasks:
  - [ ] Support outlet detachment
    - [x] Pipe
    - [x] Inlet + subclasses
  - [ ] Event class to represent next/error/done events
  - [x] PropertyInlet
  - [ ] Scheduler replace work_queue
    - [x] SyncScheduler
    - [x] AsyncScheduler
      - [ ] with autodetecting async method for exec env
        (see Bluebird's impl)
    - [x] AttachmentScheduler (private)
      - [ ] Figure out if AttachmentScheduler is even necessary,
            or just use currentScheduler()
  - [x] Refactor to reduce send*/attachOutlet code dupe
  - [ ] SharedPipe
  - [x] Make a browser build
    - [ ] Include an in-browser test runner
  - [ ] Populate important RAC/Rx combinators

## Decisions:
  - [ ] How to handle/propagate errors?
  - [ ] Include AsyncInlet?
    - thinking of renaming Promise to APlusPromise, and including a
      Promise/Future/Singlet that's just HistoryInlet(1).take(1) 
  - [x] Nomenclature
    - Go with 'Pipe' analogies? leaning: yes
      - If so, what to call cancellable subscription handles?
        Tap/Coupling/Subscription/Bond? leaning: 'Bond'
    - Or fall back to RAC names? (Signal et al.)
  - [ ] How to expose a scheduling API (see src/schedulers)
  - [ ] Clean API for different merge/join strategies
    - [ ] mergeMap/concatMap & mergeJoin/concatJoin?
  - [ ] Rename HistoryInlet to BufferInlet or CacheInlet?

## Ideas:
  - A+ compliant Promise *with* monadic interface
  - A debug mode that captures & extends stack traces
  - Backpressure!
  - Automatically track important properties on Pipe, e.g.
    - will it finish? yes/no/maybe
    - value(s) sent on attachment? yes/no
    - side effects? no/maybe
