![CI/CD](https://github.com/gabriel-bornea/monadyssey/actions/workflows/release.yml/badge.svg)
[![semantic-release: angular](https://img.shields.io/badge/semantic--release-angular-e10079?logo=semantic-release)](https://github.com/semantic-release/semantic-release)
[![npm version](https://img.shields.io/npm/v/monadyssey-fetch.svg)](https://www.npmjs.com/package/monadyssey-fetch)
[![Documentation](https://img.shields.io/badge/docs-online-brightgreen)](../../docs/monadyssey-fetch)

### Overview

**monadyssey-fetch** is an HTTP client module designed to provide a functional and composable interface for making 
HTTP requests. It leverages `IO` and other functional constructs from the **monadyssey** core to ensure predictable 
error handling, declarative workflows, and type safety when interacting with APIs.

### Documentation

Explore the documentation for specific features:

- [HttpClient](../../docs/monadyssey-fetch/http-client.md): Encapsulate HTTP requests as composable `IO` operations, manage side effects in a functional style, and handle errors consistently with the `HttpClient`.

### Installation

To use `monadyssey-fetch` in your project, install it via npm:

```
npm install monadyssey-fetch
```

### Features

#### Functional HTTP Requests

`monadyssey-fetch` provides an HTTP client with methods like `get`, `post`, `put`, `patch`, `delete`, and a 
customizable `fetch` function for fine-grained control. All requests return the `IO` type to model asynchronous 
computations explicitly.

#### Explicit Error Handling

The `IO` type encapsulates asynchronous HTTP operations, explicitly modeling success and failure states. This ensures 
errors are handled predictably, allowing developers to transform or recover from errors in a controlled manner.

#### Type Safety

Requests support generic type parameters to define the expected shape of response data, enabling compile-time safety 
and reducing runtime errors.

#### Customizable Requests

The fetch function allows you to use any HTTP method and provides options for headers, response types, and 
credentials, giving you complete control over the request.

### Usage

**GET Request**
```typescript
import { HttpClient } from "monadyssey-fetch";

await HttpClient.get<{ id: number; name: string }>("https://api.example.com/items/1")
  .tap((response) => console.log(response))
  .mapError((error) => console.error(error))
  .runAsync();
```

**POST Request with Body**
```typescript
await HttpClient.post<{ id: number; name: string }>("https://api.example.com/items", { name: "New Item" })
  .tap((response) => console.log(response))
  .mapError((error) => console.error(error))
  .runAsync();
```

**Custom Request with `fetch`**
```typescript
await HttpClient.fetch<{ message: string }>("https://api.example.com/custom", "OPTIONS", { headers: { "X-Custom-Header": "value" } })
  .tap((response) => console.log(response))
  .mapError((error) => console.error(error))
  .runAsync();
```
### Options

The request methods support the following options:

| **Option**     | **Type**                                                    | **Description**                                                               |
|----------------|-------------------------------------------------------------|-------------------------------------------------------------------------------|
| `headers`     | `Record<string, string>`                                     | Custom headers for the request.                                               |
| `responseType`| `"json"`, `"text"`, `"blob"`, `"arrayBuffer"`, `"formData"` | The expected response type. **Defaults to `"json"`.**                         |
| `credentials` | `"omit"`, `"same-origin"`, `"include"`                      | Indicates whether to include cookies in the request. **Defaults to `"include"`.** |
| `observe`     | `"body"` or `"response"`                                     | Determines if the result should be the parsed body or the full `Response`. **Defaults to `"body"`.** |
| `transform`   | `(data: any) => A`                                           | A function to transform the response data.                                    |


### Error Handling
Errors are encapsulated in the HttpError type, which includes:

* `status`: The HTTP status code.
* `message`: A formatted error message containing the URL, status, and raw message.
* `rawMessage`: The raw error message describing the error.
* `body`: The response body if available.
* `url`: The request URL.
* `headers`: The HTTP headers returned by the server, if available. In some cases, such as internal errors, the headers may not be included.

### License

This project is licensed under the MIT License.
