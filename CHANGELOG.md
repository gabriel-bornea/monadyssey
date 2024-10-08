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
