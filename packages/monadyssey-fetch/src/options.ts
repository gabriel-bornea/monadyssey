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
 * - `"GET"`: Retrieve data from the server.
 * - `"POST"`: Submit data to be processed by the server.
 * - `"PUT"`: Update data on the server.
 * - `"PATCH"`: Partially update data on the server.
 * - `"DELETE"`: Delete data on the server.
 * - `"OPTIONS"`: Retrieve the communication options for a resource.
 * - `"HEAD"`: Retrieve headers without the response body.
 */
export type Method = "GET" | "POST" | "PUT" | "PATCH" | "DELETE" | "OPTIONS" | "HEAD";

/**
 * Options for configuring an HTTP request.
 *
 * @template A - The expected type of the response body after transformation.
 *
 * @property {Record<string, string>} [headers] - An object representing custom headers to include in the request.
 * @property {any} [body] - The request payload. If the payload is an object, it will be stringified as JSON by default.
 * @property {ResponseType} [responseType="json"] - The expected format of the response body.
 *   Can be one of `"json"`, `"text"`, `"blob"`, `"arrayBuffer"`, or `"formData"`.
 * @property {Credentials} [credentials="include"] - Indicates whether the request should include cookies or authentication headers.
 *   Can be `"omit"`, `"same-origin"`, or `"include"`.
 * @property {Observe} [observe="body"] - Specifies whether the full `Response` object or just the response body should be returned.
 *   Use `"response"` to get the full `Response` object or `"body"` to get the parsed body.
 * @property {(data: any) => A} [transform] - A function to transform the raw response body into the desired type `A`.
 */
export type Options<A = any> = {
  /** An object representing request headers as key-value pairs. */
  headers?: Record<string, string>;

  /** The request payload. Can be any type, typically an object or string. */
  body?: any;

  /** The expected type of the response body. Defaults to `"json"`. */
  responseType?: ResponseType;

  /** The credential policy for the request. Defaults to `"include"`. */
  credentials?: Credentials;

  /** Specifies how the response should be observed. Defaults to `"body"`. */
  observe?: Observe;

  /** A function to transform the response body into the desired type. */
  transform?: (data: any) => A;
};
