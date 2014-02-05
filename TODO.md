TODO
====

## Tasks:
  - Support outlet detachment
  - Event class to represent next/error/done events
  - PropertyInlet
  - Scheduler replace work_queue
    - SyncScheduler
    - AsyncScheduler
      - with autodetecting async method for exec env
        (see Bluebird's impl)
    - AttachmentScheduler (private)
    - CurrentScheduler (?)
  - Refactor to reduce sendNext/sendError/sendDone/attachOutlet code dupe
  - SharedPipe

## Decisions:
  - How to handle/propagate errors?
  - Include AsyncInlet?
  - Nomenclature
    - Go with 'Pipe' analogies?
      - If so, what to call cancellable subscription handles?
        Tap/Coupling/Subscription
    - Or fall back to RAC names? (Signal et al.)

## Ideas:
  - A+ compliant Promise with monadic interface
  - Automaticly track important properties on Pipe, e.g.
    - will it finish? yes/no/maybe
    - value(s) sent on attachment? yes/no
    - side effects? no/maybe
