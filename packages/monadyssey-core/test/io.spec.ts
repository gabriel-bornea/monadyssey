import { describe, expect, it } from "@jest/globals";
import { Err, IO, NonEmptyList, Ok } from "../src";

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

    it("should transform the error using optional liftE", async () => {
      const result = await IO.of(
        async () => {
          throw new Error("Operation failed");
        },
        (e) => `Unexpected error: ${e}`
      ).runAsync();
      expect(IO.isErr(result)).toBe(true);
      expect((result as Err<string>).error).toBe("Unexpected error: Error: Operation failed");
    });

    it("should create a new IO that does nothing", async () => {
      const effect = IO.empty();
      expect(await effect.runAsync()).toEqual({ type: "Ok", value: undefined });
    });

    it("should create a new IO with identity", async () => {
      const effect = IO.identity(42);
      expect(await effect.runAsync()).toEqual({ type: "Ok", value: 42 });
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

  describe("map", () => {
    it("should transform the IO value", async () => {
      const effect = IO.ofSync(() => 3);
      const mapped = effect.map((num) => num * 2);

      expect(await mapped.runAsync()).toEqual({ type: "Ok", value: 6 });
    });

    it("should lazily execute the operation", async () => {
      let sideEffect = false;

      const effect = IO.ofSync(() => 3);
      const mapped = effect.map((num) => {
        sideEffect = true;
        return num * 2;
      });

      expect(sideEffect).toBe(false);
      await mapped.runAsync();
      expect(sideEffect).toBe(true);
    });

    it("should correctly work for large number of chained operations", async () => {
      const effect = IO.ofSync(() => 3);
      const mapped = effect
        .map((num) => num * 2)
        .map((num) => num * 3)
        .map((num) => num * 4)
        .map((num) => num * 5)
        .map((num) => num * 6)
        .map((num) => num * 7)
        .map((num) => num * 8);
      expect(await mapped.runAsync()).toEqual({ type: "Ok", value: 120960 });
    });
  });

  describe("mapError", () => {
    it("should transform the error value", async () => {
      const effect = IO.ofSync(() => {
        throw new Error("Operation failed");
      });
      const mappedError = effect.mapError((err) => err);
      const result = await mappedError.runAsync();

      expect(result.type).toEqual("Err");
    });

    it("should not map the error if result is Ok", async () => {
      let errorOccurred = false;
      const effect = IO.ofSync(() => 42).mapError((e) => {
        errorOccurred = true;
        return e;
      });

      const result = await effect.runAsync();

      expect(result.type).toEqual("Ok");
      expect(errorOccurred).toEqual(false);
    });
  });

  describe("mapNotNull", () => {
    it("should transform the value if not null", async () => {
      const effect = IO.ofSync(() => 42).mapNotNull((num) => num + 1);
      const result = await effect.runAsync();

      expect(result.type).toEqual("Ok");
      expect((result as Ok<number>).value).toEqual(43);
    });

    it("should not transform the value if null", async () => {
      const effect = IO.ofSync(() => null).mapNotNull((num) => num + 1);
      const result = await effect.runAsync();

      expect(result.type).toEqual("Ok");
      expect((result as Ok<number>).value).toEqual(null);
    });
  });

  describe("flatMap", () => {
    it("should successfully compose recursively without stack overflow", async () => {
      const rec = (n: number): IO<never, number> =>
        n === 0 ? IO.identity(0) : IO.identity(1).flatMap((x) => rec(n - 1).flatMap((y) => IO.ofSync(() => x + y)));

      const result = await rec(1_000).runAsync();
      expect(result.type).toEqual("Ok");
    });
  });

  describe("flatMapNotNull", () => {
    it("should combine if not null", async () => {
      const effect = IO.ofSync(() => 42).flatMapNotNull((num) => IO.ofSync(() => num + 1));
      const result = await effect.runAsync();

      expect(result.type).toEqual("Ok");
      expect((result as Ok<number>).value).toEqual(43);
    });

    it("should not combine if null", async () => {
      const effect = IO.ofSync(() => null).flatMapNotNull((num) => IO.ofSync(() => num + 1));
      const result = await effect.runAsync();

      expect(result.type).toEqual("Ok");
      expect((result as Ok<number>).value).toEqual(null);
    });
  });

  describe("zip", () => {
    it("should combine two IOs", async () => {
      const f1 = IO.ofSync(() => "effect one");
      const f2 = IO.ofSync(() => "effect two");

      const result = await IO.zip2(f1, f2).runAsync();

      expect(result.type).toEqual("Ok");
      expect((result as Ok<string[]>).value).toEqual(["effect one", "effect two"]);
    });

    it("should accumulate the errors if both IOs fail", async () => {
      const f1 = IO.failed(new Error("error one"));
      const f2 = IO.failed(new Error("error two"));

      const result = await IO.zip2(f1, f2).runAsync();
      expect(result.type).toEqual("Err");

      const errors = (result as Err<NonEmptyList<Error>>).error;
      expect(errors.size).toEqual(2);
    });

    it("should combine three IOs", async () => {
      const f1 = IO.ofSync(() => "effect one");
      const f2 = IO.ofSync(() => "effect two");
      const f3 = IO.ofSync(() => "effect three");

      const result = await IO.zip3(f1, f2, f3).runAsync();

      expect(result.type).toEqual("Ok");
      expect((result as Ok<string[]>).value).toEqual(["effect one", "effect two", "effect three"]);
    });

    it("should accumulate the errors if all IOs fail", async () => {
      const f1 = IO.failed(new Error("error one"));
      const f2 = IO.failed(new Error("error two"));
      const f3 = IO.failed(new Error("error three"));

      const result = await IO.zip3(f1, f2, f3).runAsync();
      expect(result.type).toEqual("Err");

      const errors = (result as Err<NonEmptyList<Error>>).error;
      expect(errors.size).toEqual(3);
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

  describe("getOrElse", () => {
    it("should return the successful value", async () => {
      const result = await IO.of(() => Promise.resolve("success")).getOrElse(() => "N/A");
      expect(result).toEqual("success");
    });

    it("should return defaultValue for error", async () => {
      const result = await IO.of<Error, string>(() => Promise.reject("error")).getOrElse(() => "N/A");
      expect(result).toEqual("N/A");
    });
  });

  describe("getOrHandle", () => {
    it("should return the successful value", async () => {
      const result = await IO.of(() => Promise.resolve("success")).getOrHandle(() => "N/A");
      expect(result).toEqual("success");
    });

    it("should return transformed error for error", async () => {
      const result = await IO.of<Error, string>(() => Promise.reject(Error("error"))).getOrHandle((e) => e.message);
      expect(result).toEqual("error");
    });
  });

  describe("handleErrorWith", () => {
    interface User {
      username: string;
      email: string;
    }

    class UserNotFoundError {
      message: string;

      constructor(message: string) {
        this.message = message;
      }
    }

    it("should handle the error raised", async () => {
      const effect = IO.ofSync(() => {
        throw new Error("Error message");
      }).handleErrorWith(() => "Error handled");

      const result = await effect.runAsync();

      expect(result.type).toEqual("Err");
      expect((result as Err<string>).error).toEqual("Error handled");
    });

    it("should handle the error raised and infer types correctly", async () => {
      const getUser = (username: string): User => {
        if (username === "u1") {
          return {
            username: "u1",
            email: "u1@example.com",
          };
        } else {
          throw new Error("User not found");
        }
      };

      const result = await IO.ofSync(() => getUser("u1"))
        .handleErrorWith(
          (e: unknown) => new UserNotFoundError(e instanceof Error ? e.message : "Failed to retrieve user")
        )
        .runAsync();

      switch (result.type) {
        case "Err":
          return fail();
        case "Ok":
          expect(result.value.email).toEqual("u1@example.com");
      }
    });

    it("should handle the error raised and infer types correctly in case of error", async () => {
      const getCurrentUser = (): User => {
        throw new Error("User not found");
      };

      const result = await IO.ofSync(() => getCurrentUser())
        .handleErrorWith(
          (e: unknown) => new UserNotFoundError(e instanceof Error ? e.message : "Failed to retrieve user")
        )
        .runAsync();

      switch (result.type) {
        case "Ok":
          return fail();
        case "Err":
          expect(result.error).toBeInstanceOf(UserNotFoundError);
      }
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

  describe("parZip", () => {
    test("should successfully execute in parallel two operations", async () => {
      const first = IO.ofSync(() => 1);
      const second = IO.ofSync(() => "second");

      await IO.parZip(first, second, (num, str): void => {
        expect(num).toBe(1);
        expect(str).toBe("second");
      }).runAsync();
    });

    test("should successfully execute in parallel three operations", async () => {
      const first = IO.ofSync(() => 1);
      const second = IO.ofSync(() => "second");
      const third = IO.ofSync(() => true);

      await IO.parZip(first, second, third, (num, str, bool) => {
        expect(num).toBe(1);
        expect(str).toBe("second");
        expect(bool).toBe(true);
      }).runAsync();
    });

    test("should accumulate errors when executing in parallel two operation", async () => {
      const first = IO.failed("error1");
      const second = IO.failed("error2");

      const result = await IO.parZip(first, second, (_num, _str) => fail()).runAsync();

      switch (result.type) {
        case "Ok":
          return fail();
        case "Err":
          expect(result.error.size).toBe(2);
      }
    });

    test("should accumulate errors when only some operations fail", async () => {
      const first = IO.ofSync(() => 1);
      const second = IO.failed("error2");
      const third = IO.ofSync(() => 3);
      const fourth = IO.failed("error4");

      const result = await IO.parZip(first, second, third, fourth, (_num1, _str1, _num2, _str2) => fail()).runAsync();

      switch (result.type) {
        case "Ok":
          return fail();
        case "Err":
          expect(result.error.size).toBe(2);
      }
    });

    test("should map the result of the operations in the callback", async () => {
      const first = IO.ofSync(() => 1);
      const second = IO.ofSync(() => "2");

      const result = await IO.parZip(first, second, (num, str) => `${num}, ${str}`).runAsync();

      switch (result.type) {
        case "Err":
          return fail();
        case "Ok":
          expect(result.value).toBe("1, 2");
      }
    });
  });

  describe("forM", () => {
    it("should bind multiple operations", async () => {
      const result = await IO.forM(async (bind) => {
        const one = await bind(IO.ofSync(() => 1));
        const two = await bind(IO.ofSync(() => 2));
        const three = await bind(IO.ofSync(() => 3));

        return one + two + three;
      }).runAsync();

      expect(IO.isOk(result)).toBe(true);
      expect((result as Ok<number>).value).toBe(6);
    });

    it("should short-circuit the computation on error", async () => {
      const result = await IO.forM(async (bind) => {
        const one = await bind(IO.ofSync(() => 1));
        await bind(IO.failed("fail"));
        const two = await bind(IO.ofSync(() => 2));

        return one + two;
      }).runAsync();

      switch (result.type) {
        case "Err":
          expect(result.error).toBe("fail");
          break;
        case "Ok":
          fail("Operation should not be successful");
      }
    });

    it("should execute the operation lazy", async () => {
      let sharedState = 0;

      const effectOne = IO.ofSync(() => {
        sharedState += 1;
        return sharedState;
      });

      const effectTwo = IO.ofSync(() => {
        sharedState += 2;
        return sharedState;
      });

      const effect = IO.forM(async (bind) => {
        const one = await bind(effectOne);
        const two = await bind(effectTwo);

        return one + two;
      });

      expect(sharedState).toBe(0);

      const result = await effect.getOrNull();

      expect(sharedState).toBe(3);
      expect(result).toBe(4);
    });

    it("should fail with the user defined error", async () => {
      class BusinessError {
        public readonly message: string;

        public constructor(message: string) {
          this.message = message;
        }
      }

      const effOne: IO<BusinessError, number> = IO.ofSync(() => 1);
      const effTwo = (value: number): IO<BusinessError, number> => {
        if (value < 1) {
          return IO.failed(new BusinessError("Something went wrong"));
        } else {
          return IO.ofSync(() => 2);
        }
      };

      const eff = await IO.forM<BusinessError, number>(async (bind) => {
        const one = await bind(effOne);
        const two = await bind(effTwo(0));

        return one + two;
      }).runAsync();

      switch (eff.type) {
        case "Ok":
          expect(eff.value).toBe(-1);
          break;
        case "Err":
          expect(eff.error.message).toBe("Something went wrong");
          break;
      }
    });
  });
});
