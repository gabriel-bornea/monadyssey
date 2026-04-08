/**
 * Specifies how the response should be observed.
 * - `"body"`: Return the response body.
 * - `"response"`: Return the full `Response` object.
 */
export type Observe = "body" | "response";

/**
 * Specifies the expected response type.
 * - `"json"`: Parse the response as JSON.
 * - `"text"`: Parse the response as text.
 * - `"blob"`: Parse the response as a Blob.
 * - `"arrayBuffer"`: Parse the response as an ArrayBuffer.
 * - `"formData"`: Parse the response as FormData.
 */
export type ResponseType = "json" | "text" | "blob" | "arrayBuffer" | "formData";

/**
 * Specifies the credentials policy for the request.
 * - `"omit"`: Do not send credentials with the request.
 * - `"same-origin"`: Send credentials only if the request is to the same origin.
 * - `"include"`: Always send credentials with the request.
 */
export type Credentials = "omit" | "same-origin" | "include";

/**
 * Represents the HTTP method for the request.
 */
export type Method = "GET" | "POST" | "PUT" | "PATCH" | "DELETE" | "OPTIONS" | "HEAD";

/**
 * Options for configuring an individual HTTP request.
 *
 * @template A - The expected type of the response body after transformation.
 */
export type Options<A = any> = {
  /** Custom headers for the request as key-value pairs. */
  headers?: Record<string, string>;

  /** The request payload. */
  body?: any;

  /** The expected type of the response body. Defaults to `"json"`. */
  responseType?: ResponseType;

  /** The credential policy for the request. Defaults to the client-level setting. */
  credentials?: Credentials;

  /** Specifies how the response should be observed. Defaults to `"body"`. */
  observe?: Observe;

  /** A function to transform the response body into the desired type. */
  transform?: (data: any) => A;

  /** Per-request timeout in milliseconds. Overrides the client-level timeout. */
  timeout?: number;
};

/**
 * Configuration for creating an HttpClient instance.
 */
export type HttpClientConfig = {
  /** Base URL prepended to relative paths. */
  baseUrl?: string;

  /** Interceptors applied in registration order (first registered = outermost). Immutable after construction. */
  interceptors?: HttpInterceptor[];

  /** Default headers merged into every request. Per-request headers take precedence. */
  defaultHeaders?: Record<string, string>;

  /** Default timeout in milliseconds for all requests. Can be overridden per-request. */
  timeout?: number;

  /** Default credentials policy. Defaults to `"include"`. */
  credentials?: Credentials;
};

/**
 * An HTTP interceptor that can modify or handle request and response data
 * before and after an outgoing `fetch` call.
 */
export interface HttpInterceptor {
  /**
   * Intercepts an outgoing HTTP request.
   *
   * Call `next(request)` to continue the chain with the (optionally modified) request.
   * Return a `Promise<Response>` without calling `next` to short-circuit the request.
   *
   * @param request - The configuration object for the pending `fetch` call.
   * @param next - Forwards the request to the next interceptor or to `fetch`.
   * @returns A Promise of the resulting `Response`.
   */
  intercept(request: RequestInit, next: (req: RequestInit) => Promise<Response>): Promise<Response>;
}
