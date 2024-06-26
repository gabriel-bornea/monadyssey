![CI/CD](https://github.com/gabriel-bornea/monadyssey/actions/workflows/release.yml/badge.svg)
[![semantic-release: angular](https://img.shields.io/badge/semantic--release-angular-e10079?logo=semantic-release)](https://github.com/semantic-release/semantic-release)
[![npm version](https://img.shields.io/npm/v/monadyssey.svg)](https://www.npmjs.com/package/monadyssey)

### Overview

The `monadyssey` library is a TypeScript toolkit designed to enhance the development of 
robust applications by introducing a series of advanced data structures and control flow mechanisms. 
With its roots in functional programming principles, `monadyssey` aims to solve common challenges in 
application development, particularly around asynchronous operations, and error management.

### Functional Programming at its Core

At the heart of `monadyssey` lies the embrace of functional programming paradigms. By leveraging 
pure functions, immutability, and advanced type constructs, the library offers a way to write clearer, 
more predictable code. It abstracts away common boilerplate for asynchronous operations and error 
handling, allowing developers to focus on business logic rather than control flow intricacies.

### Key Components

* __Retryable Asynchronous Operations__: Asynchronous operations are a cornerstone of modern application 
development, but they often require complex retry logic to handle transient failures gracefully. 
`monadyssey` provides a `Schedule` class, paired with a Policy configuration, to declaratively manage 
retries, delays, and timeouts, making operations more resilient.
* __Comprehensive Error Handling__: With the `IO` data type, `monadyssey` wraps asynchronous effects 
in a structure that explicitly models both success and failure. This approach encourages 
rigorous error handling, ensuring that errors are not overlooked and can be transformed or 
recovered from in a structured manner.

### Advantages

* Type Safety: By leveraging TypeScript's advanced type system, `monadyssey` helps catch errors at 
compile-time, reducing the risk of runtime exceptions and ensuring code adheres to specified behaviors.
* Composability: The library's use of monads and other functional constructs enables the composition 
of operations in a clear and logical manner. This composability extends to error handling and 
retry logic, allowing complex behaviors to be built from simpler, understandable pieces.
* Simplification of Async/Await Patterns: While async/await syntax has made asynchronous code more 
readable, managing retries, parallel executions, and error handling can still lead to complex code. 
`monadyssey` simplifies these patterns, offering a higher-level abstraction that maintains 
readability and reduces boilerplate.

### Core Components

### `NonEmptyList<A>`
A generic class representing a list that contains at least one element. It is constructed 
with a head (the first element) and a tail (an array of zero or more elements).

*Methods*:

* `size`: Returns the total number of elements in the list.
* `all`: Retrieves all elements of the list as an array.
* `get(index: number)`: Retrieves an element at a specified index.
* `fromArray(value: A[])`: Creates a new NonEmptyList from an array.
* `filter(f)`: Filters elements based on a predicate function.
* `map(f)`: Applies a function to each element, creating a new NonEmptyList.
* `flatMap(f)`: Applies a function returning NonEmptyList to each element, flattening the result.
* `traverse(f)`: Applies an asynchronous function to each element, awaiting all promises.
* `foldLeft`, `foldRight`: Reduces the elements to a single value using an accumulator function.

### `Policy`
An interface defining the configuration for retry policies, used in conjunction with `Schedule` to manage retries 
for asynchronous operations.

### `Schedule`
A class that implements retry logic for IO operations based on a defined Policy. 
It supports retrying operations based on a condition, repeating operations, and applying timeouts.

*Methods*:

* `retryIf(f, condition, liftE)`: Retries an IO operation based on a condition.
* `repeat(f, liftE)`: Repeats an IO operation according to the policy.
* `withTimeout(f, liftE)`: Applies a timeout to an IO operation.

*Error types*:
Custom error classes are provided to represent various error conditions, including 
`PolicyValidationError`, `TimeoutError`, `RetryError`, and `RepeatError`.

### `IO<E, A>`
A class representing an encapsulated asynchronous operation (effect) 
that may result in a success (`Ok<A>`) or an error (`Err<E>`).

*Factory Methods*:

* `of(f)`: Creates an IO instance from an asynchronous function.
* `ofSync(f)`: Wraps a synchronous function within IO.
* `ok(value)`, `err(error)`: Creates instances of Ok and Err, respectively.

*Instance Methods*:

* `map(f)`, `mapError(f)`, `flatMap(f)`: Transform the success value or error, or chain another IO operation.
* `recover(f)`: Attempts to recover from an error by applying a provided function.
* `runAsync()`: Executes the encapsulated asynchronous effect.

*Utility Methods*:

* `parZip(f1, f2, fn, (a, b, c) => a + b + c)`: Combines multiple IO operations into a single operation, executing them in parallel.

### `Either<A, B>`

The `Either<A, B>` interface represents a value of one of two possible types: a failure (`Left<A>`) or a success (`Right<B>`). 
It is typically used for error handling without exceptions.

*Factory Methods*:

* `Left.of(value: A): Either<A, never>`: Creates an instance of Left, representing the failure state.
* `Right.of(value: B): Either<never, B>`: Creates an instance of Right, representing the success state.

*Instance Methods*:

* `map(f: (b: B) => C): Either<A, C>`: Applies a function to the Right value, if present.
* `mapLeft(f: (a: A) => C): Either<C, B>`: Applies a function to the Left value, if present.
* `flatMap(f: (b: B) => Either<A, C>): Either<A, C>`: Applies a function that returns an Either, if the instance is Right.
* `fold(ifLeft: (a: A) => C, ifRight: (b: B) => C): C`: Resolves the Either by applying the appropriate function based on its state.
* `tap(action: (b: B) => void): Either<A, B>`: Executes a function on the Right value, returning the original Either.
* `tapLeft(action: (a: A) => void): Either<A, B>`: Executes a function on the Left value, returning the original Either.

### Usage
This library is designed to be used in TypeScript applications where functional programming patterns 
are preferred for managing asynchronous operations, ensuring safety, and handling 
errors in a structured way.

### Examples
To provide a clearer understanding of how to effectively use each component of our library, we will soon add 
detailed real-world examples. These examples will demonstrate practical applications, showcasing step-by-step 
usage in common scenarios. For immediate guidance, please refer to the method descriptions and inline comments 
within the source code, which are designed to help you get started.

