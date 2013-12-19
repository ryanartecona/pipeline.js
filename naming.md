Naming in FRP is Difficult
--------------------------

I want to get the terminology right, so to strike a balance (if one exists) between approachability for JavaScript devs, and clearly defined and distinguished semantics for advanced use. I want to map the terminology onto a domain more readily familiar, less burdened by clashes with existing concepts, and more indicative of each class's role than a straight port of Signal/Subscriber/Subject/Disposable (RAC) or Observable/Observer/Subject/Subscription (RxJava). I will use the core of ReactiveCocoa as a reference point.

```
1.  ReactiveCocoa          Pipeline           Breadboard
2.  Stream                 -                  -
3.  Subscriber             Outlet             Terminal
4.  Signal                 Pipe               Wire
5.  Sequence               -                  -
6.  Subject                Inlet              Lead
7.  ReplaySubject          HistoryInlet       CacheLead
8.  MulticastConnection    BranchPipe         SplitterWire
9.  --Promise--            Promise/Singlet?   Promise/?
10. Disposable             Tap?               Contact
```

 1. Project name

 2. Abstract base class representing a stream of values. Is monadic, includes a set of basic monadic combinators.

 3. An interface representing a handle to which events can be sent. -send[Next|Error|Completed]

 4. Base concrete Stream class, with scheduling & subscription methods. Includes utilities for working with multiple signals (-merge, -combineLatest), signals-of-signals (-flatten, -concat), timing schemes (-throttle, -delay, -interval), and side effects (-setKeyPath:onObject:, -initially, -doNext), etc.

 5. Collection iterator, with eager/lazy evaluation, folds, etc. Convertible to Signal.

 6. A Signal to which values can be sent manually, exposed as a Subscriber interface on itself.

 7. A Subject that caches the values it receives (up to a set capacity), and sends cached values immediately upon subscription.

 8. A Signal that proxies a Signal through an internal subscriber which guarantees that the proxied Signal will not be subscribed to more than once between all the subscriptions that the proxying (multicasting) Signal receives. Good for managing a side-effecting Signal.

 9. Effectively a ReplaySubject with capacity 1 which finishes after the first value received.

 10. A handle on a subscription which when destroyed removes the subscription.
