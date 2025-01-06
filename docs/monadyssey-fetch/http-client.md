### Introduction to `HttpClient`

In modern frontend applications, fetching data from backends via HTTP is a common requirement. However, making HTTP 
calls introduces side effects, which can complicate application logic, especially when dealing with error handling, 
retries, or request customization. To address these challenges, `monadyssey` introduces a dedicated module tailored 
for HTTP operations, offering a functional wrapper around the native `fetch` API. This ensures side effects are 
encapsulated and managed through the use of the `IO` data type.

This approach offers several benefits. Instead of immediately executing an HTTP request, it returns a lazy value, 
allowing precise control over when the operation is executed. Another significant advantage is the explicit handling of 
errors, eliminating the need for scattered `try/catch` blocks and making failures easier to manage. Additionally, 
because the result is an `IO`, the operation can be seamlessly composed with other asynchronous or effectful computations,
enabling structured and maintainable flows.

With support for common methods like `get`, `post`, `put`, `patch`, `delete`, or a more customizable `fetch`, the client 
offers flexibility for both standard and advanced HTTP interactions. Configuration options like headers, response types, 
and payload transformations make it easy to tailor requests while maintaining clean and declarative flows.

### Making a GET Request
The `get` method allows us to perform a simple `HTTP GET` request while leveraging the benefits of lazy and 
composable computations. It takes the target URL as its first parameter and optionally accepts configuration options 
like headers or response transformations.
```typescript
import { HttpClient } from "monadyssey-fetch";

type User = { id: number; name: string }

const operation = HttpClient.get<User>("https://api.example.com/users/1");
```
At this point, nothing has happened yet. The operation merely describes what we want to do—it defines the HTTP request, 
but it has not been executed.

Without specifying any additional options, this request will return either a `User` object or an error if something goes
wrong during the execution.

By default, the client assumes the following options for the request:

* `responseType = "json"`: The response is expected to be in JSON format and will be parsed accordingly.
* `credentials = "include"`: Cookies and credentials will be included with the request.
* `observe = "body"`: Only the parsed body of the response is returned, rather than the full `Response` object.

These defaults provide sensible behavior for most use cases, but of course, these default values may not suit every scenario.

#### Key Features of Options

- **Headers**
  * Use the `headers` property to add custom key-value pairs for HTTP headers. This is particularly useful for setting 
authorization tokens, custom content types, or any additional metadata required by your API.
- **Response Type**
  * The `responseType` specifies the format of the expected response. Defaults to `"json"`, but you can set it to 
`"text"`, `"blob"`, `"arrayBuffer"`, or `"formData"` depending on the API response.
- **Credentials**
  * The `credentials` property determines whether cookies and authentication data are sent with the request. It 
defaults to `"include"` but can be set to `"omit"` or `"same-origin"` based on your security requirements.
- **Observe**
  * By default, the client returns the parsed response body (`observe: "body"`). However, you can set observe: 
`"response"` to access the full `Response` object, giving you details like status codes and headers.
- **Transform**
  * The `transform` function lets you manipulate the response data before it is returned. This is handy for reshaping 
or validating the data to match your application's requirements.

Let’s assume we need to retrieve the latitude and longitude of a user using a third-party service. Instead of getting 
just the parsed response, we want to access the entire Response object. Additionally, since this service does not 
require authentication, we’ll omit credentials, and for demonstration purposes, we’ll add a custom header.

```typescript
import { HttpClient } from "monadyssey-fetch";

const operation = HttpClient.get("https://api.example.com/location", {
  headers: {
    "X-Custom-Header": "MyCustomValue", // Adding a custom header
  },
  credentials: "omit", // Omitting credentials as authentication is not required
  observe: "response", // Retrieving the full Response object instead of just the body
});
```
In case something goes wrong, the error type returned is `HttpError`. This class extends the native `Error` and enriches 
it with additional context, making it easier to debug and handle HTTP errors effectively.

#### The HttpError includes:

* `status`: The HTTP status code returned by the server (e.g., 404 for Not Found, 500 for Internal Server Error).
* `message`: A custom message containing the `url`, `status` and `rawMessage`.
* `rawMessage`: The raw error message describing what went wrong.
* `body`: The response body, if available, which may contain further details about the error.
* `url`: The URL of the request that caused the error.
* `headers`: The HTTP headers returned by the server, if available. In some cases, such as internal errors, the headers may not be included.

### Custom Requests with `fetch`
The `fetch` method provides a way to perform custom HTTP requests with any HTTP method, offering full flexibility and 
control. This method is particularly useful for scenarios where predefined methods like `get` or `post` aren't sufficient.

#### Key Features of fetch:

* Allows specifying the HTTP method (GET, POST, PUT, DELETE, etc.).
* Accepts an optional `Options` object for configuring headers, response type, credentials, and transformations.

Provides the option to observe either the parsed body (observe: "body") or the full Response object (observe: "response").
```typescript
import { HttpClient } from "monadyssey-fetch";

const operation = HttpClient.fetch<{ message: string }>(
  "https://api.example.com/custom-endpoint",
  "PUT",
  {
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ key: "value" }),
    observe: "response",
  }
);
```

### Executing the Operation

Since the `get` method returns an `IO`, we have multiple ways to execute the operation and handle its result:

* `runAsync`: Executes the operation asynchronously and returns a `Promise` of the result.
* `fold`: Allows you to handle both success and error cases in a single operation by providing two functions—one for each case.

You can explore these methods and others in more detail in the [documentation](../monadyssey-core/io.md).

#### Http Interceptors

When performing HTTP requests, we often encounter recurring tasks such as adding headers for access tokens or other 
authorization data. Handling these operations manually for every request can quickly become repetitive and error-prone.
Another common scenario is logging response details, such as status codes or other relevant information. Without a 
structured approach, these non-functional requirements could bloat our codebase, cluttering business logic with 
repetitive actions and making the code harder to maintain.

To address this, the HTTP client introduces the well-known concept of interceptors. Interceptors allow us to centralize 
recurring tasks, into reusable components. This keeps our codebase clean and focused, eliminating the need to repeat 
non-functional actions for every request.

An interceptor is defined as an interface that must be implemented within our application. They allow us to modify or 
handle HTTP requests and responses at a centralized point.

They can:

* *Transform Requests*: Modify the RequestInit object (e.g., add headers, adjust payloads).
* *Short-Circuit Requests*: Provide a custom Response without reaching the server.
* *Modify Responses*: Process the Response object after the fetch completes.

Defining an interceptor involves implementing the `HttpInterceptor` interface and providing custom logic within the 
`intercept` method. For example, an interceptor that adds a custom header to every request could be implemented as follows:

```typescript
class AddCustomHeaderInterceptor implements HttpInterceptor {
  intercept(req: RequestInit, next: (r: RequestInit) => Promise<Response>): Promise<Response> {
    const newHeaders = new Headers(req.headers || {}); // Clone existing headers or initialize if none
    newHeaders.set("X-Custom-Header", "custom-value"); // Add the custom header
    return next({ ...req, headers: newHeaders });      // Forward the modified request to the next interceptor or to the actual request
  }
}
```
In this example:
* The `intercept` method receives the original request (`req`) and a `next` function.
* It creates a copy of the request `headers`, modifies them to include the custom header, and then calls `next` with the updated request.
* The `next` function ensures that the modified request continues through the interceptor chain or is ultimately sent.

Defining an interceptor is just the first step—it also needs to be registered with the `HttpClient` to become part of 
the request pipeline. This can be done by calling:
```typescript
HttpClient.addInterceptor(new AddCustomHeaderInterceptor());
```
You can register multiple interceptors with the HttpClient. It's important to note that interceptors are applied 
in reverse registration order. This means that the most recently added interceptor is invoked first.

This ordering allows interceptors to wrap and control the behavior of subsequent interceptors in the chain, providing 
flexibility for tasks like modifying requests, handling responses, or even short-circuiting the request flow when necessary.

Interceptors can also be removed if they are no longer needed. This can be done using the `removeInterceptor` method, 
which removes a specific interceptor instance from the pipeline:
```typescript
const interceptor = new AddCustomHeaderInterceptor();
HttpClient.addInterceptor(interceptor);

// Later, when the interceptor is no longer necessary
HttpClient.removeInterceptor(interceptor);
```
The `removeInterceptor` method:

* Searches for the provided interceptor instance in the pipeline.
* Removes it if found; if the instance is not present, no action is taken.

This feature is useful for dynamically managing interceptors in your application, ensuring that the pipeline remains 
relevant and efficient as your requirements evolve.

### Conclusion
The `monadyssey-fetch` HTTP client offers a functional and composable approach to managing HTTP requests in both 
frontend and backend applications. By leveraging the `IO` type, it ensures lazy execution and clean separation of 
concerns. Features like interceptors and customizable options make it highly adaptable to diverse use cases.

Adhering to functional programming principles, it emphasizes explicit error handling, reliance on values over imperative 
operations, and composability, resulting in a codebase that is clean, maintainable, and robust.
