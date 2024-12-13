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
  });
});
