Naming in FRP is Difficult
--------------------------

I want to get this right, and strike a balance (if one exists) between approachability for JavaScript devs, and clearly defined and distinguished semantics for advanced use.

```
1. ReactiveCocoa          Pipeline
2. Stream                 n/a (Pipe)
3. Subscriber             Handle ?
4. Signal                 Pipe
5. Sequence               n/a?
6. Subject                Sink ?
7. ReplaySubject          ?
8. MulticastConnection    ?
```

 1. Project name

 2. Abstract base class representing a stream of values. Is monadic, includes a set of basic monadic combinators.

 3. An interface representing a handle to which events can be sent. -send[Next|Error|Completed]

 4. Base concrete Stream class, with scheduling & subscription methods. Includes utilities for working with multiple signals (-merge, -combineLatest), signals-of-signals (-flatten, -concat), timing schemes (-throttle, -delay, -interval), and side effects (-setKeyPath:onObject:, -initially, -doNext), etc.

 5. Collection iterator, with eager/lazy evaluation, folds, etc. Convertible to Signal.

 6. A Signal to which values can be sent manually, exposed as a Subscriber interface on itself.

 7. A Subject that caches the values it receives (up to a set capacity), and sends cached values immediately upon subscription.

 8. A Signal that proxies a Signal through an internal subscriber which guarantees that the proxied Signal will not be subscribed to more than once between all the subscriptions that the proxying (multicasting) Signal receives. Good for managing a side-effecting Signal.
