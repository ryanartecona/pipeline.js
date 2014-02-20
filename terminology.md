Naming in FRP is Difficult
--------------------------

I want to get the terminology right, so to strike a balance (if one exists) between approachability for JavaScript devs, and clearly defined and distinguished semantics for advanced use. I want to map the terminology onto a domain more readily familiar, less burdened by clashes with existing concepts, and more indicative of each class's role than a straight port of Signal/Subscriber/Subject/Disposable (RAC) or Observable/Observer/Subject/Disposable (RxJS). I will use the core of ReactiveCocoa as a reference point.


1.  | ReactiveCocoa        | RxJS                  | Pipeline.js
:---|:---------------------|:----------------------|:-------------
2.  | Signal               | Observable            | Pipe
3.  | Subscriber           | Observer              | Outlet
4.  | ~~Promise~~          | -                     | Promise
5.  | Subject              | Subject               | Inlet
6.  | ReplaySubject        | ReplaySubject         | HistoryInlet
7.  | BehaviorSubject      | BehaviorSubject       | PropertyInlet
8.  | AsyncSubject         | AsyncSubject          | -
9.  | MulticastConnection  | ConnectableObservable | SharedPipe
10. | Disposable           | Disposable            | Bond
11. | CompoundDisposable   | CompositeDisposable   | MultiBond
12. | SerialDisposable     | SerialDisposable      | -


 1. Project name

 2. A generic stream of values. Is monadic, and includes a broad set of operators. Includes basic operators (-filter, -map, -scan), utilities for working with multiple signals (-merge, -combineLatest), signals-of-signals (-flatten, -concat), timing schemes (-throttle, -delay, -interval), and side effects (-setKeyPath:onObject:, -initially, -doNext), etc.

 3. An interface representing a object to which events can be sent (-sendNext, -sendError, -sendCompleted)

 4. This is effectively a ReplaySubject with capacity 1 which finishes after the first value received. Similar to Rx's AsyncSubject, except an AsyncSubject accepts multiple values and only publishes the last value received upon completion, where a Promise only allows a single value to ever be received (called "resolution"). RACPromise has been removed from RAC, but a JS implementation basically *must* include a Promise.

 5. A Signal to which values can be sent manually, exposed as a Subscriber interface on itself.

 6. A Subject that caches the values it receives (up to a set capacity), and sends cached values immediately upon subscription. Afterward, sends values to existing subcribers as they are received like a normal Subject.

 7. Useful to represent properties that always have some current value (like instance variables). This is effectively a ReplaySubject of capacity 1 which requires an initial replay value at creation. The current replay value is sent immediately upon each new subscription, hence "property".

 8. An AsyncSubject in Rx allows multiple values to be received before sending any to its subscribers. Upon completion, the subject will send only the last received value. This is very similar in purpose to, and consequently superceded by, Promise.

 9. A proxy to a Signal which allows multiple downstream Subscribers to "share" a single subscription to the proxied Signal. Guarantees only a single subscription is made on the proxied signal. A MulticastConnection exposes a new Signal which can be subscribed to as many times as needed. Useful for ensuring subscription side effects or expensive work happen at most once.

 10. A handle on a subscription which, when disposed, removes the subscription and cleans up resources.

 11. A collection of Disposables which, when disposed, will dispose of all Disposables that have been added to it.

 12. A wrapper around a single underlying Disposable which allows new Disposables to be (atomically) swapped in (effectively a reference to a Disposable which can itself be disposed). Once the SerialDisposable is disposed, any new Disposable will be disposed immediately upon swapping in.
