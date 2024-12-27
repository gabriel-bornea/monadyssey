![CI/CD](https://github.com/gabriel-bornea/monadyssey/actions/workflows/release.yml/badge.svg)
[![semantic-release: angular](https://img.shields.io/badge/semantic--release-angular-e10079?logo=semantic-release)](https://github.com/semantic-release/semantic-release)
[![npm version](https://img.shields.io/npm/v/monadyssey.svg)](https://www.npmjs.com/package/monadyssey)
[![Documentation](https://img.shields.io/badge/docs-online-brightgreen)](https://github.com/gabriel-bornea/monadyssey/docs/monadyssey-core)

### Overview

**monadyssey** is the foundational module, its purpose is to addresses challenges such as retrying operations, managing 
structured error handling, and building declarative, reusable workflows. By leveraging type safety and functional 
paradigms, it encourages predictable and maintainable code.

### Documentation

Explore the documentation for specific features:

- [IO](https://github.com/gabriel-bornea/monadyssey/docs/monadyssey-core/io.md): Manage side effects, handle errors consistently, and compose asynchronous operations using the `IO` data type.

### Installation

To use `monadyssey` in your project, install it via npm:

```
npm install monadyssey
```

### Features

#### Declarative Asynchronous Control

Monadyssey offers tools like `Schedule` and configurable retry policies to manage retries, delays, and timeouts. These 
utilities allow developers to define how operations behave in the face of failures or recurring tasks without 
unnecessary complexity.

#### Explicit Error Handling

The `IO` type encapsulates asynchronous computations while explicitly modeling success and failure states. This 
ensures errors are handled predictably, enabling recovery and transformation in a controlled manner.

#### Functional Data Structures

The library provides data structures that align with functional programming principles:

* `NonEmptyList`: A collection guaranteed to contain at least one element, ensuring safe and predictable operations.
* `Either`: A type representing computations that may produce a result (`Right`) or an error (`Left`).
* `Option`: An abstraction for optional values, offering a safer alternative to `null` or `undefined`.

#### Composability

The library emphasizes the composability of workflows, enabling developers to combine, sequence, or parallelize 
operations. This approach promotes the creation of complex behaviors from smaller, reusable components.

#### Lazy and Deferred Computations

The `Eval` type enables deferred or lazy evaluation of computations, optimizing performance and providing 
fine-grained control over execution.

#### Environment-Based Dependencies

The `Reader` type provides a structured way to inject dependencies or shared configurations into computations, ensuring 
clean separation of concerns and improving testability.

### License

This project is licensed under the MIT License.
