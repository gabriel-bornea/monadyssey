## [1.12.2](https://github.com/gabriel-bornea/monadyssey/compare/v1.12.1...v1.12.2) (2025-02-04)


### Bug Fixes

* Fix infinite recursion causing blocked HTTP requests by introducing an interceptor chain. ([#79](https://github.com/gabriel-bornea/monadyssey/issues/79)) ([f51a93f](https://github.com/gabriel-bornea/monadyssey/commit/f51a93f02fb8759cd7d0d1444c9f87689da173cb))

## [1.12.1](https://github.com/gabriel-bornea/monadyssey/compare/v1.12.0...v1.12.1) (2025-02-04)


### Bug Fixes

* Fix infinite recursion causing blocked HTTP requests when interceptors are used. ([#78](https://github.com/gabriel-bornea/monadyssey/issues/78)) ([1bcbce3](https://github.com/gabriel-bornea/monadyssey/commit/1bcbce3848fb1112143c773b53a295fa2178cb6c))

# [1.12.0](https://github.com/gabriel-bornea/monadyssey/compare/v1.11.3...v1.12.0) (2025-02-04)


### Bug Fixes

* Fix infinite interceptor recursion causing blocked HTTP requests. ([#77](https://github.com/gabriel-bornea/monadyssey/issues/77)) ([31f006a](https://github.com/gabriel-bornea/monadyssey/commit/31f006aba746e1160d5dfd68b33fd51c72530dff))


### Features

* Introduce match to handle both success and error cases with branching logic in IO data type. This is a non-terminal operation, meaning the returned IO can be further composed and executed lazily. ([#75](https://github.com/gabriel-bornea/monadyssey/issues/75)) ([230024c](https://github.com/gabriel-bornea/monadyssey/commit/230024c98fffd0b69706b5f6279f4738d99c3103))

## [1.11.3](https://github.com/gabriel-bornea/monadyssey/compare/v1.11.2...v1.11.3) (2025-01-06)


### Bug Fixes

* Document addition of `headers` field to `HttpError`. ([#73](https://github.com/gabriel-bornea/monadyssey/issues/73)) ([45a34f3](https://github.com/gabriel-bornea/monadyssey/commit/45a34f3408e224f63991b7505636c97cba7e2003))
* Error message contains the actual error in case of a parsing failure. The error response now includes the server headers. ([#72](https://github.com/gabriel-bornea/monadyssey/issues/72)) ([61def6c](https://github.com/gabriel-bornea/monadyssey/commit/61def6cf0692be88422bb5a019e6a6886ba5387d))
* Prevent duplicate interceptors in `HttpClient`. ([#71](https://github.com/gabriel-bornea/monadyssey/issues/71)) ([31d74fc](https://github.com/gabriel-bornea/monadyssey/commit/31d74fcb721b095e1f75a774d8638beb7152aad4))

## [1.11.2](https://github.com/gabriel-bornea/monadyssey/compare/v1.11.1...v1.11.2) (2025-01-01)


### Bug Fixes

* Export `HttpError` type from `monadyssey-fetch` module ([#69](https://github.com/gabriel-bornea/monadyssey/issues/69)) ([1910ba2](https://github.com/gabriel-bornea/monadyssey/commit/1910ba2b65c87be81413a453fbe338ab39ca8193))

## [1.11.1](https://github.com/gabriel-bornea/monadyssey/compare/v1.11.0...v1.11.1) (2025-01-01)


### Bug Fixes

* Set correct `monadyssey` version in `monadyssey-fetch` module ([#68](https://github.com/gabriel-bornea/monadyssey/issues/68)) ([6a28271](https://github.com/gabriel-bornea/monadyssey/commit/6a282719405d6eb69be38e4821bb5aab6f7e4309))

# [1.11.0](https://github.com/gabriel-bornea/monadyssey/compare/v1.10.0...v1.11.0) (2025-01-01)


### Features

* **enh:** Add `retryIf` to `IO` data type for configurable retries with conditions. This enhancement enables conditional retries based on a user-defined policy and error matching while supporting optional error transformation for added flexibility. ([#67](https://github.com/gabriel-bornea/monadyssey/issues/67)) ([3545152](https://github.com/gabriel-bornea/monadyssey/commit/354515262b5178a6e6f562cae408a894947f898f))

# [1.10.0](https://github.com/gabriel-bornea/monadyssey/compare/v1.9.2...v1.10.0) (2024-12-30)


### Features

* Add support for `HttpClient` interceptors ([#66](https://github.com/gabriel-bornea/monadyssey/issues/66)) ([3804230](https://github.com/gabriel-bornea/monadyssey/commit/380423076d3e67ab000f7ddc8913b393264de2f9))

## [1.9.2](https://github.com/gabriel-bornea/monadyssey/compare/v1.9.1...v1.9.2) (2024-12-30)

## [1.9.1](https://github.com/gabriel-bornea/monadyssey/compare/v1.9.0...v1.9.1) (2024-12-18)


### Bug Fixes

* ensure type declarations are correctly generated for release. ([#64](https://github.com/gabriel-bornea/monadyssey/issues/64)) ([6a6ed6f](https://github.com/gabriel-bornea/monadyssey/commit/6a6ed6f909e1ce4e89336e9464865ae738655766))

# [1.9.0](https://github.com/gabriel-bornea/monadyssey/compare/v1.8.0...v1.9.0) (2024-12-18)


### Features

* Introduced `monadyssey-fetch` module with an HttpClient that offers a functional wrapper for the Fetch API. ([#63](https://github.com/gabriel-bornea/monadyssey/issues/63)) ([14edc05](https://github.com/gabriel-bornea/monadyssey/commit/14edc0566c560b191feed3e52f57557483d837a7))

# [1.8.0](https://github.com/gabriel-bornea/monadyssey/compare/v1.7.2...v1.8.0) (2024-12-10)


### Bug Fixes

* Manually bump version in order to fix previous automatically failed releases. ([db38405](https://github.com/gabriel-bornea/monadyssey/commit/db3840527b7dc6251350ae1edff6fcc4f26c0a85))
* Monorepo releases are bumped for each module individually. ([#62](https://github.com/gabriel-bornea/monadyssey/issues/62)) ([aa26882](https://github.com/gabriel-bornea/monadyssey/commit/aa268820541815606f85c0a40f8dddd4ce8c73d3))


### Features

* Transition to monorepo structure, this change helps manage multiple modules more effectively and supports future growth and modularity. ([e057dbe](https://github.com/gabriel-bornea/monadyssey/commit/e057dbe4f8d9334052fba9c3074026237f1872d8))

## [1.7.4](https://github.com/gabriel-bornea/monadyssey/compare/v1.7.3...v1.7.4) (2024-12-10)


### Bug Fixes

* Include readme file into each module. ([07a820a](https://github.com/gabriel-bornea/monadyssey/commit/07a820a84c13600bb73f1c34e759e1a6c93ff1dc))

## [1.7.3](https://github.com/gabriel-bornea/monadyssey/compare/v1.7.2...v1.7.3) (2024-12-10)


### Bug Fixes

* Refactor project to monorepo structure while fixing build issues. ([a4c3df2](https://github.com/gabriel-bornea/monadyssey/commit/a4c3df2ba94b5353e1f9b75da58ffa39192d21bd))
* Refactor project to monorepo structure while npm authentication. ([a8817f6](https://github.com/gabriel-bornea/monadyssey/commit/a8817f66500570b87f1dfadbf2e9add937ef5654))

## [1.7.2](https://github.com/gabriel-bornea/monadyssey/compare/v1.7.1...v1.7.2) (2024-12-10)


### Performance Improvements

* Enhanced execution mechanics for the IO type, introducing improvements that preserve both laziness and safety while optimizing how operations are handled. ([#61](https://github.com/gabriel-bornea/monadyssey/issues/61)) ([bd71ccb](https://github.com/gabriel-bornea/monadyssey/commit/bd71ccb19c06865cb1d831d5f381a648310c0032))

## [1.7.1](https://github.com/gabriel-bornea/monadyssey/compare/v1.7.0...v1.7.1) (2024-12-01)


### Bug Fixes

* The `refine` method now creates a new `IO` instance with updated operations instead of modifying the existing instance directly. This ensures immutability, allowing for safer and more predictable composition of `IO` operations. ([#60](https://github.com/gabriel-bornea/monadyssey/issues/60)) ([f3b1ea2](https://github.com/gabriel-bornea/monadyssey/commit/f3b1ea26ea54f93ea305732a161d5ec08fef3633))

# [1.7.0](https://github.com/gabriel-bornea/monadyssey/compare/v1.6.1...v1.7.0) (2024-12-01)


### Features

* Introduce Ordering Type for Type-Safe Comparisons and Enhanced Sorting Functionality ([#56](https://github.com/gabriel-bornea/monadyssey/issues/56)) ([16a82b2](https://github.com/gabriel-bornea/monadyssey/commit/16a82b2037064d18834a56e589ce5af121da23f9))
* Reader constructor is now public in order to facilitate more complex or custom use cases without relying solely on predefined static methods. ([#58](https://github.com/gabriel-bornea/monadyssey/issues/58)) ([3522b83](https://github.com/gabriel-bornea/monadyssey/commit/3522b8357eb5b6c75c9787314d2c75719f3d552f))


### Performance Improvements

* IO manages side effects internally with a single operation composed of multiple async tasks. ([#59](https://github.com/gabriel-bornea/monadyssey/issues/59)) ([01085b9](https://github.com/gabriel-bornea/monadyssey/commit/01085b96e1c816f3de3759e8f24ae50182aeeff1))

## [1.6.1](https://github.com/gabriel-bornea/monadyssey/compare/v1.6.0...v1.6.1) (2024-09-12)

# [1.6.0](https://github.com/gabriel-bornea/monadyssey/compare/v1.5.5...v1.6.0) (2024-08-30)


### Bug Fixes

* Upgraded various dependencies to their latest versions for improved security and functionality. ([#48](https://github.com/gabriel-bornea/monadyssey/issues/48)) ([e37ad32](https://github.com/gabriel-bornea/monadyssey/commit/e37ad324c9b35562f738dfedf6a230df1a2fd711))


### Features

* Introduced `Reader` type for enhanced dependency injection. ([#49](https://github.com/gabriel-bornea/monadyssey/issues/49)) ([866d42e](https://github.com/gabriel-bornea/monadyssey/commit/866d42e42d00bc997f60ad9879489b29b9a951b7))

## [1.5.5](https://github.com/gabriel-bornea/monadyssey/compare/v1.5.4...v1.5.5) (2024-07-24)


### Bug Fixes

* Remove SequenceError wrapper from `forM` in order to preserve the user defined errors. ([#47](https://github.com/gabriel-bornea/monadyssey/issues/47)) ([5536c34](https://github.com/gabriel-bornea/monadyssey/commit/5536c345b39560bda46c071f17b335f98ecaded3))
* Update dev dependencies ([#46](https://github.com/gabriel-bornea/monadyssey/issues/46)) ([4e897a0](https://github.com/gabriel-bornea/monadyssey/commit/4e897a03b9e554b5f5a327d324f6b1584c5b7aac))

## [1.5.4](https://github.com/gabriel-bornea/monadyssey/compare/v1.5.3...v1.5.4) (2024-07-05)


### Bug Fixes

* `retryIf` in `Schedule` enhances its flexibility and error handling capabilities. The change involves modifying the condition parameter from a simple boolean function to a function that accepts an error and returns a boolean. This adjustment allows the retry logic to be more context-aware and specific in determining whether to retry an operation based on the error encountered. ([#42](https://github.com/gabriel-bornea/monadyssey/issues/42)) ([91fef2a](https://github.com/gabriel-bornea/monadyssey/commit/91fef2a213ea89a28ff6cc392b2140401b73f2e4))

## [1.5.3](https://github.com/gabriel-bornea/monadyssey/compare/v1.5.2...v1.5.3) (2024-07-03)


### Bug Fixes

* Update module filename extensions in configuration files. ([#41](https://github.com/gabriel-bornea/monadyssey/issues/41)) ([3c121b3](https://github.com/gabriel-bornea/monadyssey/commit/3c121b3959b1e25374c2e1acc7756273c9168319))

## [1.5.2](https://github.com/gabriel-bornea/monadyssey/compare/v1.5.1...v1.5.2) (2024-07-03)


### Bug Fixes

* Enhance TypeScript and Vite Configuration for the library ([#40](https://github.com/gabriel-bornea/monadyssey/issues/40)) ([fb84fd9](https://github.com/gabriel-bornea/monadyssey/commit/fb84fd95a33351a44c6f8cb0ed93a20474d561fa))

## [1.5.1](https://github.com/gabriel-bornea/monadyssey/compare/v1.5.0...v1.5.1) (2024-07-02)


### Bug Fixes

* Updates the `handleErrorWith` function in the IO data type to allow more flexible error handling. It also improves error type inference in case of errors. ([#38](https://github.com/gabriel-bornea/monadyssey/issues/38)) ([b7a859b](https://github.com/gabriel-bornea/monadyssey/commit/b7a859b6907cbc447fa10cb0a835803c6b55cd3b))

# [1.5.0](https://github.com/gabriel-bornea/monadyssey/compare/v1.4.1...v1.5.0) (2024-06-04)


### Features

* Introduces a new 'Eval' type that represents deferred computations with the ability to specify immediate, deferred, and lazy computations. ([#33](https://github.com/gabriel-bornea/monadyssey/issues/33)) ([7640f88](https://github.com/gabriel-bornea/monadyssey/commit/7640f883b5679b312520f9fe5b9ddb042c56f369))


### Performance Improvements

* Refactor performance testing infrastructure and tests. Introduced simulation.ts, which encapsulates the performance testing functionalities. ([#34](https://github.com/gabriel-bornea/monadyssey/issues/34)) ([08d7357](https://github.com/gabriel-bornea/monadyssey/commit/08d73576e67a0f40f07a3d0e55fb85b7a4ebd5ea))

## [1.4.1](https://github.com/gabriel-bornea/monadyssey/compare/v1.4.0...v1.4.1) (2024-05-20)


### Bug Fixes

* `IO.parZip` accepts a callback function and processes the results of parallel IO operations through it. If all operations are successful, the combined result is the return value of the callback function. ([#32](https://github.com/gabriel-bornea/monadyssey/issues/32)) ([5db0db1](https://github.com/gabriel-bornea/monadyssey/commit/5db0db1d5b31bb6487c0d56996f6ea5e9b60e854))

# [1.4.0](https://github.com/gabriel-bornea/monadyssey/compare/v1.3.1...v1.4.0) (2024-05-20)


### Features

* Introduce Either.catch() for enhanced error handling ([#29](https://github.com/gabriel-bornea/monadyssey/issues/29)) ([437bcf0](https://github.com/gabriel-bornea/monadyssey/commit/437bcf0f4e78498af535872d03aa53c4f11046cd))
* Introduced the ability to cancel ongoing scheduled operations in the Schedule class. Deprecated `zip2` and `zip3` methods and replaced them with an experimental, more generic `parZip` functionality. ([#30](https://github.com/gabriel-bornea/monadyssey/issues/30)) ([cb487bd](https://github.com/gabriel-bornea/monadyssey/commit/cb487bdc03557079e7b4d15f2eb70bcc3e7fd0b9))

## [1.3.1](https://github.com/gabriel-bornea/monadyssey/compare/v1.3.0...v1.3.1) (2024-05-04)


### Bug Fixes

* Experimental decorator added to schedule methods and resolved minor code syntax issues. Required format for the package build was adjusted in the package.json file. ([#28](https://github.com/gabriel-bornea/monadyssey/issues/28)) ([316f64f](https://github.com/gabriel-bornea/monadyssey/commit/316f64f1dbf85efd2c35be9a2b3297f0a1510581))

# [1.3.0](https://github.com/gabriel-bornea/monadyssey/compare/v1.2.0...v1.3.0) (2024-05-02)


### Features

* Monadic for `forM` over a sequence of IO operations encapsulated in an `IO` monad. ([#25](https://github.com/gabriel-bornea/monadyssey/issues/25)) ([a28bb01](https://github.com/gabriel-bornea/monadyssey/commit/a28bb017431b6fb70a39d0dc60037abfb0fcde8b))
* Option data type ([#26](https://github.com/gabriel-bornea/monadyssey/issues/26)) ([2326975](https://github.com/gabriel-bornea/monadyssey/commit/2326975c06c154147024e387ccf1530828e09f68))

# [1.2.0](https://github.com/gabriel-bornea/monadyssey/compare/v1.1.0...v1.2.0) (2024-04-28)


### Features

* implement getOrElse and getOrHandle ([#23](https://github.com/gabriel-bornea/monadyssey/issues/23)) ([ff9d6d1](https://github.com/gabriel-bornea/monadyssey/commit/ff9d6d15cd30cf1979771f2b96cf28a99efadb92))

# [1.1.0](https://github.com/gabriel-bornea/monadyssey/compare/v1.0.2...v1.1.0) (2024-04-26)


### Features

* initial version of Either data type ([#18](https://github.com/gabriel-bornea/monadyssey/issues/18)) ([6fd0058](https://github.com/gabriel-bornea/monadyssey/commit/6fd0058390f52198a83916694d6f5badaef741dd))

## [1.0.2](https://github.com/gabriel-bornea/monadyssey/compare/v1.0.1...v1.0.2) (2024-04-23)


### Performance Improvements

* Implement benchmarking strategy for library core components ([#16](https://github.com/gabriel-bornea/monadyssey/issues/16)) ([69b10e3](https://github.com/gabriel-bornea/monadyssey/commit/69b10e374046b29e4c8b69525a4b7fd74c15c8ac))

## [1.0.1](https://github.com/gabriel-bornea/monadyssey/compare/v1.0.0...v1.0.1) (2024-04-07)


### Bug Fixes

* include release for npm packages ([#12](https://github.com/gabriel-bornea/monadyssey/issues/12)) ([65b94a2](https://github.com/gabriel-bornea/monadyssey/commit/65b94a229c2e8e377cb9fe62cdeb9dadf95fe58c))
