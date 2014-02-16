Naming in FRP is Difficult
--------------------------

I want to get the terminology right, so to strike a balance (if one exists) between approachability for JavaScript devs, and clearly defined and distinguished semantics for advanced use. I want to map the terminology onto a domain more readily familiar, less burdened by clashes with existing concepts, and more indicative of each class's role than a straight port of Signal/Subscriber/Subject/Disposable (RAC) or Observable/Observer/Subject/Subscription (RxJS). I will use the core of ReactiveCocoa as a reference point.

```
1.  ReactiveCocoa          Pipeline
2.  Stream                 -
3.  Subscriber             Outlet
4.  Signal                 Pipe
5.  Sequence               -
6.  Subject                Inlet
7.  ReplaySubject          HistoryInlet
8.  MulticastConnection    SharedPipe
9.  ~~Promise~~            Promise
10. Disposable             Bond
11. BehaviorSubject        ?
12. AsyncSubject           ≈Promise
13. CompoundDisposable     MultiBond
14. SerialDisposable       ? (needed?)
```

 1. Project name

 2. Abstract base class representing a stream of values. Is monadic, includes a set of basic monadic combinators.

 3. An interface representing a handle to which events can be sent. -send[Next|Error|Completed]

 4. Base concrete Stream class, with scheduling & subscription methods. Includes utilities for working with multiple signals (-merge, -combineLatest), signals-of-signals (-flatten, -concat), timing schemes (-throttle, -delay, -interval), and side effects (-setKeyPath:onObject:, -initially, -doNext), etc.

 5. Collection iterator, with eager/lazy evaluation, folds, etc. Convertible to Signal.

 6. A Signal to which values can be sent manually, exposed as a Subscriber interface on itself.

 7. A Subject that caches the values it receives (up to a set capacity), and sends cached values immediately upon subscription. Afterward, sends values to existing subcribers as they are received like a normal Subject.

 8. A proxy to a Signal which allows multiple downstream Subscribers to "share" a single subscription to the proxied Signal. Guarantees only a single subscription is made on the proxied signal. A MulticastConnection exposes a new Signal which can be subscribed to as many times as needed. Useful for ensuring subscription side effects or expensive work happen at most once.

 9. This is effectively a ReplaySubject with capacity 1 which finishes after the first value received. Similar to Rx's AsyncSubject, except an AsyncSubject accepts multiple values and only publishes the last value received upon completion, where a Promise only allows a single value to ever be received (called "resolution"). RACPromise has been removed from RAC, but a JS implementation basically *must* include a Promise.

 10. A handle on a subscription which when disposed removes the subscription and cleans up resources.

 11. Useful to model properties that always have some current value. This is effectively a ReplaySubject of capacity 1 which requires an initial replay value at creation. The current replay value is sent immediately upon each new subscription, hence "property".

 12. An AsyncSubject in Rx allows multiple values to be received before sending any. Upon completion, the subject will send only the last received value. This is very similar in purpose to, and consequently superceded by, Promise.

 13. A collection of Disposables which when disposed will dispose of all Disposables that have been added to it.

 14. A wrapper around a single underlying Disposable which allows new Disposables to be (atomically) swapped in (effectively a reference to a Disposable which can itself be disposed). Once the SerialDisposable is disposed, any new Disposable will be disposed immediately upon swapping in.
