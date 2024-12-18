import { describe, expect, it } from "@jest/globals";
import { HttpClient } from "../src";
import { Err, Ok } from "monadyssey";
import { HttpError } from "../src/http-client.ts";

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
        "Request to https://api.example.com/items failed with status 500 and message Network Error"
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
        "Request to https://api.example.com/items failed with status 500 and message Unable to parse response body"
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
        "Request to https://api.example.com/items failed with status 500 and message Network Error"
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
        "Request to https://api.example.com/items failed with status 500 and message Unable to parse response body"
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
        "Request to https://api.example.com/items/1 failed with status 500 and message Network Error"
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
        "Request to https://api.example.com/items/1 failed with status 500 and message Unable to parse response body"
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
        "Request to https://api.example.com/items/1 failed with status 500 and message Network Error"
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
        "Request to https://api.example.com/items/1 failed with status 500 and message Unable to parse response body"
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
        "Request to https://api.example.com/items/1 failed with status 500 and message Network Error"
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
        "Request to https://api.example.com/items/1 failed with status 500 and message Unable to parse response body"
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
        "Request to https://api.example.com/items failed with status 500 and message Network Error"
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
        "Request to https://api.example.com/items failed with status 500 and message Unsupported response type: unsupported"
      );
      expect(err.status).toEqual(500);
    });

    it("should handle parsing errors gracefully", async () => {
      (global.fetch as jest.Mock).mockResolvedValue(
        mockResponse("Invalid JSON", { headers: { "Content-Type": "application/json" } })
      );

      const eff = await HttpClient.fetch("https://api.example.com/items", "GET", { responseType: "json" }).runAsync();
      expect(eff.type).toEqual("Err");

      const err = (eff as Err<HttpError>).error;
      expect(err.message).toEqual(
        "Request to https://api.example.com/items failed with status 500 and message Unable to parse response body"
      );
      expect(err.status).toEqual(500);
    });
  });
});
