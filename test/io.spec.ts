import { describe, expect, it } from "@jest/globals";
import { Err, IO, Ok } from "../src";

describe("IO", () => {
  describe("of", () => {
    it("should lazily lift an async operation into an IO", async () => {
      let executed = false;
      const effect = IO.of(async () => {
        executed = true;
        return "side-effecting operation";
      });

      expect(executed).toBe(false);
      await effect.runAsync();
      expect(executed).toBe(true);
    });

    it("should lazily lift a sync operation into an IO", async () => {
      let executed = false;
      const effect = IO.ofSync(() => {
        executed = true;
        return "side-effecting operation";
      });
      expect(executed).toBe(false);
      await effect.runAsync();
      expect(executed).toBe(true);
    });

    it("should handle potential error when lifting a value inside an IO", async () => {
      const result = await IO.ofSync(() => {
        throw new Error("Operation failed");
      }).runAsync();
      const error = (result as Err<Error>).error;
      expect(error.message).toBe("Operation failed");
    });

    it("should create a new IO that does nothing", async () => {
      const effect = IO.empty();
      expect(await effect.runAsync()).toEqual({ type: "Ok", value: undefined });
    });
  });

  describe("refine", () => {
    it("should refine the result of the async operation", async () => {
      const result = await IO.of(async () => 42)
        .refine(
          (value) => value === 42,
          () => "The expression was not evaluated to 42"
        )
        .runAsync();

      expect((result as Ok<number>).value).toBe(42);
    });

    it("should return an error if refine condition is not met", async () => {
      const result = await IO.of(async () => 42)
        .refine(
          (value) => value === 0,
          () => "The expression was not evaluated to 0"
        )
        .runAsync();
      const message = (result as Err<string>).error;

      expect(message).toBe("The expression was not evaluated to 0");
    });
  });

  describe("failed", () => {
    it("should fail the execution with given error", async () => {
      const result = await IO.failed(new Error("Error message")).runAsync();
      const message = (result as Err<Error>).error.message;
      expect(message).toBe("Error message");
    });
  });

  describe("recover", () => {
    it("should recover from an error condition using a provided function", async () => {
      const result = await IO.failed<Error, number>(new Error("original error"))
        .recover(() => IO.ofSync<Error, number>(() => 42).handleErrorWith(() => new Error("")))
        .runAsync();

      expect(result).toEqual({ type: "Ok", value: 42 });
    });

    it("should not modify the original result if no errors occur", async () => {
      const result = await IO.ofSync<string, string>(() => "original ok")
        .recover((error) => IO.ofSync<string, string>(() => `recovered from ${error}`))
        .runAsync();

      expect(result).toEqual({ type: "Ok", value: "original ok" });
    });
  });

  describe("tap", () => {
    const mock = jest.fn();

    beforeEach(() => {
      mock.mockClear();
    });

    it("should invoke the function with the result value and return the original result", async () => {
      const value = "mockValue";
      const effect = IO.ofSync(() => value);

      const result = await effect.tap(mock).runAsync();

      expect(mock).toHaveBeenCalledTimes(1);
      expect(mock).toHaveBeenCalledWith(value);
      expect((result as Ok<string>).value).toEqual(value);
    });

    it("should not invoke the function if the original result is an error", async () => {
      const error = "mockError";
      const effect = IO.failed(new Error(error));

      const result = await effect.tap(mock).runAsync();

      expect(mock).toHaveBeenCalledTimes(0);
      const message = (result as Err<Error>).error.message;
      expect(message).toEqual("mockError");
    });
  });

  describe("tapError", () => {
    const mock = jest.fn();

    beforeEach(() => {
      mock.mockClear();
    });

    it("should invoke the function if the result is an error", async () => {
      const error = "mockError";
      const effect = IO.failed(new Error(error));

      const result = await effect.tapError(mock).runAsync();

      expect(mock).toHaveBeenCalledTimes(1);
      const message = (result as Err<Error>).error.message;
      expect(message).toEqual("mockError");
    });

    it("should not invoke the function if the result is ok", async () => {
      const value = "mockValue";
      const effect = IO.ofSync(() => value);

      const result = await effect.tapError(mock).runAsync();

      expect(mock).toHaveBeenCalledTimes(0);
      expect((result as Ok<string>).value).toEqual(value);
    });
  });

  describe("fold", () => {
    it("should execute successful path", async () => {
      const onSuccess = (a: string): string => `Ok(${a})`;
      const onFailure = (e: Error): string => `Err(${e})`;

      const result = await IO.ofSync<Error, string>(() => "3")
        .handleErrorWith((error) => new Error("Error: " + error))
        .fold(onFailure, onSuccess);

      expect(result).toBe("Ok(3)");
    });

    it("should execute unsuccessful path", async () => {
      const onSuccess = (a: string): string => `Ok(${a})`;
      const onFailure = (e: Error): string => `Err(${e})`;

      const result = await IO.failed<Error, string>(new Error("Some unexpected error")).fold(onFailure, onSuccess);

      expect(result).toBe("Err(Error: Some unexpected error)");
    });
  });

  describe("getOrNull", () => {
    it("should return the successful value", async () => {
      const result = await IO.of(() => Promise.resolve("success")).getOrNull();
      expect(result).toEqual("success");
    });

    it("should return null for error", async () => {
      const result = await IO.of(() => Promise.reject("error")).getOrNull();
      expect(result).toBeNull();
    });

    it("should return null for null value", async () => {
      const result = await IO.of(() => Promise.resolve(null)).getOrNull();
      expect(result).toBeNull();
    });
  });

  describe("left identity, right identity and associativity", () => {
    it("should satisfy left identity", async () => {
      // IO.of(a).flatMap(f) = f(a)
      const a = 5;
      const f = (n: number) => IO.of(() => Promise.resolve(n * 2));

      const directApplication = await f(a).runAsync();
      const monadicApplication = await IO.of(() => Promise.resolve(a))
        .flatMap(f)
        .runAsync();

      expect(directApplication).toEqual(monadicApplication);
    });

    it("should satisfy right identity", async () => {
      // m.flatMap(IO.of) = m
      const m = IO.of(() => Promise.resolve(10));

      const monadicApplication = await m.flatMap((a) => IO.of(() => Promise.resolve(a))).runAsync();
      const originalMonad = await m.runAsync();

      expect(monadicApplication).toEqual(originalMonad);
    });

    it("should satisfy associativity", async () => {
      // m.flatMap(f).flatMap(g) = m.flatMap(x→f(x).flatMap(g))
      const m = IO.of(() => Promise.resolve(5));
      const f = (n: number) => IO.of(() => Promise.resolve(n + 10));
      const g = (n: number) => IO.of(() => Promise.resolve(n * 2));

      const leftSide = await m.flatMap(f).flatMap(g).runAsync();
      const rightSide = await m.flatMap((x) => f(x).flatMap(g)).runAsync();

      expect(leftSide).toEqual(rightSide);
    });
  });
});
