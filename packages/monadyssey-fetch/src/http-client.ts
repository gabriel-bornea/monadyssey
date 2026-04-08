import { IO } from "monadyssey";
import { Credentials, HttpClientConfig, HttpInterceptor, Method, Options, ResponseType } from "./options";

/**
 * Returns `true` if the body is a type that the fetch API knows how to send natively.
 * These types must NOT be JSON.stringified and must NOT have a Content-Type header auto-set
 * (the browser handles multipart boundaries for FormData, etc.).
 */
const isNativeBody = (body: unknown): boolean =>
  typeof body !== "object" ||
  body === null ||
  body instanceof FormData ||
  body instanceof Blob ||
  body instanceof ArrayBuffer ||
  body instanceof URLSearchParams ||
  (typeof ReadableStream !== "undefined" && body instanceof ReadableStream) ||
  ArrayBuffer.isView(body);

/**
 * Normalizes header keys to lowercase for case-insensitive comparison.
 * HTTP header names are case-insensitive per RFC 7230.
 */
const normalizeHeaders = (headers: Record<string, string>): Record<string, string> => {
  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(headers)) {
    if (value !== undefined) {
      result[key.toLowerCase()] = value;
    }
  }
  return result;
};

/**
 * Builds the interceptor chain as a pure function. No global state.
 * Interceptors are applied in registration order — first registered is outermost.
 */
const runInterceptors = (
  interceptors: readonly HttpInterceptor[],
  req: RequestInit,
  fn: (req: RequestInit) => Promise<Response>
): Promise<Response> => {
  let next = fn;
  for (const interceptor of [...interceptors].reverse()) {
    const currentNext = next;
    next = (r: RequestInit) => interceptor.intercept(r, currentNext);
  }
  return next(req);
};

const parseBody = async (response: Response, responseType: ResponseType, url: string): Promise<any> => {
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
        throw toHttpError(`Unsupported response type: ${responseType}`, url, response);
    }
  } catch (e: unknown) {
    if (e instanceof HttpError) throw e;
    throw toHttpError(e, url, response);
  }
};

const toHttpError = (e: unknown, uri: string, response?: Response): HttpError => {
  const headers = extractHeadersFrom(response);
  const body = response ? response.body : null;

  const message =
    e instanceof Error
      ? e.message
      : typeof e === "string"
        ? e
        : typeof e === "object" && e !== null && "message" in e
          ? String((e as any).message)
          : "An unknown error occurred.";

  return new HttpError(response?.status || 500, message, body, uri, headers);
};

const extractHeadersFrom = (response?: Response): Record<string, string> => {
  if (!response) return {};
  try {
    return Object.fromEntries(response.headers.entries());
  } catch {
    return {};
  }
};

/**
 * A composable HTTP client that wraps the native `fetch` API, returning `IO` instances instead of Promises.
 *
 * Unlike v1, `HttpClient` is instantiable — each instance carries its own configuration (base URL,
 * interceptors, default headers, timeout, credentials). This allows different parts of an application
 * to use independently configured clients.
 *
 * All HTTP methods return `IO<HttpError, T>`, enabling lazy execution, functional composition,
 * and explicit error handling. Cancellation is supported: when an IO is cancelled (via fiber or
 * timeout), the underlying `fetch` call is aborted through `AbortSignal`.
 *
 * @example
 * const api = new HttpClient({
 *   baseUrl: "https://api.example.com",
 *   interceptors: [authInterceptor],
 *   defaultHeaders: { "Accept": "application/json" },
 *   timeout: 5000,
 * });
 *
 * const users = api.get<User[]>("/users");
 */
export class HttpClient {
  private readonly interceptors: readonly HttpInterceptor[];
  private readonly baseUrl: string | undefined;
  private readonly defaultHeaders: Record<string, string>;
  private readonly defaultTimeout: number | undefined;
  private readonly defaultCredentials: Credentials;

  /**
   * Creates a new HttpClient with the given configuration.
   *
   * @param {HttpClientConfig} config - Configuration for the client.
   */
  constructor(config: HttpClientConfig = {}) {
    this.interceptors = Object.freeze([...(config.interceptors ?? [])]);
    this.baseUrl = config.baseUrl;
    this.defaultHeaders = config.defaultHeaders ?? {};
    this.defaultTimeout = config.timeout;
    this.defaultCredentials = config.credentials ?? "include";
  }

  /**
   * Creates a default HttpClient instance with no base URL, no interceptors, and default settings.
   *
   * @returns {HttpClient} A new default HttpClient.
   */
  static default(): HttpClient {
    return new HttpClient();
  }

  /**
   * Performs a GET request.
   *
   * @template A - The expected type of the response body.
   * @param {string} uri - The URL or path to request.
   * @param {Omit<Options<A>, "body">} [options] - Request options (excluding body).
   * @returns {IO<HttpError, A | null>} An IO representing the result.
   */
  get(uri: string, options: Omit<Options, "body"> & { observe: "response" }): IO<HttpError, Response>;
  get<A = any>(uri: string, options?: Omit<Options<A>, "body">): IO<HttpError, A | null>;
  get<A = any>(uri: string, options?: Omit<Options<A>, "body">): IO<HttpError, Response | A | null> {
    return this.request<A>(uri, "GET", options);
  }

  /**
   * Performs a POST request.
   *
   * @template A - The expected type of the response body.
   * @param {string} uri - The URL or path to request.
   * @param {any} [body] - The request payload.
   * @param {Options<A>} [options] - Request options.
   * @returns {IO<HttpError, A | null>} An IO representing the result.
   */
  post(uri: string, body: any, options: Options & { observe: "response" }): IO<HttpError, Response>;
  post<A = any>(uri: string, body?: any, options?: Options<A>): IO<HttpError, A | null>;
  post<A = any>(uri: string, body?: any, options?: Options<A>): IO<HttpError, Response | A | null> {
    return this.request<A>(uri, "POST", { ...options, body });
  }

  /**
   * Performs a PUT request.
   *
   * @template A - The expected type of the response body.
   * @param {string} uri - The URL or path to request.
   * @param {any} [body] - The request payload.
   * @param {Options<A>} [options] - Request options.
   * @returns {IO<HttpError, A | null>} An IO representing the result.
   */
  put(uri: string, body: any, options: Options & { observe: "response" }): IO<HttpError, Response>;
  put<A = any>(uri: string, body?: any, options?: Options<A>): IO<HttpError, A | null>;
  put<A = any>(uri: string, body?: any, options?: Options<A>): IO<HttpError, Response | A | null> {
    return this.request<A>(uri, "PUT", { ...options, body });
  }

  /**
   * Performs a PATCH request.
   *
   * @template A - The expected type of the response body.
   * @param {string} uri - The URL or path to request.
   * @param {any} [body] - The request payload.
   * @param {Options<A>} [options] - Request options.
   * @returns {IO<HttpError, A | null>} An IO representing the result.
   */
  patch(uri: string, body: any, options: Options & { observe: "response" }): IO<HttpError, Response>;
  patch<A = any>(uri: string, body?: any, options?: Options<A>): IO<HttpError, A | null>;
  patch<A = any>(uri: string, body?: any, options?: Options<A>): IO<HttpError, Response | A | null> {
    return this.request<A>(uri, "PATCH", { ...options, body });
  }

  /**
   * Performs a DELETE request.
   *
   * @template A - The expected type of the response body.
   * @param {string} uri - The URL or path to request.
   * @param {Omit<Options<A>, "body">} [options] - Request options (excluding body).
   * @returns {IO<HttpError, A | null>} An IO representing the result.
   */
  delete(uri: string, options: Omit<Options, "body"> & { observe: "response" }): IO<HttpError, Response>;
  delete<A = any>(uri: string, options?: Omit<Options<A>, "body">): IO<HttpError, A | null>;
  delete<A = any>(uri: string, options?: Omit<Options<A>, "body">): IO<HttpError, Response | A | null> {
    return this.request<A>(uri, "DELETE", options);
  }

  /**
   * Performs a custom HTTP request with the specified method.
   *
   * @template A - The expected type of the response body.
   * @param {string} uri - The URL or path to request.
   * @param {Method} method - The HTTP method.
   * @param {Options<A>} [options] - Request options.
   * @returns {IO<HttpError, A | null>} An IO representing the result.
   */
  fetch(uri: string, method: Method, options: Options & { observe: "response" }): IO<HttpError, Response>;
  fetch<A = any>(uri: string, method: Method, options?: Options<A>): IO<HttpError, A | null>;
  fetch<A = any>(uri: string, method: Method, options: Options<A> = {}): IO<HttpError, Response | A | null> {
    return this.request<A>(uri, method, options);
  }

  private resolveUrl(uri: string): string {
    if (!this.baseUrl) return uri;
    try {
      new URL(uri);
      return uri;
    } catch {
      const base = this.baseUrl.endsWith("/") ? this.baseUrl.slice(0, -1) : this.baseUrl;
      const path = uri.startsWith("/") ? uri : `/${uri}`;
      return `${base}${path}`;
    }
  }

  private request<A = any>(uri: string, method: Method, options: Options<A> = {}): IO<HttpError, Response | A | null> {
    const resolvedUrl = this.resolveUrl(uri);
    const timeout = options.timeout ?? this.defaultTimeout;

    return IO.cancellable<HttpError, Response | A | null>(
      async (signal: AbortSignal) => {
        const {
          headers = {},
          body,
          responseType = "json",
          credentials = this.defaultCredentials,
          observe = "body",
          transform = (data: any) => data as A,
        } = options;

        // Merge default headers + per-request headers, all lowercased
        const mergedHeaders = normalizeHeaders({ ...this.defaultHeaders, ...headers });

        // Auto-detect Content-Type only for plain objects (not FormData, Blob, etc.)
        const shouldAutoJson =
          body != null && typeof body === "object" && !isNativeBody(body) && !("content-type" in mergedHeaders);

        if (shouldAutoJson) {
          mergedHeaders["content-type"] = "application/json";
        }

        // For FormData, do NOT set Content-Type — the browser sets the multipart boundary
        if (body instanceof FormData) {
          delete mergedHeaders["content-type"];
        }

        // Serialize body
        const serializedBody =
          method === "GET" || method === "HEAD" || body == null
            ? undefined
            : isNativeBody(body)
              ? body
              : mergedHeaders["content-type"] === "application/json"
                ? JSON.stringify(body)
                : body;

        // Timeout support: create a child controller that aborts on timeout or parent signal
        let controller: AbortController | undefined;
        let timeoutId: ReturnType<typeof setTimeout> | undefined;

        const fetchSignal = (() => {
          if (timeout != null) {
            controller = new AbortController();
            const onParentAbort = () => controller!.abort(signal.reason);
            signal.addEventListener("abort", onParentAbort, { once: true });
            timeoutId = setTimeout(
              () => controller!.abort(new DOMException("Request timed out", "TimeoutError")),
              timeout
            );
            return controller.signal;
          }
          return signal;
        })();

        try {
          const requestInit: RequestInit = {
            method,
            headers: mergedHeaders,
            credentials,
            body: serializedBody as BodyInit | undefined,
            signal: fetchSignal,
          };

          const response = await runInterceptors(this.interceptors, requestInit, (req) => fetch(resolvedUrl, req));

          if (!response.ok) {
            const rb = await parseBody(response, responseType, resolvedUrl);
            const respHeaders = extractHeadersFrom(response);
            throw new HttpError(response.status, response.statusText, rb, resolvedUrl, respHeaders);
          }

          if (observe === "response") {
            return response;
          }

          const rb = await parseBody(response, responseType, resolvedUrl);
          return transform(rb);
        } finally {
          if (timeoutId != null) clearTimeout(timeoutId);
        }
      },
      (e: unknown) => (e instanceof HttpError ? e : toHttpError(e, resolvedUrl))
    );
  }
}

/**
 * Represents an HTTP error encountered during a request.
 *
 * Extends the native `Error` class with additional context: HTTP status code,
 * raw error message, response body, request URL, and response headers.
 */
export class HttpError extends Error {
  public readonly status: number;
  public readonly rawMessage: string;
  public readonly body: any;
  public readonly url: string;
  public readonly headers?: Record<string, string>;

  constructor(status: number, rawMessage: string, body: any, url: string, headers?: Record<string, string>) {
    super(`Request to '${url}' failed with status ${status} and message: ${rawMessage}.`);
    this.name = "HttpError";
    this.status = status;
    this.rawMessage = rawMessage;
    this.body = body;
    this.url = url;
    this.headers = headers;
  }
}
