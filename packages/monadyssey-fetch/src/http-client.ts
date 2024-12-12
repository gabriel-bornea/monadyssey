import { IO } from "monadyssey";

export type Observe = "body" | "response";
export type ResponseType = "json" | "text" | "blob" | "arrayBuffer" | "formData";
export type Credentials = "omit" | "same-origin" | "include";
export type Method = "GET" | "POST" | "PUT" | "PATCH" | "DELETE" | "OPTIONS" | "HEAD";
export type Options<A = any> = {
  headers?: Record<string, string>;
  body?: any;
  responseType?: ResponseType;
  credentials?: Credentials;
  observe?: Observe;
  type?: (data: any) => A;
};

export class HttpError extends Error {
  constructor(
    public readonly status: number,
    public readonly rawMessage: string,
    public readonly body: any,
    public readonly url: string
  ) {
    super(`Request to ${url} failed with status ${status} and message ${rawMessage}`);
    this.name = "HttpError";
  }
}

export class HttpClient {
  private constructor() {}

  static get = <A = any>(uri: string, options?: Omit<Options<A>, "body">) => HttpClient.fetch<A>(uri, "GET", options);

  static post = <A = any>(uri: string, body?: any, options?: Omit<Options<A>, "body">) =>
    HttpClient.fetch<A>(uri, "POST", { ...options, body });

  static put = <A = any>(uri: string, body?: any, options?: Omit<Options<A>, "body">) =>
    HttpClient.fetch<A>(uri, "PUT", { ...options, body });

  static patch = <A = any>(uri: string, body?: any, options?: Omit<Options<A>, "body">) =>
    HttpClient.fetch<A>(uri, "PATCH", { ...options, body });

  static delete = <A = any>(uri: string, options?: Omit<Options<A>, "body">) =>
    HttpClient.fetch<A>(uri, "DELETE", options);

  static fetch = <A = any>(uri: string, method: Method, options: Options<A> = {}): IO<HttpError, Response | A> =>
    IO.forM(async (bind) => {
      const {
        headers = {},
        body,
        responseType = "json",
        credentials = "include",
        observe = "body",
        type = (data: any) => data as A,
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

      const response = await bind(IO.of(() => fetch(uri, request)).mapError((e) => this._mapError(e, uri)));

      if (!response.ok) {
        const rb = await bind(HttpClient._parse(response, responseType, uri));
        return await bind(IO.failed(new HttpError(response.status, response.statusText, rb, uri)));
      }

      if (observe === "response") {
        return response;
      } else {
        const rb = await bind(HttpClient._parse(response, responseType, uri));
        return type(rb);
      }
    });

  private static _parse = (response: Response, responseType: ResponseType, url: string): IO<never, any> =>
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

  private static _mapError = (e: unknown, uri: string): HttpError => {
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
}
