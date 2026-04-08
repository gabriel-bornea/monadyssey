# HttpClient

`HttpClient` is a composable HTTP client that wraps the native `fetch` API, returning `IO` instances instead of Promises. Each instance carries its own configuration — base URL, interceptors, default headers, timeout, and credentials — allowing different parts of an application to use independently configured clients.

All HTTP methods return `IO<HttpError, T>`, enabling lazy execution, functional composition, and explicit error handling. Cancellation is supported: when an IO is cancelled (via fiber or timeout), the underlying `fetch` call is aborted through `AbortSignal`.

```typescript
import { HttpClient } from "monadyssey-fetch";
```

---

## Table of Contents

- [Creating a Client](#creating-a-client)
- [HTTP Methods](#http-methods)
- [Options](#options)
- [Running Requests](#running-requests)
- [Base URL](#base-url)
- [Default Headers](#default-headers)
- [Timeout](#timeout)
- [Cancellation](#cancellation)
- [Native Body Types](#native-body-types)
- [Interceptors](#interceptors)
- [Error Handling](#error-handling)

---

## Creating a Client

### Constructor

Creates an `HttpClient` with the given configuration. All fields are optional.

```typescript
constructor(config?: HttpClientConfig)
```

```typescript
const api = new HttpClient({
  baseUrl: "https://api.example.com/v2",
  interceptors: [authInterceptor, loggingInterceptor],
  defaultHeaders: { "Accept": "application/json" },
  timeout: 5000,
  credentials: "include",
});
```

---

### `HttpClient.default()`

Creates a default instance with no base URL, no interceptors, and standard defaults.

```typescript
const client = HttpClient.default();
```

Equivalent to `new HttpClient()`.

---

### `HttpClientConfig`

```typescript
type HttpClientConfig = {
  baseUrl?: string;
  interceptors?: HttpInterceptor[];
  defaultHeaders?: Record<string, string>;
  timeout?: number;
  credentials?: Credentials;
};
```

| Field | Default | Description |
|---|---|---|
| `baseUrl` | none | Prepended to relative paths |
| `interceptors` | `[]` | Applied in registration order. Immutable after construction |
| `defaultHeaders` | `{}` | Merged into every request. Per-request headers take precedence |
| `timeout` | none | Default timeout in milliseconds for all requests |
| `credentials` | `"include"` | Default credentials policy |

---

## HTTP Methods

All methods are instance methods and return `IO<HttpError, A | null>`.

The return type includes `| null` because responses with status 204 or 205 return `null`.

```typescript
get<A>(uri: string, options?: Options<A>): IO<HttpError, A | null>
post<A>(uri: string, body?: any, options?: Options<A>): IO<HttpError, A | null>
put<A>(uri: string, body?: any, options?: Options<A>): IO<HttpError, A | null>
patch<A>(uri: string, body?: any, options?: Options<A>): IO<HttpError, A | null>
delete<A>(uri: string, options?: Options<A>): IO<HttpError, A | null>
fetch<A>(uri: string, method: Method, options?: Options<A>): IO<HttpError, A | null>
```

When `observe: "response"` is set, the return type is `IO<HttpError, Response>`:

```typescript
client.get(uri, { observe: "response" }): IO<HttpError, Response>
```

---

## Options

Per-request configuration:

```typescript
type Options<A = any> = {
  headers?: Record<string, string>;
  body?: any;
  responseType?: ResponseType;
  credentials?: Credentials;
  observe?: Observe;
  transform?: (data: any) => A;
  timeout?: number;
};
```

| Option | Default | Description |
|---|---|---|
| `headers` | `{}` | Custom headers. Merged with default headers (per-request wins). All keys are normalized to lowercase |
| `body` | none | Request payload. Objects are JSON-stringified unless they are native body types (FormData, Blob, etc.) |
| `responseType` | `"json"` | How to parse the response: `"json"`, `"text"`, `"blob"`, `"arrayBuffer"`, `"formData"` |
| `credentials` | client default | Overrides the client-level credentials policy |
| `observe` | `"body"` | `"body"` returns parsed data, `"response"` returns the raw `Response` |
| `transform` | identity | Transform the parsed response body before returning |
| `timeout` | client default | Per-request timeout in milliseconds. Overrides the client-level timeout |

---

## Running Requests

Since HTTP methods return `IO`, nothing executes until you run the IO:

```typescript
const client = new HttpClient({ baseUrl: "https://api.example.com" });

// Get the Result (Ok or Err)
const result = await client.get<User>("/users/1").unsafeRun();

// Handle both cases with fold
await client.get<User>("/users/1")
  .fold(
    (error) => console.error(error.status, error.rawMessage),
    (user) => console.log(user)
  )
  .unsafeRun();

// Compose with other IO operations
const operation = client.get<User>("/users/1")
  .map(user => user?.name)
  .mapErr(error => new AppError(error.rawMessage));
```

---

## Base URL

When a `baseUrl` is configured, relative paths are prepended with it. Absolute URLs are left unchanged.

```typescript
const client = new HttpClient({ baseUrl: "https://api.example.com/v2" });

client.get("/users");                        // → https://api.example.com/v2/users
client.get("users");                         // → https://api.example.com/v2/users
client.get("https://other.example.com/data"); // → https://other.example.com/data (unchanged)
```

---

## Default Headers

Default headers are merged into every request. Per-request headers take precedence. All header keys are normalized to lowercase.

```typescript
const client = new HttpClient({
  defaultHeaders: { "X-Api-Key": "secret", "Accept": "application/json" },
});

// Per-request header overrides default
client.get("/data", { headers: { "X-Api-Key": "other-secret" } });
// Sends: { "x-api-key": "other-secret", "accept": "application/json" }
```

---

## Timeout

Timeout can be set at the client level and overridden per-request. When a timeout fires, the underlying `fetch` call is aborted via `AbortSignal`.

```typescript
// Client-level timeout
const client = new HttpClient({ timeout: 5000 });

// Per-request override
client.get("/slow-endpoint", { timeout: 10000 });
```

When a request times out, it produces an `Err<HttpError>` with status 500.

---

## Cancellation

`HttpClient` uses `IO.cancellable` internally, so cancelling the IO (via `fiber.cancel()` or `IO.timeout`) aborts the underlying HTTP request. No network resources are wasted.

```typescript
const client = new HttpClient();

const fiber = client.get<User>("/users/1").fork();

// Later: cancel the request — the HTTP call is aborted
fiber.cancel();
```

Combined with `IO.timeout`:

```typescript
const operation = client.get<User>("/users/1").timeout(3000, () => new TimeoutError());
```

---

## Native Body Types

`FormData`, `Blob`, `File`, `ArrayBuffer`, `ArrayBufferView`, `URLSearchParams`, and `ReadableStream` are passed directly to `fetch` without JSON serialization.

For `FormData`, no `Content-Type` header is set — the browser handles the multipart boundary automatically.

```typescript
// File upload
const formData = new FormData();
formData.append("file", file);

client.post("/upload", formData);
// Content-Type is NOT set — browser adds multipart boundary

// Binary data
const buffer = new ArrayBuffer(1024);
client.post("/binary", buffer);

// URL-encoded form
const params = new URLSearchParams({ key: "value" });
client.post("/submit", params);
```

For plain objects, `Content-Type: application/json` is auto-detected and the body is JSON-stringified. This auto-detection is skipped when a `Content-Type` header is explicitly provided.

---

## Interceptors

Interceptors modify or handle requests and responses at a centralized point. They are passed at construction time and are immutable — different client instances can have different interceptor stacks.

### Defining an Interceptor

```typescript
class AuthInterceptor implements HttpInterceptor {
  constructor(private token: string) {}

  intercept(req: RequestInit, next: (r: RequestInit) => Promise<Response>): Promise<Response> {
    const headers = new Headers(req.headers || {});
    headers.set("Authorization", `Bearer ${this.token}`);
    return next({ ...req, headers });
  }
}
```

### Registering Interceptors

Interceptors are passed in the constructor. The first interceptor registered is the outermost — it sees the request first and the response last.

```typescript
const client = new HttpClient({
  interceptors: [new AuthInterceptor(token), new LoggingInterceptor()],
});
```

### Interceptor Capabilities

- **Transform requests**: Modify headers, body, or other request properties before they reach `fetch`
- **Short-circuit requests**: Return a custom `Response` without calling `next`
- **Transform responses**: Modify the `Response` after `fetch` completes
- **Handle errors**: Catch errors and provide fallback responses or retry logic

```typescript
// Short-circuit example (cache)
class CacheInterceptor implements HttpInterceptor {
  private cache = new Map<string, Response>();

  async intercept(req: RequestInit, next: (r: RequestInit) => Promise<Response>): Promise<Response> {
    const cached = this.cache.get(req.url!);
    if (cached) return cached.clone();
    const response = await next(req);
    this.cache.set(req.url!, response.clone());
    return response;
  }
}

// Retry example
class RetryInterceptor implements HttpInterceptor {
  async intercept(req: RequestInit, next: (r: RequestInit) => Promise<Response>): Promise<Response> {
    try {
      return await next(req);
    } catch {
      return await next(req); // one retry
    }
  }
}
```

### Independent Interceptor Stacks

Different clients can have different interceptors:

```typescript
const publicApi = new HttpClient({ baseUrl: "https://public.api.com" });
const privateApi = new HttpClient({
  baseUrl: "https://private.api.com",
  interceptors: [new AuthInterceptor(token)],
});
```

---

## Error Handling

Errors are represented by `HttpError`, which extends `Error` with additional context:

```typescript
class HttpError extends Error {
  readonly status: number;
  readonly rawMessage: string;
  readonly body: any;
  readonly url: string;
  readonly headers?: Record<string, string>;
}
```

| Field | Description |
|---|---|
| `status` | HTTP status code. 500 for network errors |
| `rawMessage` | Raw error description from the server or client |
| `body` | Parsed response body, if available |
| `url` | The request URL |
| `headers` | Response headers, if available |
| `message` | Formatted string: `"Request to '{url}' failed with status {status} and message: {rawMessage}."` |

Error scenarios:

```typescript
const client = new HttpClient();

const result = await client.get("/users").unsafeRun();

if (result.type === "Err") {
  const error = result.error;
  console.log(error.status);     // 404
  console.log(error.rawMessage); // "Not Found"
  console.log(error.body);      // { message: "User not found" }
  console.log(error.url);       // "https://api.example.com/users"
}
```
