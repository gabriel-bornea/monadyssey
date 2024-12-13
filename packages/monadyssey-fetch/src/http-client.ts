import { IO } from "monadyssey";
import { Method, Options, ResponseType } from "./options.ts";

/**
 * A composable HTTP client that wraps the native `fetch` API, returning `IO` instances instead of Promises.
 *
 * The `HttpClient` provides methods for executing HTTP requests with various HTTP verbs (`GET`, `POST`, etc.).
 * By returning an `IO`, it enables functional composition, deferred execution, and safer error handling.
 * This approach allows chaining and combining operations while managing errors effectively.
 */
export const HttpClient = {
  /**
   * Performs a GET request to the specified URI.
   *
   * @template A - The expected type of the response body after transformation.
   * @param {string} uri - The URL to send the GET request to.
   * @param {Omit<Options<A>, "body">} [options] - Configuration options for the request, excluding the `body`.
   * @returns {IO<HttpError, Response | A>} - An `IO` representing the result of the request, either a `Response` or the transformed body.
   */
  get: <A = any>(uri: string, options?: Omit<Options<A>, "body">): IO<HttpError, Response | A> =>
    request<A>(uri, "GET", options),

  /**
   * Performs a POST request to the specified URI with an optional body.
   *
   * @template A - The expected type of the response body after transformation.
   * @param {string} uri - The URL to send the POST request to.
   * @param {any} [body] - The payload to send with the request.
   * @param {Options<A>} [options] - Configuration options for the request.
   * @returns {IO<HttpError, Response | A>} - An `IO` representing the result of the request, either a `Response` or the transformed body.
   */
  post: <A = any>(uri: string, body?: any, options?: Options<A>): IO<HttpError, Response | A> =>
    request<A>(uri, "POST", { ...options, body }),

  /**
   * Performs a PUT request to the specified URI with an optional body.
   *
   * @template A - The expected type of the response body after transformation.
   * @param {string} uri - The URL to send the PUT request to.
   * @param {any} [body] - The payload to send with the request.
   * @param {Options<A>} [options] - Configuration options for the request.
   * @returns {IO<HttpError, Response | A>} - An `IO` representing the result of the request, either a `Response` or the transformed body.
   */
  put: <A = any>(uri: string, body?: any, options?: Options<A>): IO<HttpError, Response | A> =>
    request<A>(uri, "PUT", { ...options, body }),

  /**
   * Performs a PATCH request to the specified URI with an optional body.
   *
   * @template A - The expected type of the response body after transformation.
   * @param {string} uri - The URL to send the PATCH request to.
   * @param {any} [body] - The payload to send with the request.
   * @param {Options<A>} [options] - Configuration options for the request.
   * @returns {IO<HttpError, Response | A>} - An `IO` representing the result of the request, either a `Response` or the transformed body.
   */
  patch: <A = any>(uri: string, body?: any, options?: Options<A>): IO<HttpError, Response | A> =>
    request<A>(uri, "PATCH", { ...options, body }),

  /**
   * Performs a DELETE request to the specified URI.
   *
   * @template A - The expected type of the response body after transformation.
   * @param {string} uri - The URL to send the DELETE request to.
   * @param {Omit<Options<A>, "body">} [options] - Configuration options for the request, excluding the `body`.
   * @returns {IO<HttpError, Response | A>} - An `IO` representing the result of the request, either a `Response` or the transformed body.
   */
  delete: <A = any>(uri: string, options?: Omit<Options<A>, "body">): IO<HttpError, Response | A> =>
    request<A>(uri, "DELETE", options),

  /**
   * Performs a custom HTTP request with the specified method.
   *
   * @template A - The expected type of the response body after transformation.
   * @param {string} uri - The URL to send the request to.
   * @param {Method} method - The HTTP method to use (e.g., "GET", "POST").
   * @param {Options<A>} [options] - Configuration options for the request.
   * @param {"body" | "response"} [options.observe="body"] - Determines if the result should be the parsed body or the full `Response` object.
   * @returns {IO<HttpError, Response | A>} - An `IO` representing the result of the request, either a `Response` or the transformed body.
   */
  fetch: <A = any>(uri: string, method: Method, options: Options<A> = {}): IO<HttpError, Response | A> =>
    request<A>(uri, method, options),
};

/**
 * Represents an HTTP error encountered during a request.
 *
 * `HttpError` extends the native `Error` class and provides additional context
 * such as the HTTP status code, the raw error message, the response body, and the request URL.
 */
export class HttpError extends Error {
  /**
   * The HTTP status code returned by the server.
   * @type {number}
   */
  public readonly status: number;

  /**
   * The raw error message describing the error.
   * @type {string}
   */
  public readonly rawMessage: string;

  /**
   * The body of the response associated with the error.
   * Can be `null` if the body is unavailable.
   * @type {any}
   */
  public readonly body: any;

  /**
   * The URL of the request that resulted in the error.
   * @type {string}
   */
  public readonly url: string;

  constructor(status: number, rawMessage: string, body: any, url: string) {
    super(`Request to ${url} failed with status ${status} and message ${rawMessage}`);
    this.name = "HttpError";
    this.status = status;
    this.rawMessage = rawMessage;
    this.body = body;
    this.url = url;
  }
}

const request = <A = any>(uri: string, method: Method, options: Options<A> = {}): IO<HttpError, Response | A> =>
  IO.forM(async (bind) => {
    const {
      headers = {},
      body,
      responseType = "json",
      credentials = "include",
      observe = "body",
      transform = (data: any) => data as A,
    } = options;

    const hs: HeadersInit = { ...headers };
    if (
      !hs["Content-Type"] &&
      body &&
      typeof body === "object" &&
      !(
        body instanceof FormData ||
        body instanceof Blob ||
        body instanceof URLSearchParams ||
        body instanceof ArrayBuffer
      )
    ) {
      hs["Content-Type"] = "application/json";
    }

    const request: RequestInit = {
      method,
      headers: hs,
      credentials,
      body: method !== "GET" && method !== "HEAD" && body ? JSON.stringify(body) : undefined,
    };

    const response = await bind(IO.of(() => fetch(uri, request)).mapError((e) => toHttpError(e, uri)));

    if (!response.ok) {
      const rb = await bind(parse(response, responseType, uri));
      return await bind(IO.failed(new HttpError(response.status, response.statusText, rb, uri)));
    }

    if (observe === "response") {
      return response;
    } else {
      const rb = await bind(parse(response, responseType, uri));
      return transform(rb) as A;
    }
  });

const parse = (response: Response, responseType: ResponseType, url: string): IO<never, any> =>
  IO.of(async () => {
    if (response.status === 204 || response.status === 205) {
      return null;
    }
    try {
      switch (responseType) {
        case "json":
          return await response.json();
        case "text":
          return await response.text();
        case "blob":
          return await response.blob();
        case "arrayBuffer":
          return await response.arrayBuffer();
        case "formData":
          return await response.formData();
        default:
          return Promise.reject(new HttpError(500, `Unsupported response type: ${responseType}`, null, url));
      }
    } catch {
      return Promise.reject(new HttpError(500, "Unable to parse response body", null, url));
    }
  });

const toHttpError = (e: unknown, uri: string): HttpError => {
  let message: string;

  if (e instanceof Error) {
    message = e.message;
  } else if (typeof e === "string") {
    message = e;
  } else if (e && typeof e === "object" && "message" in e) {
    message = String(e.message);
  } else if (e && typeof e === "object" && "toString" in e && typeof e.toString === "function") {
    message = e.toString();
  } else {
    message = "Unknown error";
  }
  return new HttpError(500, message, null, uri);
};
