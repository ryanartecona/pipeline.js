⟚ pipeline.js ⟚
===============

An aspiring (though currently experimental) implementation of functional-reactive programming in JavaScript, inspired by [ReactiveCocoa](https://github.com/ReactiveCocoa/ReactiveCocoa) and [Rx](https://github.com/Reactive-Extensions/RxJS).

-----

## Intro

Rx-style FRP essentially gives you a unified way of defining, manipulating, managing, and reacting to anything that can be reasonably represented as a __stream of values__. In JavaScript, these include (but are definitely not limited to) familiar idioms such as

 - DOM events
 - Pub/sub patterns (e.g. EventEmitter)
 - Node streams
 - Promises (and callbacks and everything else Promises can represent)

Like Promises, FRP provides a general abstraction for a common pattern that lets consumers write code that is declarative, composable, and reusable. Unlike Promises, FRP value streams can send multiple values at arbitrary points in time (generally when a particular interesting event occurs), and so are well suited for representing changes of a value over time, or events emitted from a source. FRP unifies these patterns under a single API and provides combinators to concisely express complex stream transformations, so that you the application author can worry less about state and keep your focus on application logic.

## Goals

This project's goals are to provide a minimal FRP core, a set of useful combinators, and the means to easily adapt the core to interface with third party libraries.

It is in a very early stage, but there are already robust JS FRP libraries available for production use:

 - [RxJS](https://github.com/Reactive-Extensions/RxJS)
 - [Bacon.js](https://github.com/baconjs/bacon.js)

## Usage

(*TODO*)

For now, you can look through the [test suite](test/pipe.js) to see basic usage examples.

## Installation

pipeline.js is compatible with node, browser, and AMD environments. It is not yet published to npm.

## Roadmap

See [TODO.md](TODO.md)

------

Send your thoughts to [@ryanartecona](https://twitter.com/ryanartecona)
