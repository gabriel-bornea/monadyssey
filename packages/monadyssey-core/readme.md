![CI/CD](https://github.com/gabriel-bornea/monadyssey/actions/workflows/release.yml/badge.svg)
[![semantic-release: angular](https://img.shields.io/badge/semantic--release-angular-e10079?logo=semantic-release)](https://github.com/semantic-release/semantic-release)
[![npm version](https://img.shields.io/npm/v/monadyssey.svg)](https://www.npmjs.com/package/monadyssey)
[![Documentation](https://img.shields.io/badge/docs-online-brightgreen)](../../docs/monadyssey-core)

### Overview

**monadyssey** is the foundational module. It addresses challenges such as retrying operations, managing structured error 
handling, and building declarative, reusable workflows. By leveraging type safety and functional paradigms, it encourages 
predictable and maintainable code.

### Documentation

Explore the documentation for specific features:

- [IO](../../docs/monadyssey-core/io.md): Side effects, error handling, composition, parallelism, cancellation, resource safety, and timeout.
- [Schedule](../../docs/monadyssey-core/schedule.md): Retry, repeat, and timeout policies with configurable backoff, jitter, and cancellation.
- [Either](../../docs/monadyssey-core/either.md): A value that is either `Left<A>` or `Right<B>`, for synchronous success/failure modeling.
- [Option](../../docs/monadyssey-core/option.md): A value that may or may not exist — type-safe alternative to `null`.
- [Eval](../../docs/monadyssey-core/eval.md): Deferred, lazy, and memoized computations with stack-safe evaluation.
- [Reader](../../docs/monadyssey-core/reader.md): Environment-based dependency injection.
- [NonEmptyList](../../docs/monadyssey-core/non-empty-list.md): A list guaranteed to have at least one element.
- [Ordering](../../docs/monadyssey-core/ordering.md): Comparison result type with lexicographic composition.

### Installation

To use `monadyssey` in your project, install it via npm:

```
npm install monadyssey
```

### Features

#### Side Effects and Error Handling

The `IO` type encapsulates asynchronous computations while explicitly modeling success and failure states. Errors are 
handled predictably through typed error channels, with recovery and transformation built into the API.

#### Resource Safety

`IO.bracket` guarantees resource cleanup (acquire/use/release) regardless of whether the computation succeeds, fails, 
or is cancelled. Combined with `timeout`, it provides first-class support for bounded execution with automatic cleanup.

#### Cancellation

IO computations can be forked into fibers and cancelled cooperatively via `AbortSignal`. Cancellation propagates through 
`flatMap` chains, parallel combinators, timeouts, and bracket release phases.

#### Scheduling

`Schedule` provides configurable retry and repeat policies with exponential backoff, jitter, per-attempt timeouts, and 
cooperative cancellation. Policies compose with IO through `retryWithSchedule` and `repeatWithSchedule`.

#### Parallel Composition

`parMapN`, `parTraverse`, `parSequence`, and `race` run IO computations concurrently, collecting errors into 
`NonEmptyList` on failure. All combinators respect cancellation.

#### Functional Data Structures

The library provides data structures that align with functional programming principles:

* `Either`: A value that is either `Right` (success) or `Left` (failure), with `map`, `flatMap`, `fold`, and `swap`.
* `Option`: An abstraction for optional values — `Some` or `None` — offering a safer alternative to `null` or `undefined`.
* `NonEmptyList`: A collection guaranteed to contain at least one element, with safe `reduce`, `exists`, `forall`, and all standard list operations.
* `Ordering`: A comparison result (`LT`, `EQ`, `GT`) with lexicographic composition via `concat` and `compareBy`.

#### Lazy and Deferred Computations

`Eval` enables deferred (`Eval.defer`), lazy and memoized (`Eval.lazy`), or immediate (`Eval.now`) evaluation. 
Computations compose with `map` and `flatMap` and are only evaluated when `evaluate()` is called.

#### Environment-Based Dependencies

`Reader` provides a structured way to inject dependencies or shared configurations into computations. It supports 
`map`, `flatMap`, parallel composition with `parZip`, and local environment modification with `local`.

### License

This project is licensed under the MIT License.
