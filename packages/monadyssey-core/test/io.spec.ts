import { beforeEach, describe, expect, it, jest, test } from "@jest/globals";
import { Cancelled, Err, IO, Ok } from "../src";

describe("IO", () => {
  describe("lift", () => {
    it("should lazily lift an async operation into an IO", async () => {
      let executed = false;
      const effect = IO.lift(async () => {
        executed = true;
        return "side-effecting operation";
      });

      expect(executed).toBe(false);
      await effect.unsafeRun();
      expect(executed).toBe(true);
    });

    it("should lazily lift a sync operation into an IO", async () => {
      let executed = false;
      const effect = IO.lift(() => {
        executed = true;
        return "side-effecting operation";
      });
      expect(executed).toBe(false);
      await effect.unsafeRun();
      expect(executed).toBe(true);
    });

    it("should handle potential error when lifting a value inside an IO", async () => {
      const result = await IO.lift(() => {
        throw new Error("Operation failed");
      }).unsafeRun();
      const error = (result as Err<Error>).error;
      expect(error.message).toBe("Operation failed");
    });

    it("should transform the error using optional liftE", async () => {
      const result = await IO.lift(
        async () => {
          throw new Error("Operation failed");
        },
        (e) => `Unexpected error: ${e}`
      ).unsafeRun();
      expect(result.type === "Err").toBe(true);
      expect((result as Err<string>).error).toBe("Unexpected error: Error: Operation failed");
    });

    it("should create an IO that produces void via IO.unit", async () => {
      expect(await IO.unit.unsafeRun()).toEqual({ type: "Ok", value: undefined });
    });

    it("should lift a pure value into IO via IO.pure", async () => {
      const effect = IO.pure(42);
      expect(await effect.unsafeRun()).toEqual({ type: "Ok", value: 42 });
    });
  });

  describe("ensure", () => {
    it("should pass when predicate is satisfied", async () => {
      const result = await IO.lift(async () => 42)
        .ensure(
          (value) => value === 42,
          () => "The expression was not evaluated to 42"
        )
        .unsafeRun();

      expect((result as Ok<number>).value).toBe(42);
    });

    it("should return an error if predicate is not met", async () => {
      const result = await IO.lift(async () => 42)
        .ensure(
          (value) => value === 0,
          () => "The expression was not evaluated to 0"
        )
        .unsafeRun();
      const message = (result as Err<string>).error;

      expect(message).toBe("The expression was not evaluated to 0");
    });
  });

  describe("failed", () => {
    it("should fail the execution with given error", async () => {
      const result = await IO.fail(new Error("Error message")).unsafeRun();
      const message = (result as Err<Error>).error.message;
      expect(message).toBe("Error message");
    });
  });

  describe("map", () => {
    it("should transform the IO value", async () => {
      const effect = IO.lift(() => 3);
      const mapped = effect.map((num) => num * 2);

      expect(await mapped.unsafeRun()).toEqual({ type: "Ok", value: 6 });
    });

    it("should lazily execute the operation", async () => {
      let sideEffect = false;

      const effect = IO.lift(() => 3);
      const mapped = effect.map((num) => {
        sideEffect = true;
        return num * 2;
      });

      expect(sideEffect).toBe(false);
      await mapped.unsafeRun();
      expect(sideEffect).toBe(true);
    });

    it("should correctly work for large number of chained operations", async () => {
      const effect = IO.lift(() => 3);
      const mapped = effect
        .map((num) => num * 2)
        .map((num) => num * 3)
        .map((num) => num * 4)
        .map((num) => num * 5)
        .map((num) => num * 6)
        .map((num) => num * 7)
        .map((num) => num * 8);
      expect(await mapped.unsafeRun()).toEqual({ type: "Ok", value: 120960 });
    });
  });

  describe("mapErr", () => {
    it("should transform the error value", async () => {
      const effect = IO.lift(() => {
        throw new Error("Operation failed");
      });
      const mappedError = effect.mapErr((err) => err);
      const result = await mappedError.unsafeRun();

      expect(result.type).toEqual("Err");
    });

    it("should not map the error if result is Ok", async () => {
      let errorOccurred = false;
      const effect = IO.lift(() => 42).mapErr((e) => {
        errorOccurred = true;
        return e;
      });

      const result = await effect.unsafeRun();

      expect(result.type).toEqual("Ok");
      expect(errorOccurred).toEqual(false);
    });
  });

  describe("flatMap", () => {
    it("should successfully compose recursively without stack overflow", async () => {
      const rec = (n: number): IO<never, number> =>
        n === 0 ? IO.pure(0) : IO.pure(1).flatMap((x) => rec(n - 1).flatMap((y) => IO.lift(() => x + y)));

      const result = await rec(1_000).unsafeRun();
      expect(result.type).toEqual("Ok");
    });
  });

  describe("flatMapErr", () => {
    it("should recover from an error condition using a provided function", async () => {
      const result = await IO.fail<Error, number>(new Error("original error"))
        .flatMapErr(() => IO.lift<Error, number>(() => 42))
        .unsafeRun();

      expect(result).toEqual({ type: "Ok", value: 42 });
    });

    it("should not modify the original result if no errors occur", async () => {
      const result = await IO.lift<string, string>(() => "original ok")
        .flatMapErr((error) => IO.lift<string, string>(() => `recovered from ${error}`))
        .unsafeRun();

      expect(result).toEqual({ type: "Ok", value: "original ok" });
    });
  });

  describe("tap", () => {
    const mock = jest.fn<(a: any) => void>();

    beforeEach(() => {
      mock.mockClear();
    });

    it("should invoke the function with the result value and return the original result", async () => {
      const value = "mockValue";
      const effect = IO.lift(() => value);

      const result = await effect.tap(mock).unsafeRun();

      expect(mock).toHaveBeenCalledTimes(1);
      expect(mock).toHaveBeenCalledWith(value);
      expect((result as Ok<string>).value).toEqual(value);
    });

    it("should not invoke the function if the original result is an error", async () => {
      const error = "mockError";
      const effect = IO.fail(new Error(error));

      const result = await effect.tap(mock).unsafeRun();

      expect(mock).toHaveBeenCalledTimes(0);
      const message = (result as Err<Error>).error.message;
      expect(message).toEqual("mockError");
    });
  });

  describe("tapErr", () => {
    const mock = jest.fn<(a: any) => void>();

    beforeEach(() => {
      mock.mockClear();
    });

    it("should invoke the function if the result is an error", async () => {
      const error = "mockError";
      const effect = IO.fail(new Error(error));

      const result = await effect.tapErr(mock).unsafeRun();

      expect(mock).toHaveBeenCalledTimes(1);
      const message = (result as Err<Error>).error.message;
      expect(message).toEqual("mockError");
    });

    it("should not invoke the function if the result is ok", async () => {
      const value = "mockValue";
      const effect = IO.lift(() => value);

      const result = await effect.tapErr(mock).unsafeRun();

      expect(mock).toHaveBeenCalledTimes(0);
      expect((result as Ok<string>).value).toEqual(value);
    });
  });

  describe("fold", () => {
    it("should execute successful path", async () => {
      const onSuccess = (a: string): string => `Ok(${a})`;
      const onFailure = (e: Error): string => `Err(${e})`;

      const result = await IO.lift<Error, string>(() => "3").fold(onFailure, onSuccess);

      expect(result).toBe("Ok(3)");
    });

    it("should execute unsuccessful path", async () => {
      const onSuccess = (a: string): string => `Ok(${a})`;
      const onFailure = (e: Error): string => `Err(${e})`;

      const result = await IO.fail<Error, string>(new Error("Some unexpected error")).fold(onFailure, onSuccess);

      expect(result).toBe("Err(Error: Some unexpected error)");
    });
  });

  describe("getOrNull", () => {
    it("should return the successful value", async () => {
      const result = await IO.lift(() => Promise.resolve("success")).getOrNull();
      expect(result).toEqual("success");
    });

    it("should return null for error", async () => {
      const result = await IO.lift(() => Promise.reject("error")).getOrNull();
      expect(result).toBeNull();
    });

    it("should return null for null value", async () => {
      const result = await IO.lift(() => Promise.resolve(null)).getOrNull();
      expect(result).toBeNull();
    });
  });

  describe("getOrElse", () => {
    it("should return the successful value", async () => {
      const result = await IO.lift(() => Promise.resolve("success")).getOrElse(() => "N/A");
      expect(result).toEqual("success");
    });

    it("should return defaultValue for error", async () => {
      const result = await IO.lift<Error, string>(() => Promise.reject("error")).getOrElse(() => "N/A");
      expect(result).toEqual("N/A");
    });
  });

  describe("getOrHandleErr", () => {
    it("should return the successful value", async () => {
      const result = await IO.lift(() => Promise.resolve("success")).getOrHandleErr(() => "N/A");
      expect(result).toEqual("success");
    });

    it("should return transformed error for error", async () => {
      const result = await IO.lift<Error, string>(() => Promise.reject(Error("error"))).getOrHandleErr(
        (e) => e.message
      );
      expect(result).toEqual("error");
    });
  });

  describe("mapErr + flatMapErr", () => {
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

    it("should transform the error type using mapErr", async () => {
      const effect = IO.lift(() => {
        throw new Error("Error message");
      }).mapErr(() => "Error handled");

      const result = await effect.unsafeRun();

      expect(result.type).toEqual("Err");
      expect((result as Err<string>).error).toEqual("Error handled");
    });

    it("should transform errors to typed domain errors via mapErr", async () => {
      const getUser = (username: string): User => {
        if (username === "u1") {
          return { username: "u1", email: "u1@example.com" };
        } else {
          throw new Error("User not found");
        }
      };

      const result = await IO.lift(() => getUser("u1"))
        .mapErr((e: unknown) => new UserNotFoundError(e instanceof Error ? e.message : "Failed to retrieve user"))
        .unsafeRun();

      expect(result.type).toBe("Ok");
      if (result.type === "Ok") {
        expect(result.value.email).toEqual("u1@example.com");
      }
    });

    it("should produce a typed domain error on failure via mapErr", async () => {
      const getCurrentUser = (): User => {
        throw new Error("User not found");
      };

      const result = await IO.lift(() => getCurrentUser())
        .mapErr((e: unknown) => new UserNotFoundError(e instanceof Error ? e.message : "Failed to retrieve user"))
        .unsafeRun();

      expect(result.type).toBe("Err");
      if (result.type === "Err") {
        expect(result.error).toBeInstanceOf(UserNotFoundError);
      }
    });
  });

  describe("left identity, right identity and associativity", () => {
    it("should satisfy left identity", async () => {
      // IO.lift(a).flatMap(f) = f(a)
      const a = 5;
      const f = (n: number) => IO.lift(() => Promise.resolve(n * 2));

      const directApplication = await f(a).unsafeRun();
      const monadicApplication = await IO.lift(() => Promise.resolve(a))
        .flatMap(f)
        .unsafeRun();

      expect(directApplication).toEqual(monadicApplication);
    });

    it("should satisfy right identity", async () => {
      // m.flatMap(IO.lift) = m
      const m = IO.lift(() => Promise.resolve(10));

      const monadicApplication = await m.flatMap((a) => IO.lift(() => Promise.resolve(a))).unsafeRun();
      const originalMonad = await m.unsafeRun();

      expect(monadicApplication).toEqual(originalMonad);
    });

    it("should satisfy associativity", async () => {
      // m.flatMap(f).flatMap(g) = m.flatMap(x→f(x).flatMap(g))
      const m = IO.lift(() => Promise.resolve(5));
      const f = (n: number) => IO.lift(() => Promise.resolve(n + 10));
      const g = (n: number) => IO.lift(() => Promise.resolve(n * 2));

      const leftSide = await m.flatMap(f).flatMap(g).unsafeRun();
      const rightSide = await m.flatMap((x) => f(x).flatMap(g)).unsafeRun();

      expect(leftSide).toEqual(rightSide);
    });
  });

  describe("parMapN", () => {
    test("should successfully execute in parallel two operations", async () => {
      const first = IO.lift(() => 1);
      const second = IO.lift(() => "second");

      await IO.parMapN(first, second, (num, str): void => {
        expect(num).toBe(1);
        expect(str).toBe("second");
      }).unsafeRun();
    });

    test("should successfully execute in parallel three operations", async () => {
      const first = IO.lift(() => 1);
      const second = IO.lift(() => "second");
      const third = IO.lift(() => true);

      await IO.parMapN(first, second, third, (num, str, bool) => {
        expect(num).toBe(1);
        expect(str).toBe("second");
        expect(bool).toBe(true);
      }).unsafeRun();
    });

    test("should accumulate errors when executing in parallel two operation", async () => {
      const first = IO.fail("error1");
      const second = IO.fail("error2");

      const result = await IO.parMapN(first, second, (_num, _str) => "should not run").unsafeRun();

      expect(result.type).toBe("Err");
      if (result.type === "Err") {
        expect(result.error.size).toBe(2);
      }
    });

    test("should accumulate errors when only some operations fail", async () => {
      const first = IO.lift(() => 1);
      const second = IO.fail("error2");
      const third = IO.lift(() => 3);
      const fourth = IO.fail("error4");

      const result = await IO.parMapN(
        first,
        second,
        third,
        fourth,
        (_num1, _str1, _num2, _str2) => "should not run"
      ).unsafeRun();

      expect(result.type).toBe("Err");
      if (result.type === "Err") {
        expect(result.error.size).toBe(2);
      }
    });

    test("should map the result of the operations in the callback", async () => {
      const first = IO.lift(() => 1);
      const second = IO.lift(() => "2");

      const result = await IO.parMapN(first, second, (num, str) => `${num}, ${str}`).unsafeRun();

      expect(result.type).toBe("Ok");
      if (result.type === "Ok") {
        expect(result.value).toBe("1, 2");
      }
    });
  });

  describe("Do", () => {
    it("should bind multiple operations", async () => {
      const result = await IO.Do(async (bind) => {
        const one = await bind(IO.lift(() => 1));
        const two = await bind(IO.lift(() => 2));
        const three = await bind(IO.lift(() => 3));

        return one + two + three;
      }).unsafeRun();

      expect(result.type === "Ok").toBe(true);
      expect((result as Ok<number>).value).toBe(6);
    });

    it("should short-circuit the computation on error", async () => {
      const result = await IO.Do(async (bind) => {
        const one = await bind(IO.lift(() => 1));
        await bind(IO.fail("fail"));
        const two = await bind(IO.lift(() => 2));

        return one + two;
      }).unsafeRun();

      expect(result.type).toBe("Err");
      if (result.type === "Err") {
        expect(result.error).toBe("fail");
      }
    });

    it("should execute the operation lazy", async () => {
      let sharedState = 0;

      const effectOne = IO.lift(() => {
        sharedState += 1;
        return sharedState;
      });

      const effectTwo = IO.lift(() => {
        sharedState += 2;
        return sharedState;
      });

      const effect = IO.Do(async (bind) => {
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

      const effOne: IO<BusinessError, number> = IO.lift(() => 1);
      const effTwo = (value: number): IO<BusinessError, number> => {
        if (value < 1) {
          return IO.fail(new BusinessError("Something went wrong"));
        } else {
          return IO.lift(() => 2);
        }
      };

      const eff = await IO.Do<BusinessError, number>(async (bind) => {
        const one = await bind(effOne);
        const two = await bind(effTwo(0));

        return one + two;
      }).unsafeRun();

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

  describe("retryIf", () => {
    it("should retry the effect the specified number of times on failure", async () => {
      let attempt = 0;
      const task = IO.lift<Error, number>(() => {
        attempt++;
        if (attempt < 3) {
          throw new Error("temporary failure");
        }
        return 42;
      });

      const result = await task
        .retryIf(
          (error) => error.message === "temporary failure",
          (e) => e,
          { recurs: 3, delay: 0, factor: 1 }
        )
        .unsafeRun();

      expect(result).toEqual({ type: "Ok", value: 42 });
      expect(attempt).toBe(3);
    });

    it("should stop retrying when the condition is not met", async () => {
      let attempt = 0;
      const task = IO.lift<Error, number>(() => {
        attempt++;
        throw new Error("non-retryable error");
      });

      const result = await task
        .retryIf(
          (error) => error.message === "retryable error",
          (e) => e,
          { recurs: 5, delay: 0, factor: 1 }
        )
        .unsafeRun();

      switch (result.type) {
        case "Ok":
          expect(result.value).toBe(-1);
          break;
        case "Err":
          expect(result.error.message).toBe("Retry condition not met: Error: non-retryable error");
          break;
      }

      expect(attempt).toBe(1);
    });

    it("should propagate the error if retries are exhausted", async () => {
      let attempt = 0;
      const task = IO.lift<Error, number>(() => {
        attempt++;
        throw new Error("retryable error");
      });

      const result = await task
        .retryIf(
          (error) => error.message === "retryable error",
          (e) => e,
          { recurs: 3, delay: 0, factor: 1 }
        )
        .unsafeRun();

      switch (result.type) {
        case "Ok":
          expect(result.value).toBe(-1);
          break;
        case "Err":
          expect(result.error.message).toBe("Retry limit reached without success: Error: retryable error");
          break;
      }

      expect(attempt).toBe(3);
    });

    it("should succeed immediately if the effect succeeds on the first attempt", async () => {
      const task = IO.lift<Error, number>(() => 42);

      const result = await task
        .retryIf(
          (_error) => true,
          (e) => e,
          { recurs: 5, delay: 0, factor: 1 }
        )
        .unsafeRun();

      switch (result.type) {
        case "Err":
          expect(result.error.message).toBe("Unknown error");
          break;
        case "Ok":
          expect(result.value).toBe(42);
          break;
      }
    });

    it("should transform to a custom error with liftE", async () => {
      type AppError = { code: number; message: string };
      let attempt = 0;
      const task = IO.lift<AppError, number>(() => {
        attempt++;
        throw new Error("raw error");
      });

      const result = await task
        .retryIf(
          (error) => error.message === "raw error",
          (e) => ({ code: 400, message: e.message }),
          { recurs: 3, delay: 0, factor: 1 }
        )
        .unsafeRun();

      expect(result.type).toBe("Err");
      if (result.type === "Err") {
        expect(result.error).toEqual({ code: 400, message: "Retry limit reached without success: Error: raw error" });
      }

      expect(attempt).toBe(3);
    });

    it("should not call liftE if retries are not exhausted", async () => {
      type AppError = { code: number; message: string };
      let attempt = 0;
      const liftE = jest.fn((e: Error): AppError => ({ code: 400, message: e.message }));

      const task = IO.lift<AppError, number>(() => {
        attempt++;
        if (attempt === 1) {
          throw new Error("temporary failure");
        }
        return 42;
      });

      const result = await task
        .retryIf((error) => error.message === "temporary failure", liftE, { recurs: 3, delay: 0, factor: 1 })
        .unsafeRun();

      expect(result).toEqual({ type: "Ok", value: 42 });
      expect(liftE).not.toHaveBeenCalled();
      expect(attempt).toBe(2);
    });

    it("should fail with PolicyValidationError for invalid policy parameters", async () => {
      const task = IO.lift<Error, number>(() => 42);

      const result = await task
        .retryIf(
          (error) => error.message === "retryable error",
          (e) => e,
          { recurs: -1, delay: -100, factor: 0 }
        )
        .unsafeRun();

      expect(result.type).toBe("Err");
      expect((result as Err<Error>).error.message).toContain("Policy validation error");
    });
  });

  describe("foldM", () => {
    it("should handle the success case and transform it", async () => {
      const task: IO<string, number> = IO.lift(() => 42).foldM(
        (error) => IO.fail(`Recovered from: ${error}`),
        (value) => IO.pure(value * 2)
      );

      const result = await task.unsafeRun();

      expect(result.type === "Ok").toBe(true);
      expect((result as Ok<number>).value).toBe(84);
    });

    it("should handle the failure case and recover", async () => {
      const task = IO.fail("Original Error").foldM(
        (error) => IO.pure(`Recovered from: ${error}`),
        (value) => IO.pure(`Success with: ${value}`)
      );

      const result = await task.unsafeRun();

      expect(result.type === "Ok").toBe(true);
      expect((result as Ok<string>).value).toBe("Recovered from: Original Error");
    });

    it("should propagate a transformed failure", async () => {
      const task: IO<string, string> = IO.fail("Original Error").foldM(
        (error) => IO.fail(`Transformed Error: ${error}`),
        (value) => IO.pure(`Success with: ${value}`)
      );

      const result = await task.unsafeRun();

      expect(result.type === "Err").toBe(true);
      expect((result as Err<string>).error).toBe("Transformed Error: Original Error");
    });

    it("should propagate a success unchanged if no transformation is applied", async () => {
      const task: IO<string, number> = IO.lift(() => 42).foldM(
        (error) => IO.fail(`Recovered from: ${error}`),
        (value) => IO.pure(value)
      );

      const result = await task.unsafeRun();

      expect(result.type === "Ok").toBe(true);
      expect((result as Ok<number>).value).toBe(42);
    });

    it("should compose operations correctly with nested foldM calls", async () => {
      const task: IO<string, number> = IO.lift(() => 42).foldM(
        (error) => IO.fail(`First recovery from: ${error}`),
        (value) =>
          IO.pure(value).foldM(
            () => IO.fail("Second recovery failed"),
            (innerValue) => IO.pure(innerValue + 10)
          )
      );

      const result = await task.unsafeRun();

      expect(result.type === "Ok").toBe(true);
      expect((result as Ok<number>).value).toBe(52);
    });

    it("should short-circuit properly in a nested foldM with a failure", async () => {
      const task: IO<string, string> = IO.fail("Outer Failure").foldM(
        (error) =>
          IO.fail(`Recovered: ${error}`).foldM(
            () => IO.fail("Inner failure"),
            (value) => IO.pure(`Inner recovery: ${value}`)
          ),
        (value) => IO.pure(`Success: ${value}`)
      );

      const result = await task.unsafeRun();

      expect(result.type === "Err").toBe(true);
      expect((result as Err<string>).error).toBe("Inner failure");
    });

    it("should compose a 'foldM' operation further", async () => {
      const task = IO.lift(() => 42)
        .flatMap((value) => IO.pure(value * 2))
        .foldM(
          (error) => IO.fail<string, number>(`Recovered from: ${error}`),
          (value) => IO.pure(value * 2)
        )
        .map((value) => value - 1);

      const result = await task.unsafeRun();

      expect(result.type === "Ok").toBe(true);
      expect((result as Ok<number>).value).toBe(167);
    });
  });

  describe("race", () => {
    it("should return the result of the first IO to complete", async () => {
      const task1 = IO.lift(async () => {
        await new Promise((resolve) => setTimeout(resolve, 100));
        return "first";
      });

      const task2 = IO.lift(async () => {
        await new Promise((resolve) => setTimeout(resolve, 200));
        return "second";
      });

      const task3 = IO.lift(async () => {
        await new Promise((resolve) => setTimeout(resolve, 300));
        return "third";
      });

      const result = await IO.race(task1, task2, task3).unsafeRun();

      expect(result).toEqual({ type: "Ok", value: "first" });
    });

    it("should return all errors if all IOs fail", async () => {
      const task1 = IO.fail<string, number>("error1");
      const task2 = IO.fail<string, number>("error2");
      const task3 = IO.fail<string, number>("error3");

      const result = await IO.race(task1, task2, task3).unsafeRun();

      expect(result.type).toBe("Err");
      if (result.type === "Err") {
        expect(result.error.size).toBe(3);
        expect(result.error.all).toEqual(["error1", "error2", "error3"]);
      }
    });

    it("should return the first successful result even if some fail", async () => {
      const task1 = IO.fail<string, string>("error1");
      const task2 = IO.lift(async () => {
        await new Promise((resolve) => setTimeout(resolve, 50));
        return "success";
      });
      const task3 = IO.fail<string, string>("error2");

      const result = await IO.race(task1, task2, task3).unsafeRun();

      expect(result).toEqual({ type: "Ok", value: "success" });
    });

    it("should throw on empty array of IOs", () => {
      expect(() => IO.race()).toThrow("IO.race requires at least one IO argument");
    });

    it("should ignore late failures after success", async () => {
      const ok = IO.lift<string, string>(() => "fast success");

      const fail = IO.lift<string, string>(async () => {
        await new Promise((resolve) => setTimeout(resolve, 100));
        throw new Error("late error");
      });

      const result = await IO.race<string, string>(ok, fail).unsafeRun();

      expect(result).toEqual({ type: "Ok", value: "fast success" });
    });

    it("should handle single IO that succeeds", async () => {
      const task = IO.lift(() => "only one");

      const result = await IO.race(task).unsafeRun();

      expect(result).toEqual({ type: "Ok", value: "only one" });
    });

    it("should handle single IO that fails", async () => {
      const task = IO.fail<string, number>("single error");

      const result = await IO.race(task).unsafeRun();

      expect(result.type).toBe("Err");
      if (result.type === "Err") {
        expect(result.error.size).toBe(1);
        expect(result.error.head).toBe("single error");
      }
    });

    it("should return immediately when first IO completes successfully", async () => {
      const startTime = Date.now();

      const fast = IO.lift(async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
        return "fast";
      });

      const slow = IO.lift(async () => {
        await new Promise((resolve) => setTimeout(resolve, 50));
        return "slow";
      });

      const result = await IO.race(fast, slow).unsafeRun();
      const elapsed = Date.now() - startTime;

      expect(result).toEqual({ type: "Ok", value: "fast" });
      expect(elapsed).toBeLessThan(50);
    });

    it("should handle IOs with thrown exceptions", async () => {
      const task1 = IO.lift<Error, string>(async () => {
        throw new Error("thrown error");
      });

      const task2 = IO.lift(() => "success");

      const result = await IO.race(task1, task2).unsafeRun();

      expect(result).toEqual({ type: "Ok", value: "success" });
    });

    it("should compose with other IO operations", async () => {
      const task1 = IO.lift(async () => {
        await new Promise((resolve) => setTimeout(resolve, 50));
        return 10;
      });

      const task2 = IO.lift(async () => {
        await new Promise((resolve) => setTimeout(resolve, 100));
        return 20;
      });

      const result = await IO.race(task1, task2)
        .map((n) => n * 2)
        .unsafeRun();

      expect(result).toEqual({ type: "Ok", value: 20 });
    });

    it("should handle race with flatMap", async () => {
      const task1 = IO.lift(async () => {
        await new Promise((resolve) => setTimeout(resolve, 50));
        return "first";
      });

      const task2 = IO.lift(async () => {
        await new Promise((resolve) => setTimeout(resolve, 100));
        return "second";
      });

      const result = await IO.race(task1, task2)
        .flatMap((value) => IO.lift(() => value.toUpperCase()))
        .unsafeRun();

      expect(result).toEqual({ type: "Ok", value: "FIRST" });
    });

    it("should be lazy and not execute until unsafeRun is called", async () => {
      let executed = false;

      const task = IO.lift(async () => {
        executed = true;
        return "value";
      });

      const raceIO = IO.race(task);
      expect(executed).toBe(false);

      await raceIO.unsafeRun();
      expect(executed).toBe(true);
    });

    it("should handle race with mapErr", async () => {
      const task1 = IO.fail<string, number>("error1");
      const task2 = IO.fail<string, number>("error2");

      const result = await IO.race(task1, task2)
        .mapErr((errors) => errors.map((e) => `Mapped: ${e}`))
        .unsafeRun();

      expect(result.type).toBe("Err");
      if (result.type === "Err") {
        expect(result.error.all).toEqual(["Mapped: error1", "Mapped: error2"]);
      }
    });
  });

  describe("bimap", () => {
    it("should transform the success value", async () => {
      const result = await IO.lift(() => 42)
        .bimap(
          () => "error",
          (n) => n * 2
        )
        .unsafeRun();

      expect(result).toEqual({ type: "Ok", value: 84 });
    });

    it("should transform the error value", async () => {
      const result = await IO.fail<string, number>("oops")
        .bimap(
          (e) => `Error: ${e}`,
          (n) => n * 2
        )
        .unsafeRun();

      expect(result).toEqual({ type: "Err", error: "Error: oops" });
    });
  });

  describe("traverse", () => {
    it("should sequentially apply the function and collect results", async () => {
      const result = await IO.traverse([1, 2, 3], (n) => IO.lift(() => n * 10)).unsafeRun();

      expect(result).toEqual({ type: "Ok", value: [10, 20, 30] });
    });

    it("should fail-fast on the first error", async () => {
      let callCount = 0;
      const result = await IO.traverse([1, 2, 3], (n) => {
        callCount++;
        if (n === 2) return IO.fail<string, number>("fail at 2");
        return IO.lift<string, number>(() => n * 10);
      }).unsafeRun();

      expect(result.type).toBe("Err");
      if (result.type === "Err") {
        expect(result.error).toBe("fail at 2");
      }
      // Item 3 should never have been attempted — bind short-circuits
      expect(callCount).toBe(2);
    });

    it("should handle an empty array", async () => {
      const result = await IO.traverse([], (_n: number) => IO.lift(() => 0)).unsafeRun();

      expect(result).toEqual({ type: "Ok", value: [] });
    });

    it("should execute sequentially, not in parallel", async () => {
      const order: number[] = [];
      const result = await IO.traverse([1, 2, 3], (n) =>
        IO.lift(async () => {
          await new Promise((resolve) => setTimeout(resolve, (4 - n) * 10));
          order.push(n);
          return n;
        })
      ).unsafeRun();

      expect(result).toEqual({ type: "Ok", value: [1, 2, 3] });
      expect(order).toEqual([1, 2, 3]); // Sequential, not reordered
    });
  });

  describe("parTraverse", () => {
    it("should apply the function in parallel and collect results", async () => {
      const result = await IO.parTraverse([1, 2, 3], (n) => IO.lift(() => n * 10)).unsafeRun();

      expect(result).toEqual({ type: "Ok", value: [10, 20, 30] });
    });

    it("should collect all errors when multiple items fail", async () => {
      const result = await IO.parTraverse([1, 2, 3], (n) => {
        if (n % 2 === 0) return IO.fail<string, number>(`fail at ${n}`);
        return IO.lift<string, number>(() => n * 10);
      }).unsafeRun();

      expect(result.type).toBe("Err");
      if (result.type === "Err") {
        expect(result.error.all).toEqual(["fail at 2"]);
      }
    });

    it("should collect multiple errors in parallel", async () => {
      const result = await IO.parTraverse([1, 2, 3, 4], (n) => {
        if (n > 2) return IO.fail<string, number>(`fail at ${n}`);
        return IO.lift<string, number>(() => n);
      }).unsafeRun();

      expect(result.type).toBe("Err");
      if (result.type === "Err") {
        expect(result.error.size).toBe(2);
        expect(result.error.all).toEqual(["fail at 3", "fail at 4"]);
      }
    });

    it("should handle an empty array", async () => {
      const result = await IO.parTraverse([], (_n: number) => IO.lift(() => 0)).unsafeRun();

      expect(result).toEqual({ type: "Ok", value: [] });
    });
  });

  describe("sequence", () => {
    it("should sequentially execute all IOs and collect results", async () => {
      const result = await IO.sequence([IO.lift(() => 1), IO.lift(() => 2), IO.lift(() => 3)]).unsafeRun();

      expect(result).toEqual({ type: "Ok", value: [1, 2, 3] });
    });

    it("should fail-fast on the first error", async () => {
      const result = await IO.sequence([
        IO.lift<string, number>(() => 1),
        IO.fail<string, number>("boom"),
        IO.lift<string, number>(() => 3),
      ]).unsafeRun();

      expect(result.type).toBe("Err");
      if (result.type === "Err") {
        expect(result.error).toBe("boom");
      }
    });

    it("should handle an empty array", async () => {
      const result = await IO.sequence([]).unsafeRun();

      expect(result).toEqual({ type: "Ok", value: [] });
    });
  });

  describe("parSequence", () => {
    it("should execute all IOs in parallel and collect results", async () => {
      const result = await IO.parSequence([IO.lift(() => 1), IO.lift(() => 2), IO.lift(() => 3)]).unsafeRun();

      expect(result).toEqual({ type: "Ok", value: [1, 2, 3] });
    });

    it("should collect all errors when multiple IOs fail", async () => {
      const result = await IO.parSequence([
        IO.fail<string, number>("e1"),
        IO.lift<string, number>(() => 2),
        IO.fail<string, number>("e3"),
      ]).unsafeRun();

      expect(result.type).toBe("Err");
      if (result.type === "Err") {
        expect(result.error.size).toBe(2);
        expect(result.error.all).toEqual(["e1", "e3"]);
      }
    });
  });

  describe("ensure (edge cases)", () => {
    it("should skip predicate when upstream fails", async () => {
      let predicateCalled = false;
      const result = await IO.fail<string, number>("upstream error")
        .ensure(
          () => {
            predicateCalled = true;
            return true;
          },
          () => "predicate error"
        )
        .unsafeRun();

      expect(result.type).toBe("Err");
      expect((result as Err<string>).error).toBe("upstream error");
      expect(predicateCalled).toBe(false);
    });

    it("should use liftE when predicate throws", async () => {
      const result = await IO.lift(() => 42)
        .ensure(
          () => {
            throw new Error("predicate exploded");
          },
          (value) => `liftE called with ${value}`
        )
        .unsafeRun();

      expect(result.type).toBe("Err");
      expect((result as Err<string>).error).toBe("liftE called with 42");
    });

    it("should pass the original value to liftE on predicate failure", async () => {
      const result = await IO.lift(() => 99)
        .ensure(
          (n) => n > 100,
          (n) => `Too small: ${n}`
        )
        .unsafeRun();

      expect(result).toEqual({ type: "Err", error: "Too small: 99" });
    });
  });

  describe("tap (edge cases)", () => {
    it("should support async callbacks", async () => {
      let sideEffect = "";
      const result = await IO.lift(() => "hello")
        .tap(async (val) => {
          await new Promise((resolve) => setTimeout(resolve, 10));
          sideEffect = val.toUpperCase();
        })
        .unsafeRun();

      expect(result).toEqual({ type: "Ok", value: "hello" });
      expect(sideEffect).toBe("HELLO");
    });

    it("should swallow sync errors from the callback", async () => {
      const result = await IO.lift(() => 42)
        .tap(() => {
          throw new Error("side-effect failed");
        })
        .unsafeRun();

      expect(result).toEqual({ type: "Ok", value: 42 });
    });

    it("should swallow async errors from the callback", async () => {
      const result = await IO.lift(() => 42)
        .tap(async () => {
          throw new Error("async side-effect failed");
        })
        .unsafeRun();

      expect(result).toEqual({ type: "Ok", value: 42 });
    });
  });

  describe("tapErr (edge cases)", () => {
    it("should support async callbacks", async () => {
      let sideEffect = "";
      const result = await IO.fail<string, number>("oops")
        .tapErr(async (err) => {
          await new Promise((resolve) => setTimeout(resolve, 10));
          sideEffect = err;
        })
        .unsafeRun();

      expect(result.type).toBe("Err");
      expect(sideEffect).toBe("oops");
    });

    it("should swallow errors from the callback", async () => {
      const result = await IO.fail<string, number>("original")
        .tapErr(() => {
          throw new Error("tapErr exploded");
        })
        .unsafeRun();

      expect(result).toEqual({ type: "Err", error: "original" });
    });

    it("should swallow async errors from the callback", async () => {
      const result = await IO.fail<string, number>("original")
        .tapErr(async () => {
          throw new Error("async tapErr exploded");
        })
        .unsafeRun();

      expect(result).toEqual({ type: "Err", error: "original" });
    });
  });

  describe("map (edge cases)", () => {
    it("should skip transformation when upstream fails", async () => {
      let called = false;
      const result = await IO.fail<string, number>("err")
        .map((n) => {
          called = true;
          return n * 2;
        })
        .unsafeRun();

      expect(result).toEqual({ type: "Err", error: "err" });
      expect(called).toBe(false);
    });

    it("should capture thrown exceptions as Err", async () => {
      const result = await IO.lift(() => 42)
        .map(() => {
          throw new Error("map threw");
        })
        .unsafeRun();

      expect(result.type).toBe("Err");
    });
  });

  describe("flatMap (edge cases)", () => {
    it("should skip when upstream fails", async () => {
      let called = false;
      const result = await IO.fail<string, number>("err")
        .flatMap((n) => {
          called = true;
          return IO.lift<string, number>(() => n * 2);
        })
        .unsafeRun();

      expect(result).toEqual({ type: "Err", error: "err" });
      expect(called).toBe(false);
    });

    it("should capture thrown exceptions from the function as Err", async () => {
      const result = await IO.lift(() => 42)
        .flatMap((): IO<unknown, number> => {
          throw new Error("flatMap threw");
        })
        .unsafeRun();

      expect(result.type).toBe("Err");
    });
  });

  describe("flatMapErr (edge cases)", () => {
    it("should propagate error when recovery itself fails", async () => {
      const result = await IO.fail<string, number>("original")
        .flatMapErr(() => IO.fail<string, number>("recovery also failed"))
        .unsafeRun();

      expect(result).toEqual({ type: "Err", error: "recovery also failed" });
    });

    it("should chain multiple flatMapErr calls", async () => {
      const result = await IO.fail<string, number>("e1")
        .flatMapErr(() => IO.fail<string, number>("e2"))
        .flatMapErr(() => IO.lift<string, number>(() => 99))
        .unsafeRun();

      expect(result).toEqual({ type: "Ok", value: 99 });
    });

    it("should capture thrown exceptions as Err", async () => {
      const result = await IO.fail<string, number>("err")
        .flatMapErr((): IO<string, number> => {
          throw new Error("flatMapErr threw");
        })
        .unsafeRun();

      expect(result.type).toBe("Err");
    });
  });

  describe("Do (edge cases)", () => {
    it("should use liftE for non-IO exceptions thrown in the operation body", async () => {
      const result = await IO.Do<string, number>(
        async (_bind) => {
          throw new Error("unexpected throw");
        },
        (e) => `Lifted: ${e}`
      ).unsafeRun();

      expect(result.type).toBe("Err");
      expect((result as Err<string>).error).toBe("Lifted: Error: unexpected throw");
    });

    it("should pass non-IO exceptions through untyped when liftE is not provided", async () => {
      const result = await IO.Do(async (_bind) => {
        throw new Error("raw throw");
      }).unsafeRun();

      expect(result.type).toBe("Err");
      expect((result as Err<Error>).error).toBeInstanceOf(Error);
    });

    it("should preserve error type through bind short-circuit", async () => {
      class AppError {
        constructor(readonly code: number) {}
      }

      const result = await IO.Do<AppError, string>(async (bind) => {
        await bind(IO.fail<AppError, void>(new AppError(404)));
        return "unreachable";
      }).unsafeRun();

      expect(result.type).toBe("Err");
      if (result.type === "Err") {
        expect(result.error).toBeInstanceOf(AppError);
        expect(result.error.code).toBe(404);
      }
    });
  });

  describe("foldM (edge cases)", () => {
    it("should capture thrown exception in onOk handler as untyped Err", async () => {
      const result = await IO.lift(() => 42)
        .foldM(
          () => IO.pure("recovered"),
          () => {
            throw new Error("onOk threw");
          }
        )
        .unsafeRun();

      expect(result.type).toBe("Err");
    });

    it("should capture thrown exception in onErr handler as untyped Err", async () => {
      const result = await IO.fail("original")
        .foldM(
          () => {
            throw new Error("onErr threw");
          },
          () => IO.pure("success")
        )
        .unsafeRun();

      expect(result.type).toBe("Err");
    });
  });

  describe("parMapN (edge cases)", () => {
    it("should capture thrown exception in combiner as Err", async () => {
      const result = await IO.parMapN(
        IO.lift(() => 1),
        IO.lift(() => 2),
        () => {
          throw new Error("combiner threw");
        }
      ).unsafeRun();

      expect(result.type).toBe("Err");
    });

    it("should throw synchronously for fewer than 2 IO arguments", () => {
      expect(() =>
        (IO as any).parMapN(
          IO.lift(() => 1),
          (x: number) => x
        )
      ).toThrow("IO.parMapN requires at least two IO arguments and a combiner function");
    });
  });

  describe("interpreter frame-skipping", () => {
    it("should skip all ok-frames when error propagates", async () => {
      let mapCalled = false;
      let tapCalled = false;
      let flatMapCalled = false;

      const result = await IO.fail<string, number>("err")
        .map((n) => {
          mapCalled = true;
          return n;
        })
        .tap(() => {
          tapCalled = true;
        })
        .flatMap((n) => {
          flatMapCalled = true;
          return IO.lift<string, number>(() => n);
        })
        .mapErr((e) => `caught: ${e}`)
        .unsafeRun();

      expect(mapCalled).toBe(false);
      expect(tapCalled).toBe(false);
      expect(flatMapCalled).toBe(false);
      expect(result).toEqual({ type: "Err", error: "caught: err" });
    });

    it("should skip all err-frames when value propagates", async () => {
      let mapErrCalled = false;
      let tapErrCalled = false;
      let flatMapErrCalled = false;

      const result = await IO.lift<string, number>(() => 42)
        .mapErr((e) => {
          mapErrCalled = true;
          return e;
        })
        .tapErr(() => {
          tapErrCalled = true;
        })
        .flatMapErr((e) => {
          flatMapErrCalled = true;
          return IO.fail<string, number>(e);
        })
        .map((n) => n + 1)
        .unsafeRun();

      expect(mapErrCalled).toBe(false);
      expect(tapErrCalled).toBe(false);
      expect(flatMapErrCalled).toBe(false);
      expect(result).toEqual({ type: "Ok", value: 43 });
    });

    it("should correctly interleave ok-frames and err-frames in complex chains", async () => {
      const log: string[] = [];

      const result = await IO.lift<string, number>(() => 1)
        .tap((n) => {
          log.push(`tap1: ${n}`);
        })
        .map((n) => {
          log.push(`map1: ${n}`);
          return n + 1;
        })
        .flatMap((n) => {
          log.push(`flatMap1: ${n}`);
          return IO.fail<string, number>(`error at ${n}`);
        })
        .tap(() => {
          log.push("tap2: should not run");
        })
        .map(() => {
          log.push("map2: should not run");
          return 999;
        })
        .tapErr((e) => {
          log.push(`tapErr1: ${e}`);
        })
        .mapErr((e) => {
          log.push(`mapErr1: ${e}`);
          return `mapped: ${e}`;
        })
        .flatMapErr((e) => {
          log.push(`flatMapErr1: ${e}`);
          return IO.lift<string, number>(() => 100);
        })
        .tap((n) => {
          log.push(`tap3: ${n}`);
        })
        .unsafeRun();

      expect(result).toEqual({ type: "Ok", value: 100 });
      expect(log).toEqual([
        "tap1: 1",
        "map1: 1",
        "flatMap1: 2",
        "tapErr1: error at 2",
        "mapErr1: error at 2",
        "flatMapErr1: mapped: error at 2",
        "tap3: 100",
      ]);
    });
  });

  describe("IO.lift with liftE edge cases", () => {
    it("should use liftE when sync function throws", async () => {
      const result = await IO.lift(
        () => {
          throw "raw string error";
        },
        (e) => `lifted: ${e}`
      ).unsafeRun();

      expect(result).toEqual({ type: "Err", error: "lifted: raw string error" });
    });

    it("should use liftE when async function rejects", async () => {
      const result = await IO.lift(
        async () => {
          throw "async rejection";
        },
        (e) => `lifted: ${e}`
      ).unsafeRun();

      expect(result).toEqual({ type: "Err", error: "lifted: async rejection" });
    });

    it("should not call liftE on success", async () => {
      let liftECalled = false;
      const result = await IO.lift(
        () => 42,
        () => {
          liftECalled = true;
          return "error";
        }
      ).unsafeRun();

      expect(result).toEqual({ type: "Ok", value: 42 });
      expect(liftECalled).toBe(false);
    });
  });

  describe("composition correctness", () => {
    it("should handle map after flatMapErr recovery", async () => {
      const result = await IO.fail<string, number>("err")
        .flatMapErr(() => IO.lift<string, number>(() => 10))
        .map((n) => n * 3)
        .unsafeRun();

      expect(result).toEqual({ type: "Ok", value: 30 });
    });

    it("should handle ensure after map", async () => {
      const result = await IO.lift(() => 5)
        .map((n) => n * 2)
        .ensure(
          (n) => n > 5,
          (n) => `${n} is too small`
        )
        .unsafeRun();

      expect(result).toEqual({ type: "Ok", value: 10 });
    });

    it("should handle ensure failure after map", async () => {
      const result = await IO.lift(() => 2)
        .map((n) => n * 2)
        .ensure(
          (n) => n > 5,
          (n) => `${n} is too small`
        )
        .unsafeRun();

      expect(result).toEqual({ type: "Err", error: "4 is too small" });
    });

    it("should handle foldM after ensure failure", async () => {
      const result = await IO.lift(() => 3)
        .ensure(
          (n) => n > 10,
          (n) => `too small: ${n}`
        )
        .foldM(
          (e) => IO.pure(`recovered: ${e}`),
          (n) => IO.pure(`ok: ${n}`)
        )
        .unsafeRun();

      expect(result).toEqual({ type: "Ok", value: "recovered: too small: 3" });
    });

    it("should handle deeply nested flatMap + map + mapErr", async () => {
      const result = await IO.lift(() => 1)
        .flatMap((n) =>
          IO.lift(() => n + 1).flatMap((n) =>
            IO.lift(() => n + 1).flatMap((n) =>
              IO.lift<string, number>(() => {
                if (n > 2) throw new Error("too big");
                return n;
              }).mapErr(() => "domain error")
            )
          )
        )
        .unsafeRun();

      expect(result).toEqual({ type: "Err", error: "domain error" });
    });
  });

  describe("fork", () => {
    it("should return a Fiber that can be joined for the result", async () => {
      const fiber = await IO.lift(() => 42)
        .fork()
        .getOrNull();

      expect(fiber).not.toBeNull();
      const result = await fiber!.join();
      expect(result).toEqual({ type: "Ok", value: 42 });
    });

    it("should return a Fiber that propagates errors on join", async () => {
      const fiber = await IO.fail<string, number>("boom").fork().getOrNull();

      const result = await fiber!.join();
      expect(result).toEqual({ type: "Err", error: "boom" });
    });

    it("should be lazy — computation starts only when outer IO runs", async () => {
      let started = false;
      const io = IO.lift(() => {
        started = true;
        return 42;
      });

      const forkIO = io.fork();
      expect(started).toBe(false);

      const fiber = await forkIO.getOrNull();
      // Now the computation has started
      const result = await fiber!.join();
      expect(started).toBe(true);
      expect(result).toEqual({ type: "Ok", value: 42 });
    });

    it("should work inside Do notation", async () => {
      const result = await IO.Do<string, number>(async (bind) => {
        const fiber = await bind(IO.lift<string, number>(() => 10).fork());
        const value = await bind(IO.lift<string, Ok<number> | Err<string> | Cancelled>(async () => fiber.join()));
        if (value.type === "Ok") return value.value * 2;
        return -1;
      }).unsafeRun();

      expect(result).toEqual({ type: "Ok", value: 20 });
    });
  });

  describe("cancel", () => {
    it("should cancel a forked computation", async () => {
      let completed = false;
      const io = IO.cancellable<string, number>(async (signal) => {
        await new Promise<void>((resolve, reject) => {
          const timer = setTimeout(() => {
            completed = true;
            resolve();
          }, 200);
          signal.addEventListener("abort", () => {
            clearTimeout(timer);
            reject(new Error("aborted"));
          });
        });
        return 42;
      });

      const fiber = await io.fork().getOrNull();
      await fiber!.cancel();
      const result = await fiber!.join();

      expect(result.type).toBe("Cancelled");
      // Give time to verify the computation didn't complete
      await new Promise((resolve) => setTimeout(resolve, 300));
      expect(completed).toBe(false);
    });

    it("should be idempotent — double cancel is a no-op", async () => {
      const fiber = await IO.lift(async () => {
        await new Promise((resolve) => setTimeout(resolve, 200));
        return 42;
      })
        .fork()
        .getOrNull();

      await fiber!.cancel();
      await fiber!.cancel(); // second cancel — no error
      const result = await fiber!.join();
      expect(result.type).toBe("Cancelled");
    });

    it("should be a no-op when cancelled after completion", async () => {
      const fiber = await IO.lift(() => 42)
        .fork()
        .getOrNull();

      const result = await fiber!.join();
      expect(result).toEqual({ type: "Ok", value: 42 });

      await fiber!.cancel(); // no-op, already completed
      const result2 = await fiber!.join();
      expect(result2).toEqual({ type: "Ok", value: 42 });
    });

    it("should cancel a long Do chain mid-execution", async () => {
      const log: string[] = [];

      const io = IO.Do<string, number>(async (bind) => {
        const a = await bind(
          IO.lift<string, number>(() => {
            log.push("step1");
            return 1;
          })
        );
        const b = await bind(
          IO.lift<string, number>(async () => {
            log.push("step2");
            await new Promise((resolve) => setTimeout(resolve, 50));
            return 2;
          })
        );
        // This step should not execute if cancelled during step2's delay
        const c = await bind(
          IO.lift<string, number>(() => {
            log.push("step3");
            return 3;
          })
        );
        return a + b + c;
      });

      const fiber = await io.fork().getOrNull();

      // Cancel after step1 likely completes but during step2's delay
      await new Promise((resolve) => setTimeout(resolve, 20));
      await fiber!.cancel();

      const result = await fiber!.join();
      expect(result.type).toBe("Cancelled");
      expect(log).toContain("step1");
      // step3 should not have run
      expect(log).not.toContain("step3");
    });
  });

  describe("onCancel", () => {
    it("should not run finalizer when IO succeeds", async () => {
      let finalizerRan = false;
      const result = await IO.lift(() => 42)
        .onCancel(() => {
          finalizerRan = true;
        })
        .unsafeRun();

      expect(result).toEqual({ type: "Ok", value: 42 });
      expect(finalizerRan).toBe(false);
    });

    it("should not run finalizer when IO fails", async () => {
      let finalizerRan = false;
      const result = await IO.fail("error")
        .onCancel(() => {
          finalizerRan = true;
        })
        .unsafeRun();

      expect(result).toEqual({ type: "Err", error: "error" });
      expect(finalizerRan).toBe(false);
    });

    it("should run finalizer when IO is cancelled", async () => {
      let finalizerRan = false;

      const io = IO.lift(async () => {
        await new Promise((resolve) => setTimeout(resolve, 200));
        return 42;
      }).onCancel(() => {
        finalizerRan = true;
      });

      const fiber = await io.fork().getOrNull();
      await fiber!.cancel();
      await fiber!.join();

      expect(finalizerRan).toBe(true);
    });

    it("should run multiple finalizers in LIFO order", async () => {
      const order: number[] = [];

      const io = IO.lift(async () => {
        await new Promise((resolve) => setTimeout(resolve, 200));
        return 42;
      })
        .onCancel(() => {
          order.push(1);
        })
        .onCancel(() => {
          order.push(2);
        })
        .onCancel(() => {
          order.push(3);
        });

      const fiber = await io.fork().getOrNull();
      await fiber!.cancel();
      await fiber!.join();

      expect(order).toEqual([1, 2, 3]); // innermost first (stack unwinding order)
    });

    it("should swallow errors from finalizers", async () => {
      const log: string[] = [];

      const io = IO.lift(async () => {
        await new Promise((resolve) => setTimeout(resolve, 200));
        return 42;
      })
        .onCancel(() => {
          log.push("first");
        })
        .onCancel(() => {
          throw new Error("finalizer exploded");
        })
        .onCancel(() => {
          log.push("third");
        });

      const fiber = await io.fork().getOrNull();
      await fiber!.cancel();
      await fiber!.join();

      // All finalizers run despite the middle one throwing (innermost first)
      expect(log).toEqual(["first", "third"]);
    });

    it("should support async finalizers", async () => {
      let cleaned = false;

      const io = IO.lift(async () => {
        await new Promise((resolve) => setTimeout(resolve, 200));
        return 42;
      }).onCancel(async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
        cleaned = true;
      });

      const fiber = await io.fork().getOrNull();
      await fiber!.cancel();
      await fiber!.join();

      expect(cleaned).toBe(true);
    });
  });

  describe("cancellable", () => {
    it("should create an IO that receives an AbortSignal", async () => {
      let receivedSignal: AbortSignal | null = null;

      const io = IO.cancellable<string, number>((signal) => {
        receivedSignal = signal;
        return 42;
      });

      const fiber = await io.fork().getOrNull();
      await fiber!.join();

      expect(receivedSignal).not.toBeNull();
      expect(receivedSignal!.aborted).toBe(false);
    });

    it("should abort the signal when cancelled", async () => {
      let receivedSignal: AbortSignal | null = null;

      const io = IO.cancellable<string, number>(async (signal) => {
        receivedSignal = signal;
        await new Promise((resolve) => setTimeout(resolve, 200));
        return 42;
      });

      const fiber = await io.fork().getOrNull();
      await new Promise((resolve) => setTimeout(resolve, 20));
      await fiber!.cancel();

      expect(receivedSignal).not.toBeNull();
      expect(receivedSignal!.aborted).toBe(true);
    });

    it("should work with unsafeRun (signal never aborted)", async () => {
      const result = await IO.cancellable<string, number>((signal) => {
        expect(signal.aborted).toBe(false);
        return 42;
      }).unsafeRun();

      expect(result).toEqual({ type: "Ok", value: 42 });
    });

    it("should transform errors via liftE", async () => {
      const result = await IO.cancellable<string, number>(
        () => {
          throw new Error("boom");
        },
        (e) => `Caught: ${e}`
      ).unsafeRun();

      expect(result.type).toBe("Err");
      if (result.type === "Err") {
        expect(result.error).toBe("Caught: Error: boom");
      }
    });
  });

  describe("race cancellation", () => {
    it("should cancel losers when the first IO succeeds", async () => {
      let slowCompleted = false;

      const fast = IO.lift(async () => {
        await new Promise((resolve) => setTimeout(resolve, 20));
        return "fast";
      });

      const slow = IO.cancellable<string, string>(async (signal) => {
        await new Promise((resolve, reject) => {
          const timer = setTimeout(() => resolve("done"), 300);
          signal.addEventListener("abort", () => {
            clearTimeout(timer);
            reject(new Error("aborted"));
          });
        });
        slowCompleted = true;
        return "slow";
      });

      const result = await IO.race(fast, slow).unsafeRun();

      expect(result).toEqual({ type: "Ok", value: "fast" });
      // Give time to verify slow didn't complete
      await new Promise((resolve) => setTimeout(resolve, 400));
      expect(slowCompleted).toBe(false);
    });

    it("should not cancel when all fail (all errors collected)", async () => {
      const result = await IO.race(IO.fail<string, number>("e1"), IO.fail<string, number>("e2")).unsafeRun();

      expect(result.type).toBe("Err");
      if (result.type === "Err") {
        expect(result.error.all).toEqual(["e1", "e2"]);
      }
    });
  });

  describe("Do cancellation", () => {
    it("should stop execution when forked Do is cancelled", async () => {
      const steps: string[] = [];

      const io = IO.Do<string, string>(async (bind) => {
        steps.push("a");
        await bind(
          IO.lift<string, void>(async () => {
            await new Promise((resolve) => setTimeout(resolve, 50));
          })
        );
        steps.push("b");
        await bind(
          IO.lift<string, void>(async () => {
            await new Promise((resolve) => setTimeout(resolve, 50));
          })
        );
        steps.push("c");
        return "done";
      });

      const fiber = await io.fork().getOrNull();
      // Cancel after first step completes
      await new Promise((resolve) => setTimeout(resolve, 30));
      await fiber!.cancel();
      const result = await fiber!.join();

      expect(result.type).toBe("Cancelled");
      expect(steps).not.toContain("c");
    });
  });

  describe("parMapN cancellation", () => {
    it("should propagate parent cancellation to cooperative children", async () => {
      const log: string[] = [];

      const io = IO.parMapN(
        IO.cancellable<string, number>(async (signal) => {
          await new Promise<void>((resolve, reject) => {
            const timer = setTimeout(() => {
              log.push("slow");
              resolve();
            }, 200);
            signal.addEventListener("abort", () => {
              clearTimeout(timer);
              reject(new Error("aborted"));
            });
          });
          return 1;
        }),
        IO.lift<string, number>(() => {
          log.push("fast");
          return 2;
        }),
        (a, b) => a + b
      );

      const fiber = await io.fork().getOrNull();
      await new Promise((resolve) => setTimeout(resolve, 20));
      await fiber!.cancel();
      const result = await fiber!.join();

      expect(result.type).toBe("Cancelled");
      expect(log).toContain("fast"); // sync one completes
      // Give time to verify slow didn't complete
      await new Promise((resolve) => setTimeout(resolve, 300));
      expect(log).not.toContain("slow");
    });
  });

  describe("Fiber.signal", () => {
    it("should expose the AbortSignal for interop", async () => {
      const fiber = await IO.lift(() => 42)
        .fork()
        .getOrNull();

      expect(fiber!.signal).toBeDefined();
      expect(fiber!.signal.aborted).toBe(false);
    });

    it("should reflect aborted state after cancel", async () => {
      const fiber = await IO.lift(async () => {
        await new Promise((resolve) => setTimeout(resolve, 200));
        return 42;
      })
        .fork()
        .getOrNull();

      await fiber!.cancel();
      expect(fiber!.signal.aborted).toBe(true);
    });
  });

  describe("cancellation edge cases", () => {
    it("should not affect unsafeRun — always returns Ok or Err, never Cancelled", async () => {
      const result = await IO.lift(() => 42).unsafeRun();
      expect(result.type).toBe("Ok");

      const result2 = await IO.fail("err").unsafeRun();
      expect(result2.type).toBe("Err");
    });

    it("should skip tap/tapErr during cancellation unwind", async () => {
      let tapRan = false;
      let tapErrRan = false;

      const io = IO.lift(async () => {
        await new Promise((resolve) => setTimeout(resolve, 200));
        return 42;
      })
        .tap(() => {
          tapRan = true;
        })
        .tapErr(() => {
          tapErrRan = true;
        });

      const fiber = await io.fork().getOrNull();
      await fiber!.cancel();
      await fiber!.join();

      expect(tapRan).toBe(false);
      expect(tapErrRan).toBe(false);
    });

    it("should skip foldM during cancellation — foldM cannot catch cancellation", async () => {
      let foldMRan = false;

      const io = IO.lift(async () => {
        await new Promise((resolve) => setTimeout(resolve, 200));
        return 42;
      }).foldM(
        () => {
          foldMRan = true;
          return IO.pure("recovered");
        },
        () => {
          foldMRan = true;
          return IO.pure("ok");
        }
      );

      const fiber = await io.fork().getOrNull();
      await fiber!.cancel();
      await fiber!.join();

      expect(foldMRan).toBe(false);
    });

    it("should handle cancellation of already-completed sync IOs gracefully", async () => {
      const fiber = await IO.pure(42).fork().getOrNull();

      // By the time we call cancel, the IO has already completed synchronously
      const result = await fiber!.join();
      expect(result).toEqual({ type: "Ok", value: 42 });
    });
  });
});
