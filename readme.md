![CI/CD](https://github.com/gabriel-bornea/monadyssey/actions/workflows/release.yml/badge.svg)
[![Documentation](https://img.shields.io/badge/docs-online-brightgreen)](/docs)

### Overview

Monadyssey is a TypeScript library inspired by functional programming principles. It provides utilities for managing 
asynchronous workflows, explicitly handling errors, and working with immutable data structures. The library is 
designed to simplify common patterns in modern application development, offering tools that emphasize clarity, 
flexibility, and composability.

## Modules

Monadyssey is organized into the following modules:

- [**monadyssey-core**](packages/monadyssey-core/readme.md): Core library providing functional programming utilities such as `IO`, `Schedule`, `Either`, `Option`, and more.
- [**monadyssey-fetch**](packages/monadyssey-fetch/readme.md): A fetch API wrapper that returns an `IO` instead of a `Promise`, enabling functional handling of HTTP requests with composable side effect management.

### Contributing
Contributions are welcome! If you’d like to contribute, please see the [contribution guidelines](CONTRIBUTING.md).
