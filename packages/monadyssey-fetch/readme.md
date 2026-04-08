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

- [HttpClient](../../docs/monadyssey-fetch/http-client.md): Composable HTTP client with base URL, interceptors, cancellation, timeout, and native body type support.

### Installation

To use `monadyssey-fetch` in your project, install it via npm:

```
npm install monadyssey-fetch
```

### Features

#### Instance-Based Configuration

Each `HttpClient` instance carries its own configuration — base URL, interceptors, default headers, timeout, and
credentials. Different parts of an application can use independently configured clients.

#### Cancellation

Cancelling an IO (via `fiber.cancel()` or `IO.timeout`) aborts the underlying `fetch` call through `AbortSignal`.
No network resources are wasted on cancelled requests.

#### Timeout

Configurable at both client level and per-request. When a timeout fires, the HTTP request is aborted.

#### Native Body Types

`FormData`, `Blob`, `File`, `ArrayBuffer`, `URLSearchParams`, and `ReadableStream` are passed directly to `fetch`
without JSON serialization. For `FormData`, no `Content-Type` header is set — the browser handles the multipart
boundary automatically.

#### Interceptors

Interceptors are passed at construction time and are immutable. They can transform requests, short-circuit responses,
retry on failure, or modify responses. Different client instances can have independent interceptor stacks.

#### Explicit Error Handling

All requests return `IO<HttpError, T>`, explicitly modeling success and failure. Errors include HTTP status, response
body, headers, and URL for full diagnostic context.

### Usage

**Creating a Client**
```typescript
import { HttpClient } from "monadyssey-fetch";

const api = new HttpClient({
  baseUrl: "https://api.example.com",
  interceptors: [authInterceptor],
  defaultHeaders: { "Accept": "application/json" },
  timeout: 5000,
});
```

**GET Request**
```typescript
const result = await api.get<User>("/users/1").unsafeRun();
```

**POST Request with Body**
```typescript
await api.post<User>("/users", { name: "New User" })
  .tap((user) => console.log(user))
  .mapErr((error) => console.error(error))
  .unsafeRun();
```

**File Upload with FormData**
```typescript
const formData = new FormData();
formData.append("file", file);

await api.post("/upload", formData).unsafeRun();
```

**Custom Request with `fetch`**
```typescript
await api.fetch<{ message: string }>("/custom", "OPTIONS", {
  headers: { "X-Custom-Header": "value" },
}).unsafeRun();
```

### Options

| **Option**     | **Type**                                                    | **Description**                                                               |
|----------------|-------------------------------------------------------------|-------------------------------------------------------------------------------|
| `headers`     | `Record<string, string>`                                     | Custom headers. Merged with defaults, keys normalized to lowercase            |
| `body`        | `any`                                                        | Request payload. Objects auto-JSON; FormData/Blob passed as-is                |
| `responseType`| `"json"`, `"text"`, `"blob"`, `"arrayBuffer"`, `"formData"` | Expected response type. **Defaults to `"json"`**                              |
| `credentials` | `"omit"`, `"same-origin"`, `"include"`                      | Credential policy. **Defaults to client setting (`"include"`)**               |
| `observe`     | `"body"` or `"response"`                                     | Return parsed body or full `Response`. **Defaults to `"body"`**               |
| `transform`   | `(data: any) => A`                                           | Transform the response data                                                   |
| `timeout`     | `number`                                                     | Per-request timeout in milliseconds. Overrides client-level timeout           |

### Error Handling

Errors are encapsulated in the `HttpError` type, which includes:

* `status`: The HTTP status code (500 for network errors)
* `message`: Formatted error message containing the URL, status, and raw message
* `rawMessage`: The raw error description
* `body`: The response body if available
* `url`: The request URL
* `headers`: The response headers if available

### License

This project is licensed under the MIT License.
