import { describe, expect, it } from "@jest/globals";
import { HttpClient, HttpError, HttpInterceptor } from "../src";
import { Err, Ok } from "monadyssey";

describe("HttpClient", () => {
  let client: HttpClient;

  beforeEach(() => {
    global.fetch = jest.fn();
    client = new HttpClient();
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  function ok(body: any): Promise<Response> {
    return Promise.resolve(
      new Response(JSON.stringify(body), { status: 200, headers: { "Content-Type": "application/json" } })
    );
  }

  function badRequest(body: any): Promise<Response> {
    return Promise.resolve(
      new Response(JSON.stringify(body), { status: 400, headers: { "Content-Type": "application/json" } })
    );
  }

  function textResponse(body: string): Promise<Response> {
    return Promise.resolve(new Response(body, { status: 200, headers: { "Content-Type": "text/plain" } }));
  }

  describe("constructor and default()", () => {
    it("should create a default instance", () => {
      const def = HttpClient.default();
      expect(def).toBeInstanceOf(HttpClient);
    });

    it("should create an instance with config", () => {
      const configured = new HttpClient({
        baseUrl: "https://api.example.com",
        defaultHeaders: { "x-api-key": "secret" },
        timeout: 5000,
        credentials: "omit",
      });
      expect(configured).toBeInstanceOf(HttpClient);
    });
  });

  describe("get", () => {
    it("should make a successful GET request and return the response body", async () => {
      const item = { id: 1, name: "Test Item" };
      (global.fetch as jest.Mock).mockResolvedValue(ok(item));

      const eff = await client.get<typeof item>("https://api.example.com/items").unsafeRun();
      expect(eff.type).toEqual("Ok");

      const result = eff as Ok<typeof item>;
      expect(result.value).toEqual(item);

      const args = (global.fetch as jest.Mock).mock.calls[0];
      expect(args[0]).toBe("https://api.example.com/items");
      expect(args[1].method).toBe("GET");
      expect(args[1].credentials).toBe("include");
      expect(args[1].body).toBeUndefined();
    });

    it("should handle errors gracefully", async () => {
      const error = { code: "INVALID_REQUEST", message: "Invalid request" };
      (global.fetch as jest.Mock).mockResolvedValue(badRequest(error));

      const eff = await client.get("https://api.example.com/items").unsafeRun();
      expect(eff.type).toEqual("Err");

      const err = (eff as Err<HttpError>).error;
      expect(err.status).toEqual(400);
      expect(err.body).toEqual(error);
      expect(err.url).toEqual("https://api.example.com/items");
    });

    it("should handle network errors gracefully", async () => {
      (global.fetch as jest.Mock).mockRejectedValue(new Error("Network Error"));

      const eff = await client.get("https://api.example.com/items").unsafeRun();
      expect(eff.type).toEqual("Err");

      const err = eff as Err<HttpError>;
      expect(err.error.message).toEqual(
        "Request to 'https://api.example.com/items' failed with status 500 and message: Network Error."
      );
    });

    it("should include custom headers in the request (lowercased)", async () => {
      const item = { id: 1, name: "Test Item" };
      (global.fetch as jest.Mock).mockResolvedValue(ok(item));

      const headers = { Authorization: "Bearer token" };
      await client.get<typeof item>("https://api.example.com/items", { headers }).unsafeRun();

      const args = (global.fetch as jest.Mock).mock.calls[0];
      expect(args[1].headers).toEqual({ authorization: "Bearer token" });
    });

    it("should handle non-JSON response", async () => {
      (global.fetch as jest.Mock).mockResolvedValue(textResponse("Plain text response"));

      const eff = await client.get<string>("https://api.example.com/items", { responseType: "text" }).unsafeRun();
      expect(eff.type).toEqual("Ok");

      const result = eff as Ok<string>;
      expect(result.value).toEqual("Plain text response");
    });

    it("should return the full response when observe is 'response'", async () => {
      const item = { id: 1, name: "Test Item" };
      (global.fetch as jest.Mock).mockResolvedValue(ok(item));

      const eff = await client.get("https://api.example.com/items", { observe: "response" }).unsafeRun();
      expect(eff.type).toEqual("Ok");

      const result = eff as Ok<Response>;
      expect(result.value.ok).toBe(true);
      expect(await result.value.json()).toEqual(item);
    });

    it("should handle empty response body (204 No Content)", async () => {
      (global.fetch as jest.Mock).mockResolvedValue(
        new Response(null, { status: 204, headers: { "Content-Type": "application/json" } })
      );

      const eff = await client.get("https://api.example.com/items").unsafeRun();
      expect(eff.type).toEqual("Ok");

      const result = eff as Ok<null>;
      expect(result.value).toBeNull();
    });

    it("should handle parsing errors gracefully", async () => {
      (global.fetch as jest.Mock).mockResolvedValue(
        new Response("Invalid JSON", { status: 200, headers: { "Content-Type": "application/json" } })
      );

      const eff = await client.get("https://api.example.com/items").unsafeRun();
      expect(eff.type).toEqual("Err");

      const err = (eff as Err<HttpError>).error;
      expect(err.message).toContain("Request to 'https://api.example.com/items' failed with status 200");
    });

    it("should handle request timeouts gracefully", async () => {
      (global.fetch as jest.Mock).mockImplementation(
        () => new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout")), 1000))
      );

      const eff = await client.get("https://api.example.com/items").unsafeRun();
      expect(eff.type).toEqual("Err");

      const err = (eff as Err<HttpError>).error;
      expect(err.message).toContain("Timeout");
    });

    it("should handle multiple errors from the same request gracefully", async () => {
      const errors = Array.of(
        { code: "ERR_1", message: "Invalid username" },
        { code: "ERR_2", message: "Invalid email" }
      );
      const error = { code: "ERR_0", errors: errors };

      (global.fetch as jest.Mock).mockResolvedValue(badRequest(error));

      const eff = await client.get("https://api.example.com/register").unsafeRun();
      expect(eff.type).toEqual("Err");

      const err = (eff as Err<HttpError>).error;
      expect(err.status).toEqual(400);
      expect(err.body).toEqual(error);
    });

    it("should include headers in the error response when parsing fails", async () => {
      const errorHeaders = new Headers({
        "X-Request-ID": "67890",
        "Content-Type": "application/json",
      });

      const fetchMock = global.fetch as jest.Mock;
      fetchMock.mockResolvedValue({
        ok: true,
        status: 200,
        statusText: "OK",
        headers: errorHeaders,
        json: jest.fn().mockRejectedValue(new SyntaxError("Unexpected token I in JSON")),
      });

      const eff = await client.get("https://api.example.com/items").unsafeRun();
      expect(eff.type).toEqual("Err");

      const httpError = (eff as Err<HttpError>).error;
      expect(httpError.status).toEqual(200);
      expect(httpError.rawMessage).toContain("Unexpected token I in JSON");
      expect(httpError.headers).toEqual({
        "x-request-id": "67890",
        "content-type": "application/json",
      });
    });

    it("should include headers in the error response for a failed request", async () => {
      const errorHeaders = new Headers({
        "X-Request-ID": "12345",
        "Content-Type": "application/json",
      });
      const errorBody = { error: "Invalid request" };

      const fetchMock = global.fetch as jest.Mock;
      fetchMock.mockResolvedValue({
        ok: false,
        status: 400,
        statusText: "Bad Request",
        headers: errorHeaders,
        json: jest.fn().mockResolvedValue(errorBody),
      });

      const eff = await client.get("https://api.example.com/items").unsafeRun();
      expect(eff.type).toEqual("Err");

      const httpError = (eff as Err<HttpError>).error;
      expect(httpError.status).toEqual(400);
      expect(httpError.rawMessage).toEqual("Bad Request");
      expect(httpError.headers).toEqual({
        "x-request-id": "12345",
        "content-type": "application/json",
      });
      expect(httpError.body).toEqual(errorBody);
    });
  });

  describe("post", () => {
    it("should make a successful POST request and return the response body", async () => {
      const item = { id: 1, name: "New Item" };
      (global.fetch as jest.Mock).mockResolvedValue(ok(item));

      const eff = await client.post<typeof item>("https://api.example.com/items", { name: "New Item" }).unsafeRun();
      expect(eff.type).toEqual("Ok");

      const result = eff as Ok<typeof item>;
      expect(result.value).toEqual(item);

      const args = (global.fetch as jest.Mock).mock.calls[0];
      expect(args[1].headers["content-type"]).toBe("application/json");
      expect(args[1].body).toBe(JSON.stringify({ name: "New Item" }));
    });

    it("should handle errors gracefully", async () => {
      const error = { code: "INVALID_REQUEST", message: "Invalid request" };
      (global.fetch as jest.Mock).mockResolvedValue(badRequest(error));

      const eff = await client.post("https://api.example.com/items", { name: "New Item" }).unsafeRun();
      expect(eff.type).toEqual("Err");

      const err = (eff as Err<HttpError>).error;
      expect(err.status).toEqual(400);
    });

    it("should handle network errors gracefully", async () => {
      (global.fetch as jest.Mock).mockRejectedValue(new Error("Network Error"));

      const eff = await client.post("https://api.example.com/items", { name: "New Item" }).unsafeRun();
      expect(eff.type).toEqual("Err");

      const err = (eff as Err<HttpError>).error;
      expect(err.message).toContain("Network Error");
    });

    it("should include custom headers in the request", async () => {
      const item = { id: 1, name: "New Item" };
      (global.fetch as jest.Mock).mockResolvedValue(ok(item));

      const headers = { Authorization: "Bearer token" };
      await client.post<typeof item>("https://api.example.com/items", { name: "New Item" }, { headers }).unsafeRun();

      const args = (global.fetch as jest.Mock).mock.calls[0];
      expect(args[1].headers["content-type"]).toBe("application/json");
      expect(args[1].headers["authorization"]).toBe("Bearer token");
    });

    it("should handle non-JSON response types", async () => {
      (global.fetch as jest.Mock).mockResolvedValue(textResponse("Plain text response"));

      const eff = await client
        .post<string>("https://api.example.com/items", { name: "New Item" }, { responseType: "text" })
        .unsafeRun();
      expect(eff.type).toEqual("Ok");

      const result = eff as Ok<string>;
      expect(result.value).toEqual("Plain text response");
    });

    it("should return the full response when observe is 'response'", async () => {
      const item = { id: 1, name: "New Item" };
      (global.fetch as jest.Mock).mockResolvedValue(ok(item));

      const eff = await client
        .post("https://api.example.com/items", { name: "New Item" }, { observe: "response" })
        .unsafeRun();
      expect(eff.type).toEqual("Ok");

      const result = eff as Ok<Response>;
      expect(result.value.ok).toBe(true);
    });

    it("should handle empty response body (204 No Content)", async () => {
      (global.fetch as jest.Mock).mockResolvedValue(new Response(null, { status: 204 }));

      const eff = await client.post("https://api.example.com/items").unsafeRun();
      expect(eff.type).toEqual("Ok");

      const result = eff as Ok<null>;
      expect(result.value).toBeNull();
    });

    it("should handle parsing errors gracefully", async () => {
      (global.fetch as jest.Mock).mockResolvedValue(
        new Response("Invalid JSON", { status: 200, headers: { "Content-Type": "application/json" } })
      );

      const eff = await client.post("https://api.example.com/items").unsafeRun();
      expect(eff.type).toEqual("Err");
    });

    it("should send a POST request with a custom Content-Type header", async () => {
      const formData = "name=NewItem";
      (global.fetch as jest.Mock).mockResolvedValue(ok({ success: true }));

      await client
        .post("https://api.example.com/items", formData, {
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
        })
        .unsafeRun();

      const args = (global.fetch as jest.Mock).mock.calls[0];
      expect(args[1].headers["content-type"]).toBe("application/x-www-form-urlencoded");
      expect(args[1].body).toBe(formData);
    });
  });

  describe("put", () => {
    it("should make a successful PUT request and return the response body", async () => {
      const item = { id: 1, name: "Updated Item" };
      (global.fetch as jest.Mock).mockResolvedValue(ok(item));

      const eff = await client
        .put<typeof item>("https://api.example.com/items/1", { name: "Updated Item" })
        .unsafeRun();
      expect(eff.type).toEqual("Ok");

      const result = eff as Ok<typeof item>;
      expect(result.value).toEqual(item);

      const args = (global.fetch as jest.Mock).mock.calls[0];
      expect(args[1].headers["content-type"]).toBe("application/json");
      expect(args[1].body).toBe(JSON.stringify({ name: "Updated Item" }));
    });

    it("should handle server errors (400 Bad Request) gracefully", async () => {
      const error = { code: "INVALID_REQUEST", message: "Invalid request" };
      (global.fetch as jest.Mock).mockResolvedValue(badRequest(error));

      const eff = await client.put("https://api.example.com/items/1", { name: "Invalid Item" }).unsafeRun();
      expect(eff.type).toEqual("Err");

      const err = (eff as Err<HttpError>).error;
      expect(err.status).toEqual(400);
    });

    it("should handle network errors gracefully", async () => {
      (global.fetch as jest.Mock).mockRejectedValue(new Error("Network Error"));

      const eff = await client.put("https://api.example.com/items/1", { name: "Updated Item" }).unsafeRun();
      expect(eff.type).toEqual("Err");
    });

    it("should include custom headers in the request", async () => {
      (global.fetch as jest.Mock).mockResolvedValue(ok({ id: 1 }));

      await client
        .put(
          "https://api.example.com/items/1",
          { name: "Updated Item" },
          { headers: { Authorization: "Bearer token" } }
        )
        .unsafeRun();

      const args = (global.fetch as jest.Mock).mock.calls[0];
      expect(args[1].headers["authorization"]).toBe("Bearer token");
      expect(args[1].headers["content-type"]).toBe("application/json");
    });

    it("should handle non-JSON response types", async () => {
      (global.fetch as jest.Mock).mockResolvedValue(textResponse("Plain text response"));

      const eff = await client
        .put<string>("https://api.example.com/items/1", { name: "Updated Item" }, { responseType: "text" })
        .unsafeRun();
      expect(eff.type).toEqual("Ok");

      const result = eff as Ok<string>;
      expect(result.value).toEqual("Plain text response");
    });

    it("should return the full response when observe is 'response'", async () => {
      (global.fetch as jest.Mock).mockResolvedValue(ok({ id: 1 }));

      const eff = await client
        .put("https://api.example.com/items/1", { name: "Updated Item" }, { observe: "response" })
        .unsafeRun();
      expect(eff.type).toEqual("Ok");

      const result = eff as Ok<Response>;
      expect(result.value.ok).toBe(true);
    });

    it("should handle empty response body (204 No Content)", async () => {
      (global.fetch as jest.Mock).mockResolvedValue(new Response(null, { status: 204 }));

      const eff = await client.put("https://api.example.com/items/1").unsafeRun();
      expect(eff.type).toEqual("Ok");
      expect((eff as Ok<null>).value).toBeNull();
    });

    it("should handle parsing errors gracefully", async () => {
      (global.fetch as jest.Mock).mockResolvedValue(
        new Response("Invalid JSON", { status: 200, headers: { "Content-Type": "application/json" } })
      );

      const eff = await client.put("https://api.example.com/items/1", { name: "Updated Item" }).unsafeRun();
      expect(eff.type).toEqual("Err");
    });
  });

  describe("patch", () => {
    it("should make a successful PATCH request and return the response body", async () => {
      const item = { id: 1, name: "Updated Item" };
      (global.fetch as jest.Mock).mockResolvedValue(ok(item));

      const eff = await client
        .patch<typeof item>("https://api.example.com/items/1", { name: "Updated Item" })
        .unsafeRun();
      expect(eff.type).toEqual("Ok");

      const result = eff as Ok<typeof item>;
      expect(result.value).toEqual(item);
    });

    it("should handle server errors gracefully", async () => {
      (global.fetch as jest.Mock).mockResolvedValue(badRequest({ code: "ERR" }));

      const eff = await client.patch("https://api.example.com/items/1", { name: "Invalid" }).unsafeRun();
      expect(eff.type).toEqual("Err");
      expect((eff as Err<HttpError>).error.status).toEqual(400);
    });

    it("should handle network errors gracefully", async () => {
      (global.fetch as jest.Mock).mockRejectedValue(new Error("Network Error"));

      const eff = await client.patch("https://api.example.com/items/1", { name: "Updated" }).unsafeRun();
      expect(eff.type).toEqual("Err");
    });

    it("should include custom headers", async () => {
      (global.fetch as jest.Mock).mockResolvedValue(ok({ id: 1 }));

      await client
        .patch("https://api.example.com/items/1", { name: "Updated" }, { headers: { Authorization: "Bearer token" } })
        .unsafeRun();

      const args = (global.fetch as jest.Mock).mock.calls[0];
      expect(args[1].headers["authorization"]).toBe("Bearer token");
    });

    it("should return the full response when observe is 'response'", async () => {
      (global.fetch as jest.Mock).mockResolvedValue(ok({ id: 1 }));

      const eff = await client
        .patch("https://api.example.com/items/1", { name: "Updated" }, { observe: "response" })
        .unsafeRun();
      const result = eff as Ok<Response>;
      expect(result.value.ok).toBe(true);
    });

    it("should handle empty response body (204 No Content)", async () => {
      (global.fetch as jest.Mock).mockResolvedValue(new Response(null, { status: 204 }));

      const eff = await client.patch("https://api.example.com/items/1").unsafeRun();
      expect((eff as Ok<null>).value).toBeNull();
    });
  });

  describe("delete", () => {
    it("should make a successful DELETE request and return the response body", async () => {
      const item = { id: 1, name: "Deleted Item" };
      (global.fetch as jest.Mock).mockResolvedValue(ok(item));

      const eff = await client.delete<typeof item>("https://api.example.com/items/1").unsafeRun();
      expect(eff.type).toEqual("Ok");

      const result = eff as Ok<typeof item>;
      expect(result.value).toEqual(item);

      const args = (global.fetch as jest.Mock).mock.calls[0];
      expect(args[1].method).toBe("DELETE");
      expect(args[1].body).toBeUndefined();
    });

    it("should handle server errors gracefully", async () => {
      (global.fetch as jest.Mock).mockResolvedValue(badRequest({ code: "ERR" }));

      const eff = await client.delete("https://api.example.com/items/1").unsafeRun();
      expect(eff.type).toEqual("Err");
      expect((eff as Err<HttpError>).error.status).toEqual(400);
    });

    it("should handle network errors gracefully", async () => {
      (global.fetch as jest.Mock).mockRejectedValue(new Error("Network Error"));

      const eff = await client.delete("https://api.example.com/items/1").unsafeRun();
      expect(eff.type).toEqual("Err");
    });

    it("should include custom headers", async () => {
      (global.fetch as jest.Mock).mockResolvedValue(ok({ id: 1 }));

      await client
        .delete("https://api.example.com/items/1", { headers: { Authorization: "Bearer token" } })
        .unsafeRun();

      const args = (global.fetch as jest.Mock).mock.calls[0];
      expect(args[1].headers["authorization"]).toBe("Bearer token");
    });

    it("should return the full response when observe is 'response'", async () => {
      (global.fetch as jest.Mock).mockResolvedValue(ok({ id: 1 }));

      const eff = await client.delete("https://api.example.com/items/1", { observe: "response" }).unsafeRun();
      const result = eff as Ok<Response>;
      expect(result.value.ok).toBe(true);
    });

    it("should handle empty response body (204 No Content)", async () => {
      (global.fetch as jest.Mock).mockResolvedValue(new Response(null, { status: 204 }));

      const eff = await client.delete("https://api.example.com/items/1").unsafeRun();
      expect((eff as Ok<null>).value).toBeNull();
    });
  });

  describe("fetch", () => {
    it("should make a custom HEAD request and return the full response", async () => {
      (global.fetch as jest.Mock).mockResolvedValue(new Response(null, { status: 200 }));

      const eff = await client.fetch("https://api.example.com/items", "HEAD", { observe: "response" }).unsafeRun();
      expect(eff.type).toEqual("Ok");

      const result = eff as Ok<Response>;
      expect(result.value.status).toBe(200);
    });

    it("should make a custom OPTIONS request and return the response body", async () => {
      const optionsResponse = { allowedMethods: ["GET", "POST"] };
      (global.fetch as jest.Mock).mockResolvedValue(ok(optionsResponse));

      const eff = await client.fetch<typeof optionsResponse>("https://api.example.com/items", "OPTIONS").unsafeRun();
      expect(eff.type).toEqual("Ok");

      const result = eff as Ok<typeof optionsResponse>;
      expect(result.value).toEqual(optionsResponse);
    });

    it("should handle errors gracefully", async () => {
      (global.fetch as jest.Mock).mockResolvedValue(badRequest({ code: "ERR" }));

      const eff = await client.fetch("https://api.example.com/items", "PATCH").unsafeRun();
      expect(eff.type).toEqual("Err");
    });

    it("should handle network errors gracefully", async () => {
      (global.fetch as jest.Mock).mockRejectedValue(new Error("Network Error"));

      const eff = await client.fetch("https://api.example.com/items", "PUT").unsafeRun();
      expect(eff.type).toEqual("Err");
    });

    it("should send custom headers", async () => {
      (global.fetch as jest.Mock).mockResolvedValue(ok({ success: true }));

      await client
        .fetch("https://api.example.com/items", "POST", {
          headers: { "Authorization": "Bearer token", "Content-Type": "application/json" },
          body: { name: "Custom Request" },
        })
        .unsafeRun();

      const args = (global.fetch as jest.Mock).mock.calls[0];
      expect(args[1].headers["authorization"]).toBe("Bearer token");
      expect(args[1].headers["content-type"]).toBe("application/json");
      expect(args[1].body).toBe(JSON.stringify({ name: "Custom Request" }));
    });

    it("should handle non-JSON response types", async () => {
      (global.fetch as jest.Mock).mockResolvedValue(textResponse("Plain text"));

      const eff = await client
        .fetch<string>("https://api.example.com/items", "GET", { responseType: "text" })
        .unsafeRun();
      expect((eff as Ok<string>).value).toEqual("Plain text");
    });
  });

  describe("response type", () => {
    function mockResponse(body: any, options: ResponseInit = {}): Promise<Response> {
      return Promise.resolve(new Response(body, { status: 200, ...options }));
    }

    it("should parse JSON response successfully", async () => {
      const data = { id: 1, name: "Test Item" };
      (global.fetch as jest.Mock).mockResolvedValue(
        mockResponse(JSON.stringify(data), { headers: { "Content-Type": "application/json" } })
      );

      const eff = await client
        .fetch<typeof data>("https://api.example.com/items", "GET", { responseType: "json" })
        .unsafeRun();
      expect((eff as Ok<typeof data>).value).toEqual(data);
    });

    it("should parse text response successfully", async () => {
      (global.fetch as jest.Mock).mockResolvedValue(
        mockResponse("Plain text", { headers: { "Content-Type": "text/plain" } })
      );

      const eff = await client
        .fetch<string>("https://api.example.com/items", "GET", { responseType: "text" })
        .unsafeRun();
      expect((eff as Ok<string>).value).toEqual("Plain text");
    });

    it("should parse blob response successfully", async () => {
      const blob = new Blob(["Hello, Blob!"], { type: "text/plain" });
      (global.fetch as jest.Mock).mockResolvedValue(mockResponse(blob));

      const eff = await client
        .fetch<Blob>("https://api.example.com/items", "GET", { responseType: "blob" })
        .unsafeRun();
      expect(eff.type).toEqual("Ok");
      const result = eff as Ok<Blob>;
      expect(result.value).toBeInstanceOf(Blob);
    });

    it("should parse arrayBuffer response successfully", async () => {
      const buffer = new Uint8Array([72, 101, 108, 108, 111]).buffer;
      (global.fetch as jest.Mock).mockResolvedValue(mockResponse(buffer));

      const eff = await client
        .fetch<ArrayBuffer>("https://api.example.com/items", "GET", { responseType: "arrayBuffer" })
        .unsafeRun();
      expect(eff.type).toEqual("Ok");
      const result = eff as Ok<ArrayBuffer>;
      expect(result.value).toBeInstanceOf(ArrayBuffer);
    });

    it("should parse formData response successfully", async () => {
      const formData = new FormData();
      formData.append("key", "value");
      (global.fetch as jest.Mock).mockResolvedValue(mockResponse(formData));

      const eff = await client
        .fetch<FormData>("https://api.example.com/items", "GET", { responseType: "formData" })
        .unsafeRun();
      expect(eff.type).toEqual("Ok");
      const result = eff as Ok<FormData>;
      expect(result.value.get("key")).toEqual("value");
    });

    it("should return an error for unsupported response types", async () => {
      (global.fetch as jest.Mock).mockResolvedValue(mockResponse("Unsupported"));

      const eff = await client
        .fetch("https://api.example.com/items", "GET", { responseType: "unsupported" as any })
        .unsafeRun();
      expect(eff.type).toEqual("Err");

      const err = (eff as Err<HttpError>).error;
      expect(err.message).toContain("Unsupported response type: unsupported");
    });

    it("should handle parsing errors gracefully", async () => {
      (global.fetch as jest.Mock).mockResolvedValue(
        mockResponse("Invalid JSON", { headers: { "Content-Type": "application/json" } })
      );

      const eff = await client.fetch("https://api.example.com/items", "GET", { responseType: "json" }).unsafeRun();
      expect(eff.type).toEqual("Err");
    });
  });

  describe("overload behavior", () => {
    it("should return the body by default", async () => {
      const data = { id: 1, name: "John" };
      (global.fetch as jest.Mock).mockResolvedValue(ok(data));

      const eff = await client.get<typeof data>("https://api.example.com/default").unsafeRun();
      expect(eff.type).toBe("Ok");
      expect((eff as Ok<typeof data>).value).toEqual(data);
    });

    it("should return the body when observe is explicitly 'body'", async () => {
      const data = { id: 2 };
      (global.fetch as jest.Mock).mockResolvedValue(ok(data));

      const eff = await client.get("https://api.example.com/body", { observe: "body" }).unsafeRun();
      expect((eff as Ok<typeof data>).value).toEqual(data);
    });

    it("should return the Response object when observe is 'response'", async () => {
      const data = { id: 3 };
      (global.fetch as jest.Mock).mockResolvedValue(ok(data));

      const eff = await client.get("https://api.example.com/response", { observe: "response" }).unsafeRun();
      expect(eff.type).toBe("Ok");
      expect((eff as Ok<Response>).value).toBeInstanceOf(Response);
    });
  });

  describe("interceptors", () => {
    it("should call a single interceptor and modify the request headers", async () => {
      class TestHeaderInterceptor implements HttpInterceptor {
        intercept(req: RequestInit, next: (r: RequestInit) => Promise<Response>): Promise<Response> {
          const newHeaders = new Headers(req.headers || {});
          newHeaders.set("X-Interceptor-Header", "test-value");
          return next({ ...req, headers: newHeaders });
        }
      }

      const interceptorClient = new HttpClient({ interceptors: [new TestHeaderInterceptor()] });
      (global.fetch as jest.Mock).mockResolvedValue(ok({ success: true }));

      const eff = await interceptorClient.get("https://api.example.com/test").unsafeRun();
      expect(eff.type).toBe("Ok");

      const args = (global.fetch as jest.Mock).mock.calls[0];
      expect(args[1].headers).toBeInstanceOf(Headers);
      expect((args[1].headers as Headers).get("X-Interceptor-Header")).toBe("test-value");
    });

    it("should allow an interceptor to short-circuit the request", async () => {
      class ShortCircuitInterceptor implements HttpInterceptor {
        intercept(_req: RequestInit, _next: (r: RequestInit) => Promise<Response>): Promise<Response> {
          return Promise.resolve(
            new Response(JSON.stringify({ message: "short-circuited" }), {
              status: 200,
              headers: { "Content-Type": "application/json" },
            })
          );
        }
      }

      const interceptorClient = new HttpClient({ interceptors: [new ShortCircuitInterceptor()] });

      const eff = await interceptorClient.get("https://api.example.com/shortcircuit").unsafeRun();
      expect(eff.type).toBe("Ok");
      expect((eff as Ok<any>).value).toEqual({ message: "short-circuited" });
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it("should call multiple interceptors in registration order (first = outermost)", async () => {
      const order: string[] = [];

      class FirstInterceptor implements HttpInterceptor {
        async intercept(req: RequestInit, next: (r: RequestInit) => Promise<Response>): Promise<Response> {
          order.push("first-before");
          const resp = await next(req);
          order.push("first-after");
          return resp;
        }
      }

      class SecondInterceptor implements HttpInterceptor {
        async intercept(req: RequestInit, next: (r: RequestInit) => Promise<Response>): Promise<Response> {
          order.push("second-before");
          const resp = await next(req);
          order.push("second-after");
          return resp;
        }
      }

      const interceptorClient = new HttpClient({
        interceptors: [new FirstInterceptor(), new SecondInterceptor()],
      });

      (global.fetch as jest.Mock).mockResolvedValue(ok({ success: true }));

      await interceptorClient.get("https://api.example.com/test").unsafeRun();

      expect(order).toEqual(["first-before", "second-before", "second-after", "first-after"]);
    });

    it("should allow an interceptor to handle an error thrown by fetch", async () => {
      class RetryInterceptor implements HttpInterceptor {
        private retried = false;

        async intercept(req: RequestInit, next: (r: RequestInit) => Promise<Response>): Promise<Response> {
          try {
            return await next(req);
          } catch (err) {
            if (!this.retried) {
              this.retried = true;
              return await next(req);
            }
            throw err;
          }
        }
      }

      const interceptorClient = new HttpClient({ interceptors: [new RetryInterceptor()] });

      (global.fetch as jest.Mock)
        .mockRejectedValueOnce(new Error("Network Error"))
        .mockResolvedValueOnce(ok({ success: true }));

      const eff = await interceptorClient.get("https://api.example.com/retry").unsafeRun();
      expect(eff.type).toBe("Ok");
      expect((eff as Ok<any>).value).toEqual({ success: true });
      expect(global.fetch).toHaveBeenCalledTimes(2);
    });

    it("should let the interceptor transform a successful Response", async () => {
      class TransformInterceptor implements HttpInterceptor {
        async intercept(req: RequestInit, next: (r: RequestInit) => Promise<Response>): Promise<Response> {
          const response = await next(req);
          const originalJson = await response.json();
          const newBody = JSON.stringify({ ...originalJson, addedByInterceptor: true });
          return new Response(newBody, { status: response.status, headers: response.headers });
        }
      }

      const interceptorClient = new HttpClient({ interceptors: [new TransformInterceptor()] });
      (global.fetch as jest.Mock).mockResolvedValue(ok({ name: "Original" }));

      const eff = await interceptorClient.get<any>("https://api.example.com/transform").unsafeRun();
      expect((eff as Ok<any>).value).toEqual({ name: "Original", addedByInterceptor: true });
    });

    it("should allow an interceptor to catch an error and replace it with a custom response", async () => {
      class HandleErrorInterceptor implements HttpInterceptor {
        async intercept(req: RequestInit, next: (r: RequestInit) => Promise<Response>): Promise<Response> {
          try {
            return await next(req);
          } catch {
            return new Response(JSON.stringify({ override: true }), {
              status: 200,
              headers: { "Content-Type": "application/json" },
            });
          }
        }
      }

      const interceptorClient = new HttpClient({ interceptors: [new HandleErrorInterceptor()] });
      (global.fetch as jest.Mock).mockRejectedValue(new Error("Network Error"));

      const eff = await interceptorClient.get<any>("https://api.example.com/override").unsafeRun();
      expect(eff.type).toEqual("Ok");
      expect((eff as Ok<any>).value).toEqual({ override: true });
    });

    it("should allow separate clients to have independent interceptors", async () => {
      class TagInterceptor implements HttpInterceptor {
        constructor(private tag: string) {}
        intercept(req: RequestInit, next: (r: RequestInit) => Promise<Response>): Promise<Response> {
          const newHeaders = new Headers(req.headers || {});
          newHeaders.set("X-Tag", this.tag);
          return next({ ...req, headers: newHeaders });
        }
      }

      const clientA = new HttpClient({ interceptors: [new TagInterceptor("A")] });
      const clientB = new HttpClient({ interceptors: [new TagInterceptor("B")] });

      (global.fetch as jest.Mock).mockResolvedValue(ok({ success: true }));

      await clientA.get("https://api.example.com/a").unsafeRun();
      await clientB.get("https://api.example.com/b").unsafeRun();

      const argsA = (global.fetch as jest.Mock).mock.calls[0];
      const argsB = (global.fetch as jest.Mock).mock.calls[1];

      expect((argsA[1].headers as Headers).get("X-Tag")).toBe("A");
      expect((argsB[1].headers as Headers).get("X-Tag")).toBe("B");
    });
  });

  describe("base URL", () => {
    it("should prepend baseUrl to relative paths", async () => {
      const baseClient = new HttpClient({ baseUrl: "https://api.example.com/v2" });
      (global.fetch as jest.Mock).mockResolvedValue(ok({ id: 1 }));

      await baseClient.get("/users").unsafeRun();

      const args = (global.fetch as jest.Mock).mock.calls[0];
      expect(args[0]).toBe("https://api.example.com/v2/users");
    });

    it("should prepend baseUrl to paths without leading slash", async () => {
      const baseClient = new HttpClient({ baseUrl: "https://api.example.com/v2" });
      (global.fetch as jest.Mock).mockResolvedValue(ok({ id: 1 }));

      await baseClient.get("users").unsafeRun();

      const args = (global.fetch as jest.Mock).mock.calls[0];
      expect(args[0]).toBe("https://api.example.com/v2/users");
    });

    it("should not prepend baseUrl to absolute URLs", async () => {
      const baseClient = new HttpClient({ baseUrl: "https://api.example.com" });
      (global.fetch as jest.Mock).mockResolvedValue(ok({ id: 1 }));

      await baseClient.get("https://other.example.com/data").unsafeRun();

      const args = (global.fetch as jest.Mock).mock.calls[0];
      expect(args[0]).toBe("https://other.example.com/data");
    });

    it("should handle baseUrl with trailing slash", async () => {
      const baseClient = new HttpClient({ baseUrl: "https://api.example.com/v2/" });
      (global.fetch as jest.Mock).mockResolvedValue(ok({ id: 1 }));

      await baseClient.get("/users").unsafeRun();

      const args = (global.fetch as jest.Mock).mock.calls[0];
      expect(args[0]).toBe("https://api.example.com/v2/users");
    });
  });

  describe("default headers", () => {
    it("should include default headers in every request", async () => {
      const headerClient = new HttpClient({ defaultHeaders: { "X-Api-Key": "secret123" } });
      (global.fetch as jest.Mock).mockResolvedValue(ok({ id: 1 }));

      await headerClient.get("https://api.example.com/items").unsafeRun();

      const args = (global.fetch as jest.Mock).mock.calls[0];
      expect(args[1].headers["x-api-key"]).toBe("secret123");
    });

    it("should allow per-request headers to override default headers", async () => {
      const headerClient = new HttpClient({ defaultHeaders: { "X-Api-Key": "default" } });
      (global.fetch as jest.Mock).mockResolvedValue(ok({ id: 1 }));

      await headerClient.get("https://api.example.com/items", { headers: { "X-Api-Key": "override" } }).unsafeRun();

      const args = (global.fetch as jest.Mock).mock.calls[0];
      expect(args[1].headers["x-api-key"]).toBe("override");
    });
  });

  describe("case-insensitive headers", () => {
    it("should allow lowercase content-type to override auto-detection", async () => {
      (global.fetch as jest.Mock).mockResolvedValue(ok({ success: true }));

      await client
        .post("https://api.example.com/items", { data: "test" }, { headers: { "content-type": "text/xml" } })
        .unsafeRun();

      const args = (global.fetch as jest.Mock).mock.calls[0];
      expect(args[1].headers["content-type"]).toBe("text/xml");
      // Should NOT also have a "Content-Type" key
      expect(Object.keys(args[1].headers).filter((k: string) => k.toLowerCase() === "content-type").length).toBe(1);
    });
  });

  describe("native body types (FormData, Blob, etc.)", () => {
    it("should not set Content-Type for FormData body", async () => {
      const formData = new FormData();
      formData.append("file", new Blob(["content"]), "test.txt");

      (global.fetch as jest.Mock).mockResolvedValue(ok({ success: true }));

      await client.post("https://api.example.com/upload", formData).unsafeRun();

      const args = (global.fetch as jest.Mock).mock.calls[0];
      // No content-type should be set — browser handles multipart boundary
      expect(args[1].headers["content-type"]).toBeUndefined();
      // Body should be the FormData, not JSON.stringified
      expect(args[1].body).toBe(formData);
    });

    it("should not JSON.stringify Blob body", async () => {
      const blob = new Blob(["binary content"], { type: "application/octet-stream" });

      (global.fetch as jest.Mock).mockResolvedValue(ok({ success: true }));

      await client.post("https://api.example.com/upload", blob).unsafeRun();

      const args = (global.fetch as jest.Mock).mock.calls[0];
      expect(args[1].body).toBe(blob);
    });

    it("should not JSON.stringify URLSearchParams body", async () => {
      const params = new URLSearchParams({ key: "value", foo: "bar" });

      (global.fetch as jest.Mock).mockResolvedValue(ok({ success: true }));

      await client.post("https://api.example.com/submit", params).unsafeRun();

      const args = (global.fetch as jest.Mock).mock.calls[0];
      expect(args[1].body).toBe(params);
    });

    it("should not JSON.stringify ArrayBuffer body", async () => {
      const buffer = new ArrayBuffer(8);

      (global.fetch as jest.Mock).mockResolvedValue(ok({ success: true }));

      await client.post("https://api.example.com/binary", buffer).unsafeRun();

      const args = (global.fetch as jest.Mock).mock.calls[0];
      expect(args[1].body).toBe(buffer);
    });
  });

  describe("credentials", () => {
    it("should use default credentials from config", async () => {
      const omitClient = new HttpClient({ credentials: "omit" });
      (global.fetch as jest.Mock).mockResolvedValue(ok({ id: 1 }));

      await omitClient.get("https://api.example.com/items").unsafeRun();

      const args = (global.fetch as jest.Mock).mock.calls[0];
      expect(args[1].credentials).toBe("omit");
    });

    it("should allow per-request credentials to override default", async () => {
      const omitClient = new HttpClient({ credentials: "omit" });
      (global.fetch as jest.Mock).mockResolvedValue(ok({ id: 1 }));

      await omitClient.get("https://api.example.com/items", { credentials: "include" }).unsafeRun();

      const args = (global.fetch as jest.Mock).mock.calls[0];
      expect(args[1].credentials).toBe("include");
    });
  });

  describe("cancellation", () => {
    it("should pass an AbortSignal to fetch", async () => {
      (global.fetch as jest.Mock).mockResolvedValue(ok({ id: 1 }));

      await client.get("https://api.example.com/items").unsafeRun();

      const args = (global.fetch as jest.Mock).mock.calls[0];
      expect(args[1].signal).toBeDefined();
      expect(args[1].signal).toBeInstanceOf(AbortSignal);
    });
  });

  describe("per-request timeout", () => {
    it("should abort the request when per-request timeout is exceeded", async () => {
      (global.fetch as jest.Mock).mockImplementation(
        (_url: string, init: RequestInit) =>
          new Promise((_resolve, reject) => {
            init.signal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")));
          })
      );

      const eff = await client.get("https://api.example.com/slow", { timeout: 50 }).unsafeRun();
      expect(eff.type).toEqual("Err");
    }, 5000);

    it("should use client-level timeout when no per-request timeout is set", async () => {
      const timeoutClient = new HttpClient({ timeout: 50 });

      (global.fetch as jest.Mock).mockImplementation(
        (_url: string, init: RequestInit) =>
          new Promise((_resolve, reject) => {
            init.signal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")));
          })
      );

      const eff = await timeoutClient.get("https://api.example.com/slow").unsafeRun();
      expect(eff.type).toEqual("Err");
    }, 5000);

    it("should succeed when the request completes before the timeout", async () => {
      (global.fetch as jest.Mock).mockResolvedValue(ok({ id: 1 }));

      const eff = await client.get("https://api.example.com/fast", { timeout: 5000 }).unsafeRun();
      expect(eff.type).toEqual("Ok");
      expect((eff as Ok<any>).value).toEqual({ id: 1 });
    });
  });
});
