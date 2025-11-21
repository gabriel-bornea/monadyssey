import { describe, expect, it } from "@jest/globals";
import { HttpClient, HttpError, HttpInterceptor } from "../src";
import { Err, Ok } from "monadyssey";

describe("HttpClient", () => {
  beforeEach(() => {
    global.fetch = jest.fn();
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

  describe("get", () => {
    it("should make a successful GET request and return the response body", async () => {
      const item = { id: 1, name: "Test Item" };
      (global.fetch as jest.Mock).mockResolvedValue(ok(item));

      const eff = await HttpClient.get<typeof item>("https://api.example.com/items").runAsync();
      expect(eff.type).toEqual("Ok");

      const result = eff as Ok<typeof item>;

      expect(result.value).toEqual(item);
      expect(global.fetch).toHaveBeenCalledWith("https://api.example.com/items", {
        method: "GET",
        headers: {},
        credentials: "include",
        body: undefined,
      });
    });

    it("should handle errors gracefully", async () => {
      const error = { code: "INVALID_REQUEST", message: "Invalid request" };
      (global.fetch as jest.Mock).mockResolvedValue(badRequest(error));

      const eff = await HttpClient.get("https://api.example.com/items").runAsync();
      expect(eff.type).toEqual("Err");

      const err = (eff as Err<HttpError>).error;
      expect(err.status).toEqual(400);
      expect(err.body).toEqual(error);
      expect(err.url).toEqual("https://api.example.com/items");
    });

    it("should handle network errors gracefully", async () => {
      (fetch as jest.Mock).mockRejectedValue(new Error("Network Error"));

      const eff = await HttpClient.get("https://api.example.com/items").runAsync();
      expect(eff.type).toEqual("Err");

      const err = eff as Err<HttpError>;
      expect(err.error.message).toEqual(
        "Request to 'https://api.example.com/items' failed with status 500 and message: Network Error."
      );
    });

    it("should include custom headers in the request", async () => {
      const item = { id: 1, name: "Test Item" };
      (global.fetch as jest.Mock).mockResolvedValue(ok(item));

      const headers = { Authorization: "Bearer token" };
      await HttpClient.get<typeof item>("https://api.example.com/items", { headers }).runAsync();

      expect(global.fetch).toHaveBeenCalledWith("https://api.example.com/items", {
        method: "GET",
        headers: { Authorization: "Bearer token" },
        credentials: "include",
        body: undefined,
      });
    });

    it("should handle non-JSON response", async () => {
      (global.fetch as jest.Mock).mockResolvedValue(textResponse("Plain text response"));

      const eff = await HttpClient.get<string>("https://api.example.com/items", { responseType: "text" }).runAsync();
      expect(eff.type).toEqual("Ok");

      const result = eff as Ok<string>;
      expect(result.value).toEqual("Plain text response");
    });

    it("should return the full response when observe is 'response'", async () => {
      const item = { id: 1, name: "Test Item" };
      (global.fetch as jest.Mock).mockResolvedValue(ok(item));

      const eff = await HttpClient.get("https://api.example.com/items", { observe: "response" }).runAsync();
      expect(eff.type).toEqual("Ok");

      const result = eff as Ok<Response>;
      expect(result.value.ok).toBe(true);
      expect(await result.value.json()).toEqual(item);
    });

    it("should handle empty response body (204 No Content)", async () => {
      (global.fetch as jest.Mock).mockResolvedValue(
        new Response(null, { status: 204, headers: { "Content-Type": "application/json" } })
      );

      const eff = await HttpClient.get("https://api.example.com/items").runAsync();
      expect(eff.type).toEqual("Ok");

      const result = eff as Ok<null>;
      expect(result.value).toBeNull();
    });

    it("should handle parsing errors gracefully", async () => {
      (global.fetch as jest.Mock).mockResolvedValue(
        new Response("Invalid JSON", { status: 200, headers: { "Content-Type": "application/json" } })
      );

      const eff = await HttpClient.get("https://api.example.com/items").runAsync();
      expect(eff.type).toEqual("Err");

      const err = (eff as Err<HttpError>).error;
      expect(err.message).toEqual(
        "Request to 'https://api.example.com/items' failed with status 200 and message: Unexpected token 'I', \"Invalid JSON\" is not valid JSON."
      );
    });

    it("should handle request timeouts gracefully", async () => {
      (global.fetch as jest.Mock).mockImplementation(
        () => new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout")), 1000))
      );

      const eff = await HttpClient.get("https://api.example.com/items").runAsync();
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

      const eff = await HttpClient.get("https://api.example.com/register").runAsync();
      expect(eff.type).toEqual("Err");

      const err = (eff as Err<HttpError>).error;
      expect(err.status).toEqual(400);
      expect(err.body).toEqual(error);
      expect(err.url).toEqual("https://api.example.com/register");
    });

    it("should include headers in the error response when parsing fails", async () => {
      const errorHeaders = new Headers({
        "X-Request-ID": "67890",
        "Content-Type": "application/json",
      });

      const fetch = global.fetch as jest.Mock;

      fetch.mockResolvedValue({
        ok: true,
        status: 200,
        statusText: "OK",
        headers: errorHeaders,
        json: jest.fn().mockRejectedValue(new SyntaxError("Unexpected token I in JSON")),
      });

      const eff = await HttpClient.get("https://api.example.com/items").runAsync();
      expect(eff.type).toEqual("Err");

      const error = eff as Err<HttpError>;
      const httpError = error.error;

      expect(httpError.status).toEqual(200);
      expect(httpError.rawMessage).toContain("Unexpected token I in JSON");
      expect(httpError.headers).toEqual({
        "x-request-id": "67890",
        "content-type": "application/json",
      });

      expect(fetch).toHaveBeenCalledWith("https://api.example.com/items", {
        method: "GET",
        headers: {},
        credentials: "include",
        body: undefined,
      });
    });

    it("should include headers in the error response for a failed request", async () => {
      const errorHeaders = new Headers({
        "X-Request-ID": "12345",
        "Content-Type": "application/json",
      });
      const errorBody = { error: "Invalid request" };

      const fetch = global.fetch as jest.Mock;

      fetch.mockResolvedValue({
        ok: false,
        status: 400,
        statusText: "Bad Request",
        headers: errorHeaders,
        json: jest.fn().mockResolvedValue(errorBody),
      });

      const eff = await HttpClient.get("https://api.example.com/items").runAsync();
      expect(eff.type).toEqual("Err");

      const error = eff as Err<HttpError>;
      const httpError = error.error;

      expect(httpError.status).toEqual(400);
      expect(httpError.rawMessage).toEqual("Bad Request");
      expect(httpError.headers).toEqual({
        "x-request-id": "12345",
        "content-type": "application/json",
      });

      expect(httpError.body).toEqual(errorBody);

      expect(fetch).toHaveBeenCalledWith("https://api.example.com/items", {
        method: "GET",
        headers: {},
        credentials: "include",
        body: undefined,
      });
    });
  });

  describe("post", () => {
    it("should make a successful POST request and return the response body", async () => {
      const item = { id: 1, name: "New Item" };
      (global.fetch as jest.Mock).mockResolvedValue(ok(item));

      const eff = await HttpClient.post<typeof item>("https://api.example.com/items", { name: "New Item" }).runAsync();
      expect(eff.type).toEqual("Ok");

      const result = eff as Ok<typeof item>;
      expect(result.value).toEqual(item);
      expect(global.fetch).toHaveBeenCalledWith("https://api.example.com/items", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({ name: "New Item" }),
      });
    });

    it("should handle errors gracefully", async () => {
      const error = { code: "INVALID_REQUEST", message: "Invalid request" };
      (global.fetch as jest.Mock).mockResolvedValue(badRequest(error));

      const eff = await HttpClient.post("https://api.example.com/items", { name: "New Item" }).runAsync();
      expect(eff.type).toEqual("Err");

      const err = (eff as Err<HttpError>).error;
      expect(err.status).toEqual(400);
      expect(err.body).toEqual(error);
      expect(err.url).toEqual("https://api.example.com/items");
    });

    it("should handle network errors gracefully", async () => {
      (global.fetch as jest.Mock).mockRejectedValue(new Error("Network Error"));

      const eff = await HttpClient.post("https://api.example.com/items", { name: "New Item" }).runAsync();
      expect(eff.type).toEqual("Err");

      const err = (eff as Err<HttpError>).error;
      expect(err.message).toEqual(
        "Request to 'https://api.example.com/items' failed with status 500 and message: Network Error."
      );
    });

    it("should include custom headers in the request", async () => {
      const item = { id: 1, name: "New Item" };
      (global.fetch as jest.Mock).mockResolvedValue(ok(item));

      const headers = { Authorization: "Bearer token" };
      await HttpClient.post<typeof item>("https://api.example.com/items", { name: "New Item" }, { headers }).runAsync();

      expect(global.fetch).toHaveBeenCalledWith("https://api.example.com/items", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": "Bearer token",
        },
        credentials: "include",
        body: JSON.stringify({ name: "New Item" }),
      });
    });

    it("should handle non-JSON response types", async () => {
      (global.fetch as jest.Mock).mockResolvedValue(textResponse("Plain text response"));

      const eff = await HttpClient.post<string>(
        "https://api.example.com/items",
        { name: "New Item" },
        { responseType: "text" }
      ).runAsync();
      expect(eff.type).toEqual("Ok");

      const result = eff as Ok<string>;
      expect(result.value).toEqual("Plain text response");
    });

    it("should return the full response when observe is 'response'", async () => {
      const item = { id: 1, name: "New Item" };
      (global.fetch as jest.Mock).mockResolvedValue(ok(item));

      const eff = await HttpClient.post(
        "https://api.example.com/items",
        { name: "New Item" },
        { observe: "response" }
      ).runAsync();
      expect(eff.type).toEqual("Ok");

      const result = eff as Ok<Response>;
      expect(result.value.ok).toBe(true);
      expect(await result.value.json()).toEqual(item);
    });

    it("should handle empty response body (204 No Content)", async () => {
      (global.fetch as jest.Mock).mockResolvedValue(new Response(null, { status: 204 }));

      const eff = await HttpClient.post("https://api.example.com/items").runAsync();
      expect(eff.type).toEqual("Ok");

      const result = eff as Ok<null>;
      expect(result.value).toBeNull();
    });

    it("should handle parsing errors gracefully", async () => {
      (global.fetch as jest.Mock).mockResolvedValue(
        new Response("Invalid JSON", { status: 200, headers: { "Content-Type": "application/json" } })
      );

      const eff = await HttpClient.post("https://api.example.com/items").runAsync();
      expect(eff.type).toEqual("Err");

      const err = (eff as Err<HttpError>).error;
      expect(err.message).toEqual(
        "Request to 'https://api.example.com/items' failed with status 200 and message: Unexpected token 'I', \"Invalid JSON\" is not valid JSON."
      );
    });

    it("should send a POST request with a custom Content-Type header", async () => {
      const formData = "name=NewItem";
      (global.fetch as jest.Mock).mockResolvedValue(ok({ success: true }));

      await HttpClient.post("https://api.example.com/items", formData, {
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
      }).runAsync();

      expect(global.fetch).toHaveBeenCalledWith("https://api.example.com/items", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        credentials: "include",
        body: formData,
      });
    });
  });

  describe("put", () => {
    it("should make a successful PUT request and return the response body", async () => {
      const item = { id: 1, name: "Updated Item" };
      (global.fetch as jest.Mock).mockResolvedValue(ok(item));

      const eff = await HttpClient.put<typeof item>("https://api.example.com/items/1", {
        name: "Updated Item",
      }).runAsync();
      expect(eff.type).toEqual("Ok");

      const result = eff as Ok<typeof item>;
      expect(result.value).toEqual(item);
      expect(global.fetch).toHaveBeenCalledWith("https://api.example.com/items/1", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ name: "Updated Item" }),
      });
    });

    it("should handle server errors (400 Bad Request) gracefully", async () => {
      const error = { code: "INVALID_REQUEST", message: "Invalid request" };
      (global.fetch as jest.Mock).mockResolvedValue(badRequest(error));

      const eff = await HttpClient.put("https://api.example.com/items/1", { name: "Invalid Item" }).runAsync();
      expect(eff.type).toEqual("Err");

      const err = (eff as Err<HttpError>).error;
      expect(err.status).toEqual(400);
      expect(err.body).toEqual(error);
      expect(err.url).toEqual("https://api.example.com/items/1");
    });

    it("should handle network errors gracefully", async () => {
      (global.fetch as jest.Mock).mockRejectedValue(new Error("Network Error"));

      const eff = await HttpClient.put("https://api.example.com/items/1", { name: "Updated Item" }).runAsync();
      expect(eff.type).toEqual("Err");

      const err = (eff as Err<HttpError>).error;
      expect(err.message).toEqual(
        "Request to 'https://api.example.com/items/1' failed with status 500 and message: Network Error."
      );
    });

    it("should include custom headers in the request", async () => {
      const item = { id: 1, name: "Updated Item" };
      (global.fetch as jest.Mock).mockResolvedValue(ok(item));

      const headers = { Authorization: "Bearer token" };
      await HttpClient.put<typeof item>(
        "https://api.example.com/items/1",
        { name: "Updated Item" },
        { headers }
      ).runAsync();

      expect(global.fetch).toHaveBeenCalledWith("https://api.example.com/items/1", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "Authorization": "Bearer token",
        },
        credentials: "include",
        body: JSON.stringify({ name: "Updated Item" }),
      });
    });

    it("should handle non-JSON response types", async () => {
      (global.fetch as jest.Mock).mockResolvedValue(textResponse("Plain text response"));

      const eff = await HttpClient.put<string>(
        "https://api.example.com/items/1",
        { name: "Updated Item" },
        { responseType: "text" }
      ).runAsync();
      expect(eff.type).toEqual("Ok");

      const result = eff as Ok<string>;
      expect(result.value).toEqual("Plain text response");
    });

    it("should return the full response when observe is 'response'", async () => {
      const item = { id: 1, name: "Updated Item" };
      (global.fetch as jest.Mock).mockResolvedValue(ok(item));

      const eff = await HttpClient.put(
        "https://api.example.com/items/1",
        { name: "Updated Item" },
        { observe: "response" }
      ).runAsync();
      expect(eff.type).toEqual("Ok");

      const result = eff as Ok<Response>;
      expect(result.value.ok).toBe(true);
      expect(await result.value.json()).toEqual(item);
    });

    it("should handle empty response body (204 No Content)", async () => {
      (global.fetch as jest.Mock).mockResolvedValue(new Response(null, { status: 204 }));

      const eff = await HttpClient.put("https://api.example.com/items/1").runAsync();
      expect(eff.type).toEqual("Ok");

      const result = eff as Ok<null>;
      expect(result.value).toBeNull();
    });

    it("should handle parsing errors gracefully", async () => {
      (global.fetch as jest.Mock).mockResolvedValue(
        new Response("Invalid JSON", { status: 200, headers: { "Content-Type": "application/json" } })
      );

      const eff = await HttpClient.put("https://api.example.com/items/1", { name: "Updated Item" }).runAsync();
      expect(eff.type).toEqual("Err");

      const err = (eff as Err<HttpError>).error;
      expect(err.message).toEqual(
        "Request to 'https://api.example.com/items/1' failed with status 200 and message: Unexpected token 'I', \"Invalid JSON\" is not valid JSON."
      );
    });
  });

  describe("patch", () => {
    it("should make a successful PATCH request and return the response body", async () => {
      const item = { id: 1, name: "Updated Item" };
      (global.fetch as jest.Mock).mockResolvedValue(ok(item));

      const eff = await HttpClient.patch<typeof item>("https://api.example.com/items/1", {
        name: "Updated Item",
      }).runAsync();
      expect(eff.type).toEqual("Ok");

      const result = eff as Ok<typeof item>;
      expect(result.value).toEqual(item);
      expect(global.fetch).toHaveBeenCalledWith("https://api.example.com/items/1", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ name: "Updated Item" }),
      });
    });

    it("should handle server errors (400 Bad Request) gracefully", async () => {
      const error = { code: "INVALID_REQUEST", message: "Invalid request" };
      (global.fetch as jest.Mock).mockResolvedValue(badRequest(error));

      const eff = await HttpClient.patch("https://api.example.com/items/1", { name: "Invalid Item" }).runAsync();
      expect(eff.type).toEqual("Err");

      const err = (eff as Err<HttpError>).error;
      expect(err.status).toEqual(400);
      expect(err.body).toEqual(error);
      expect(err.url).toEqual("https://api.example.com/items/1");
    });

    it("should handle network errors gracefully", async () => {
      (global.fetch as jest.Mock).mockRejectedValue(new Error("Network Error"));

      const eff = await HttpClient.patch("https://api.example.com/items/1", { name: "Updated Item" }).runAsync();
      expect(eff.type).toEqual("Err");

      const err = (eff as Err<HttpError>).error;
      expect(err.message).toEqual(
        "Request to 'https://api.example.com/items/1' failed with status 500 and message: Network Error."
      );
    });

    it("should include custom headers in the request", async () => {
      const item = { id: 1, name: "Updated Item" };
      (global.fetch as jest.Mock).mockResolvedValue(ok(item));

      const headers = { Authorization: "Bearer token" };
      await HttpClient.patch<typeof item>(
        "https://api.example.com/items/1",
        { name: "Updated Item" },
        { headers }
      ).runAsync();

      expect(global.fetch).toHaveBeenCalledWith("https://api.example.com/items/1", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "Authorization": "Bearer token",
        },
        credentials: "include",
        body: JSON.stringify({ name: "Updated Item" }),
      });
    });

    it("should handle non-JSON response types", async () => {
      (global.fetch as jest.Mock).mockResolvedValue(textResponse("Plain text response"));

      const eff = await HttpClient.patch<string>(
        "https://api.example.com/items/1",
        { name: "Updated Item" },
        { responseType: "text" }
      ).runAsync();
      expect(eff.type).toEqual("Ok");

      const result = eff as Ok<string>;
      expect(result.value).toEqual("Plain text response");
    });

    it("should return the full response when observe is 'response'", async () => {
      const item = { id: 1, name: "Updated Item" };
      (global.fetch as jest.Mock).mockResolvedValue(ok(item));

      const eff = await HttpClient.patch(
        "https://api.example.com/items/1",
        { name: "Updated Item" },
        { observe: "response" }
      ).runAsync();
      expect(eff.type).toEqual("Ok");

      const result = eff as Ok<Response>;
      expect(result.value.ok).toBe(true);
      expect(await result.value.json()).toEqual(item);
    });

    it("should handle empty response body (204 No Content)", async () => {
      (global.fetch as jest.Mock).mockResolvedValue(new Response(null, { status: 204 }));

      const eff = await HttpClient.patch("https://api.example.com/items/1").runAsync();
      expect(eff.type).toEqual("Ok");

      const result = eff as Ok<null>;
      expect(result.value).toBeNull();
    });

    it("should handle parsing errors gracefully", async () => {
      (global.fetch as jest.Mock).mockResolvedValue(
        new Response("Invalid JSON", { status: 200, headers: { "Content-Type": "application/json" } })
      );

      const eff = await HttpClient.patch("https://api.example.com/items/1", { name: "Updated Item" }).runAsync();
      expect(eff.type).toEqual("Err");

      const err = (eff as Err<HttpError>).error;
      expect(err.message).toEqual(
        "Request to 'https://api.example.com/items/1' failed with status 200 and message: Unexpected token 'I', \"Invalid JSON\" is not valid JSON."
      );
    });
  });

  describe("delete", () => {
    it("should make a successful DELETE request and return the response body", async () => {
      const item = { id: 1, name: "Deleted Item" };
      (global.fetch as jest.Mock).mockResolvedValue(ok(item));

      const eff = await HttpClient.delete<typeof item>("https://api.example.com/items/1").runAsync();
      expect(eff.type).toEqual("Ok");

      const result = eff as Ok<typeof item>;
      expect(result.value).toEqual(item);
      expect(global.fetch).toHaveBeenCalledWith("https://api.example.com/items/1", {
        method: "DELETE",
        headers: {},
        credentials: "include",
        body: undefined,
      });
    });

    it("should handle server errors (400 Bad Request) gracefully", async () => {
      const error = { code: "INVALID_REQUEST", message: "Invalid request" };
      (global.fetch as jest.Mock).mockResolvedValue(badRequest(error));

      const eff = await HttpClient.delete("https://api.example.com/items/1").runAsync();
      expect(eff.type).toEqual("Err");

      const err = (eff as Err<HttpError>).error;
      expect(err.status).toEqual(400);
      expect(err.body).toEqual(error);
      expect(err.url).toEqual("https://api.example.com/items/1");
    });

    it("should handle network errors gracefully", async () => {
      (global.fetch as jest.Mock).mockRejectedValue(new Error("Network Error"));

      const eff = await HttpClient.delete("https://api.example.com/items/1").runAsync();
      expect(eff.type).toEqual("Err");

      const err = (eff as Err<HttpError>).error;
      expect(err.message).toEqual(
        "Request to 'https://api.example.com/items/1' failed with status 500 and message: Network Error."
      );
    });

    it("should include custom headers in the request", async () => {
      const item = { id: 1, name: "Deleted Item" };
      (global.fetch as jest.Mock).mockResolvedValue(ok(item));

      const headers = { Authorization: "Bearer token" };
      await HttpClient.delete<typeof item>("https://api.example.com/items/1", { headers }).runAsync();

      expect(global.fetch).toHaveBeenCalledWith("https://api.example.com/items/1", {
        method: "DELETE",
        headers: {
          Authorization: "Bearer token",
        },
        credentials: "include",
        body: undefined,
      });
    });

    it("should handle non-JSON response types", async () => {
      (global.fetch as jest.Mock).mockResolvedValue(textResponse("Plain text response"));

      const eff = await HttpClient.delete<string>("https://api.example.com/items/1", {
        responseType: "text",
      }).runAsync();
      expect(eff.type).toEqual("Ok");

      const result = eff as Ok<string>;
      expect(result.value).toEqual("Plain text response");
    });

    it("should return the full response when observe is 'response'", async () => {
      const item = { id: 1, name: "Deleted Item" };
      (global.fetch as jest.Mock).mockResolvedValue(ok(item));

      const eff = await HttpClient.delete("https://api.example.com/items/1", { observe: "response" }).runAsync();
      expect(eff.type).toEqual("Ok");

      const result = eff as Ok<Response>;
      expect(result.value.ok).toBe(true);
      expect(await result.value.json()).toEqual(item);
    });

    it("should handle empty response body (204 No Content)", async () => {
      (global.fetch as jest.Mock).mockResolvedValue(new Response(null, { status: 204 }));

      const eff = await HttpClient.delete("https://api.example.com/items/1").runAsync();
      expect(eff.type).toEqual("Ok");

      const result = eff as Ok<null>;
      expect(result.value).toBeNull();
    });

    it("should handle parsing errors gracefully", async () => {
      (global.fetch as jest.Mock).mockResolvedValue(
        new Response("Invalid JSON", { status: 200, headers: { "Content-Type": "application/json" } })
      );

      const eff = await HttpClient.delete("https://api.example.com/items/1").runAsync();
      expect(eff.type).toEqual("Err");

      const err = (eff as Err<HttpError>).error;
      expect(err.message).toEqual(
        "Request to 'https://api.example.com/items/1' failed with status 200 and message: Unexpected token 'I', \"Invalid JSON\" is not valid JSON."
      );
    });
  });

  describe("fetch", () => {
    it("should make a successful custom HTTP request (HEAD) and return the full response", async () => {
      (global.fetch as jest.Mock).mockResolvedValue(new Response(null, { status: 200 }));

      const eff = await HttpClient.fetch("https://api.example.com/items", "HEAD", { observe: "response" }).runAsync();
      expect(eff.type).toEqual("Ok");

      const result = eff as Ok<Response>;
      expect(result.value.ok).toBe(true);
      expect(result.value.status).toBe(200);
      expect(global.fetch).toHaveBeenCalledWith("https://api.example.com/items", {
        method: "HEAD",
        headers: {},
        credentials: "include",
        body: undefined,
      });
    });

    it("should make a successful custom HTTP request (OPTIONS) and return the response body", async () => {
      const optionsResponse = { allowedMethods: ["GET", "POST"] };
      (global.fetch as jest.Mock).mockResolvedValue(ok(optionsResponse));

      const eff = await HttpClient.fetch<typeof optionsResponse>("https://api.example.com/items", "OPTIONS").runAsync();
      expect(eff.type).toEqual("Ok");

      const result = eff as Ok<typeof optionsResponse>;
      expect(result.value).toEqual(optionsResponse);
      expect(global.fetch).toHaveBeenCalledWith("https://api.example.com/items", {
        method: "OPTIONS",
        headers: {},
        credentials: "include",
        body: undefined,
      });
    });

    it("should handle errors gracefully for a custom HTTP method (PATCH)", async () => {
      const error = { code: "INVALID_REQUEST", message: "Invalid request" };
      (global.fetch as jest.Mock).mockResolvedValue(badRequest(error));

      const eff = await HttpClient.fetch("https://api.example.com/items", "PATCH", {
        headers: { "Custom-Header": "value" },
      }).runAsync();
      expect(eff.type).toEqual("Err");

      const err = (eff as Err<HttpError>).error;
      expect(err.status).toEqual(400);
      expect(err.body).toEqual(error);
      expect(err.url).toEqual("https://api.example.com/items");
    });

    it("should handle network errors gracefully for a custom HTTP method (PUT)", async () => {
      (global.fetch as jest.Mock).mockRejectedValue(new Error("Network Error"));

      const eff = await HttpClient.fetch("https://api.example.com/items", "PUT").runAsync();
      expect(eff.type).toEqual("Err");

      const err = (eff as Err<HttpError>).error;
      expect(err.message).toEqual(
        "Request to 'https://api.example.com/items' failed with status 500 and message: Network Error."
      );
    });

    it("should send a custom request with custom headers", async () => {
      const item = { id: 1, name: "Custom Request" };
      (global.fetch as jest.Mock).mockResolvedValue(ok(item));

      await HttpClient.fetch<typeof item>("https://api.example.com/items", "POST", {
        headers: { "Authorization": "Bearer token", "Content-Type": "application/json" },
        body: { name: "Custom Request" },
      }).runAsync();

      expect(global.fetch).toHaveBeenCalledWith("https://api.example.com/items", {
        method: "POST",
        headers: {
          "Authorization": "Bearer token",
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({ name: "Custom Request" }),
      });
    });

    it("should handle non-JSON response types", async () => {
      (global.fetch as jest.Mock).mockResolvedValue(textResponse("Plain text response"));

      const eff = await HttpClient.fetch<string>("https://api.example.com/items", "GET", {
        responseType: "text",
      }).runAsync();
      expect(eff.type).toEqual("Ok");

      const result = eff as Ok<string>;
      expect(result.value).toEqual("Plain text response");
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

      const eff = await HttpClient.fetch<typeof data>("https://api.example.com/items", "GET", {
        responseType: "json",
      }).runAsync();
      expect(eff.type).toEqual("Ok");

      const result = eff as Ok<typeof data>;
      expect(result.value).toEqual(data);
    });

    it("should parse text response successfully", async () => {
      const text = "Plain text response";
      (global.fetch as jest.Mock).mockResolvedValue(mockResponse(text, { headers: { "Content-Type": "text/plain" } }));

      const eff = await HttpClient.fetch<string>("https://api.example.com/items", "GET", {
        responseType: "text",
      }).runAsync();
      expect(eff.type).toEqual("Ok");

      const result = eff as Ok<string>;
      expect(result.value).toEqual(text);
    });

    it("should parse blob response successfully", async () => {
      const blob = new Blob(["Hello, Blob!"], { type: "text/plain" });
      (global.fetch as jest.Mock).mockResolvedValue(mockResponse(blob));

      const eff = await HttpClient.fetch<Blob>("https://api.example.com/items", "GET", {
        responseType: "blob",
      }).runAsync();
      expect(eff.type).toEqual("Ok");

      const result = eff as Ok<Blob>;
      expect(result.value).toBeInstanceOf(Blob);
      const text = await result.value.text();
      expect(text).toEqual("Hello, Blob!");
    });

    it("should parse arrayBuffer response successfully", async () => {
      const buffer = new Uint8Array([72, 101, 108, 108, 111]).buffer; // "Hello" in bytes
      (global.fetch as jest.Mock).mockResolvedValue(mockResponse(buffer));

      const eff = await HttpClient.fetch<ArrayBuffer>("https://api.example.com/items", "GET", {
        responseType: "arrayBuffer",
      }).runAsync();
      expect(eff.type).toEqual("Ok");

      const result = eff as Ok<ArrayBuffer>;
      expect(result.value).toBeInstanceOf(ArrayBuffer);
      expect(new TextDecoder().decode(result.value)).toEqual("Hello");
    });

    it("should parse formData response successfully", async () => {
      const formData = new FormData();
      formData.append("key", "value");
      (global.fetch as jest.Mock).mockResolvedValue(mockResponse(formData));

      const eff = await HttpClient.fetch<FormData>("https://api.example.com/items", "GET", {
        responseType: "formData",
      }).runAsync();
      expect(eff.type).toEqual("Ok");

      const result = eff as Ok<FormData>;
      expect(result.value).toBeInstanceOf(FormData);
      expect(result.value.get("key")).toEqual("value");
    });

    it("should return an error for unsupported response types", async () => {
      (global.fetch as jest.Mock).mockResolvedValue(mockResponse("Unsupported response"));

      const eff = await HttpClient.fetch("https://api.example.com/items", "GET", {
        responseType: "unsupported" as any,
      }).runAsync();
      expect(eff.type).toEqual("Err");

      const err = (eff as Err<HttpError>).error;
      expect(err.message).toEqual(
        "Request to 'https://api.example.com/items' failed with status 200 and message: Unsupported response type: unsupported."
      );
      expect(err.status).toEqual(200);
    });

    it("should handle parsing errors gracefully", async () => {
      (global.fetch as jest.Mock).mockResolvedValue(
        mockResponse("Invalid JSON", { headers: { "Content-Type": "application/json" } })
      );

      const eff = await HttpClient.fetch("https://api.example.com/items", "GET", { responseType: "json" }).runAsync();
      expect(eff.type).toEqual("Err");

      const err = (eff as Err<HttpError>).error;
      expect(err.message).toEqual(
        "Request to 'https://api.example.com/items' failed with status 200 and message: Unexpected token 'I', \"Invalid JSON\" is not valid JSON."
      );
      expect(err.status).toEqual(200);
    });
  });

  describe("overload behavior", () => {
    it("should return the body by default", async () => {
      interface Data {
        id: number;
        name: string;
      }

      const data: Data = { id: 1, name: "John" };
      (global.fetch as jest.Mock).mockResolvedValue(ok(data));

      const eff = await HttpClient.get<Data>("https://api.example.com/default").runAsync();

      expect(eff.type).toBe("Ok");
      if (eff.type === "Ok") {
        expect(eff.value).toEqual(data);
        expect(eff.value instanceof Response).toBe(false);
      }
    });

    it("should return the body when observe is explicitly 'body'", async () => {
      const data = { id: 2 };
      (global.fetch as jest.Mock).mockResolvedValue(ok(data));

      const eff = await HttpClient.get("https://api.example.com/body", { observe: "body" }).runAsync();

      expect(eff.type).toBe("Ok");
      if (eff.type === "Ok") {
        expect(eff.value).toEqual(data);
        expect(eff.value instanceof Response).toBe(false);
      }
    });

    it("should return the Response object when observe is 'response'", async () => {
      const data = { id: 3 };
      (global.fetch as jest.Mock).mockResolvedValue(ok(data));

      const eff = await HttpClient.get("https://api.example.com/response", { observe: "response" }).runAsync();

      expect(eff.type).toBe("Ok");
      if (eff.type === "Ok") {
        expect(eff.value instanceof Response).toBe(true);
        const response = eff.value as Response;
        expect(await response.json()).toEqual(data);
      }
    });
  });

  describe("interceptors", () => {
    beforeEach(() => {
      global.fetch = jest.fn();
      jest.resetModules();
    });

    afterEach(() => {
      jest.resetAllMocks();
    });

    it("should call a single interceptor and modify the request headers", async () => {
      class TestHeaderInterceptor implements HttpInterceptor {
        intercept(req: RequestInit, next: (r: RequestInit) => Promise<Response>): Promise<Response> {
          const newHeaders = new Headers(req.headers || {});
          newHeaders.set("X-Interceptor-Header", "test-value");
          return next({ ...req, headers: newHeaders });
        }
      }

      const interceptor = new TestHeaderInterceptor();

      HttpClient.addInterceptor(interceptor);

      (global.fetch as jest.Mock).mockResolvedValue(ok({ success: true }));

      const eff = await HttpClient.get("https://api.example.com/test").runAsync();
      expect(eff.type).toBe("Ok");

      expect(global.fetch).toHaveBeenCalledTimes(1);

      const args = (global.fetch as jest.Mock).mock.calls[0];
      const url = args[0];
      const options = args[1];

      expect(url).toBe("https://api.example.com/test");
      expect(options.method).toBe("GET");
      expect(options.credentials).toBe("include");
      expect(options.body).toBeUndefined();

      expect(options.headers).toBeInstanceOf(Headers);
      expect((options.headers as Headers).get("X-Interceptor-Header")).toBe("test-value");

      HttpClient.removeInterceptor(interceptor);
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

      const interceptor = new ShortCircuitInterceptor();

      HttpClient.addInterceptor(interceptor);

      const eff = await HttpClient.get("https://api.example.com/shortcircuit").runAsync();
      expect(eff.type).toBe("Ok");

      const result = eff as Ok<any>;
      expect(result.value).toEqual({ message: "short-circuited" });

      expect(global.fetch).not.toHaveBeenCalled();

      HttpClient.removeInterceptor(interceptor);
    });

    it("should call multiple interceptors in reverse order of registration", async () => {
      class FirstInterceptor implements HttpInterceptor {
        intercept(req: RequestInit, next: (r: RequestInit) => Promise<Response>): Promise<Response> {
          const newHeaders = new Headers(req.headers || {});
          newHeaders.set("X-First", "1");
          return next({ ...req, headers: newHeaders });
        }
      }

      class SecondInterceptor implements HttpInterceptor {
        intercept(req: RequestInit, next: (r: RequestInit) => Promise<Response>): Promise<Response> {
          const newHeaders = new Headers(req.headers || {});
          newHeaders.set("X-Second", "2");
          return next({ ...req, headers: newHeaders });
        }
      }

      const firstInterceptor = new FirstInterceptor();
      const secondInterceptor = new SecondInterceptor();

      HttpClient.addInterceptor(firstInterceptor);
      HttpClient.addInterceptor(secondInterceptor);

      const fetch = global.fetch as jest.Mock;

      fetch.mockResolvedValue(ok({ success: true }));

      const eff = await HttpClient.get("https://api.example.com/test").runAsync();
      expect(eff.type).toBe("Ok");

      expect(fetch).toHaveBeenCalledTimes(1);

      const args = fetch.mock.calls[0];
      const url = args[0];
      const options = args[1];

      expect(url).toBe("https://api.example.com/test");
      expect(options.headers).toBeInstanceOf(Headers);

      const headers = options.headers as Headers;

      expect(headers.get("X-First")).toBe("1");
      expect(headers.get("X-Second")).toBe("2");

      HttpClient.removeInterceptor(firstInterceptor);
      HttpClient.removeInterceptor(secondInterceptor);
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

      const interceptor = new RetryInterceptor();

      HttpClient.addInterceptor(interceptor);

      (global.fetch as jest.Mock)
        .mockRejectedValueOnce(new Error("Network Error"))
        .mockResolvedValueOnce(ok({ success: true }));

      const eff = await HttpClient.get("https://api.example.com/retry").runAsync();
      expect(eff.type).toBe("Ok");

      const result = eff as Ok<any>;
      expect(result.value).toEqual({ success: true });

      expect(global.fetch).toHaveBeenCalledTimes(2);

      HttpClient.removeInterceptor(interceptor);
    });

    it("should let the interceptor transform a successful Response before returning", async () => {
      class TransformResponseInterceptor implements HttpInterceptor {
        async intercept(req: RequestInit, next: (r: RequestInit) => Promise<Response>): Promise<Response> {
          const response = await next(req);

          const originalJson = await response.json();
          const newBody = JSON.stringify({ ...originalJson, addedByInterceptor: true });
          return new Response(newBody, {
            status: response.status,
            headers: response.headers,
          });
        }
      }

      const interceptor = new TransformResponseInterceptor();

      HttpClient.addInterceptor(interceptor);

      (global.fetch as jest.Mock).mockResolvedValue(ok({ name: "Original" }));

      const eff = await HttpClient.get<any>("https://api.example.com/transform").runAsync();
      expect(eff.type).toEqual("Ok");

      const result = eff as Ok<any>;
      expect(result.value).toEqual({
        name: "Original",
        addedByInterceptor: true,
      });

      HttpClient.removeInterceptor(interceptor);
    });

    it("should allow an interceptor to catch an HTTP error and replace it with a custom response", async () => {
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

      const interceptor = new HandleErrorInterceptor();

      HttpClient.addInterceptor(interceptor);

      (global.fetch as jest.Mock).mockRejectedValue(new Error("Network Error"));

      const eff = await HttpClient.get<any>("https://api.example.com/override").runAsync();
      expect(eff.type).toEqual("Ok");

      const result = eff as Ok<any>;
      expect(result.value).toEqual({ override: true });
      expect(global.fetch).toHaveBeenCalledTimes(1);

      HttpClient.removeInterceptor(interceptor);
    });

    it("should not add the same interceptor multiple times", async () => {
      const header = "X-Duplicate-Count";
      class DuplicateInterceptor implements HttpInterceptor {
        intercept(req: RequestInit, next: (r: RequestInit) => Promise<Response>): Promise<Response> {
          const newHeaders = new Headers(req.headers || {});
          const count = newHeaders.get(header) || "0";
          newHeaders.set(header, (parseInt(count) + 1).toString());
          return next({ ...req, headers: newHeaders });
        }
      }

      const interceptor = new DuplicateInterceptor();

      HttpClient.addInterceptor(interceptor);
      HttpClient.addInterceptor(interceptor);

      type body = { success: boolean };

      const fetch = global.fetch as jest.Mock;
      fetch.mockResolvedValue(ok({ success: true }));

      const eff = await HttpClient.get<body>("https://api.example.com/test").runAsync();
      expect(eff.type).toBe("Ok");

      expect(fetch).toHaveBeenCalledTimes(1);

      const args = fetch.mock.calls[0];
      const options = args[1];

      expect(options.headers).toBeInstanceOf(Headers);
      const headers = options.headers as Headers;
      expect(headers.get(header)).toBe("1");

      HttpClient.removeInterceptor(interceptor);
    });
  });

  describe("interceptor chain", () => {
    let callCount = 0;
    class SelfNestingInterceptor implements HttpInterceptor {
      async intercept(req: RequestInit, next: (req: RequestInit) => Promise<Response>): Promise<Response> {
        callCount++;
        await HttpClient.get("https://api.example.com/nested").runAsync();
        return next(req);
      }
    }

    const interceptor = new SelfNestingInterceptor();

    beforeEach(() => {
      callCount = 0;
      jest.clearAllMocks();
      HttpClient.addInterceptor(interceptor);
      global.fetch = jest.fn().mockImplementation(() =>
        Promise.resolve(
          new Response(JSON.stringify({ success: true }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          })
        )
      );
    });

    afterEach(() => {
      HttpClient.removeInterceptor(interceptor);
    });

    it("should call the interceptor only once per outer request even with nested calls", async () => {
      const result = await HttpClient.get("https://api.example.com/test").runAsync();
      expect(result.type).toBe("Ok");
      expect(callCount).toBe(1);
      expect((global.fetch as jest.Mock).mock.calls.length).toBe(2);
    });
  });
});
