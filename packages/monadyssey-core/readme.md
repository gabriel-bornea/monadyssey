![CI/CD](https://github.com/gabriel-bornea/monadyssey/actions/workflows/release.yml/badge.svg)
[![semantic-release: angular](https://img.shields.io/badge/semantic--release-angular-e10079?logo=semantic-release)](https://github.com/semantic-release/semantic-release)
[![npm version](https://img.shields.io/npm/v/monadyssey.svg)](https://www.npmjs.com/package/monadyssey)

### Overview

Monadyssey is a TypeScript library inspired by functional programming principles. It provides utilities for managing 
asynchronous workflows, explicitly handling errors, and working with immutable data structures. The library is 
designed to simplify common patterns in modern application development, offering tools that emphasize clarity, 
flexibility, and composability.

Monadyssey addresses challenges such as retrying operations, managing structured error handling, and building 
declarative, reusable workflows. By leveraging type safety and functional paradigms, it encourages predictable 
and maintainable code.

### Installation

To use Monadyssey in your project, install it via npm:

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

### Contributing
Contributions are welcome! If you’d like to contribute, please see the [contribution guidelines](CONTRIBUTING.md).

### Examples
To provide a clearer understanding of how to effectively use each component of our library, we will soon add 
detailed real-world examples. These examples will demonstrate practical applications, showcasing step-by-step 
usage in common scenarios. For immediate guidance, please refer to the method descriptions and inline comments 
within the source code, which are designed to help you get started.

