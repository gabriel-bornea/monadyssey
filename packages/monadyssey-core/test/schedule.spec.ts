import { beforeEach, describe, expect, it, test } from "@jest/globals";
import {
  Err,
  IO,
  Ok,
  Policy,
  PolicyValidationError,
  RetryError,
  ConditionalRetryError,
  Schedule,
  CancellationError,
} from "../src";

describe("Schedule", () => {
  describe("constructor", () => {
    it("should successfully create a new schedule instance", () => {
      const schedule = new Schedule({
        recurs: 3,
        factor: 1.1,
        delay: 100,
        timeout: 300,
      });
      expect(schedule).not.toBe(null);
    });

    it("should not create a new schedule instance with an invalid recurs property", () => {
      expect(
        () =>
          new Schedule({
            recurs: 0,
            factor: 1.1,
            delay: 100,
            timeout: 300,
          })
      ).toThrow(PolicyValidationError);
    });

    it("should not create a new schedule instance with an invalid factor property", () => {
      expect(
        () =>
          new Schedule({
            recurs: 3,
            factor: 0.9,
            delay: 100,
            timeout: 300,
          })
      ).toThrow(PolicyValidationError);
    });

    it("should not create a new schedule instance with an invalid delay property", () => {
      expect(
        () =>
          new Schedule({
            recurs: 3,
            factor: 1.2,
            delay: -1,
            timeout: 300,
          })
      ).toThrow(PolicyValidationError);
    });

    it("should not create a new schedule instance with an invalid timeout property", () => {
      expect(
        () =>
          new Schedule({
            recurs: 3,
            factor: 1.2,
            delay: 100,
            timeout: -1,
          })
      ).toThrow(PolicyValidationError);
    });

    it("should successfully create a new schedule instance with a default policy", () => {
      const schedule = new Schedule();
      expect(schedule).not.toBe(null);
    });
  });

  describe("retryIf", () => {
    let schedule: Schedule;
    let policy: Policy;

    beforeEach(() => {
      policy = {
        recurs: 3,
        factor: 1.1,
        delay: 100,
        timeout: 300,
      };
      schedule = new Schedule(policy);
    });

    it("should resolve when the condition is met before the maximum retries", async () => {
      let retryCounter = 0;
      const eff = IO.lift(() => {
        retryCounter += 1;
        if (retryCounter === 2) {
          return retryCounter;
        } else {
          throw new Error("Unexpected error");
        }
      });
      const condition = () => retryCounter !== 2;
      const liftE = (error: Error): Error => error;

      const result = await schedule.retryIf(eff, condition, liftE).unsafeRun();

      expect(result.type === "Ok").toBe(true);
      expect((result as Ok<number>).value).toBe(2);
    });

    it("should retry based on the type of the error until successful", async () => {
      class BusinessError {
        message: string;
        retryable: boolean;

        constructor(message: string, retryable: boolean) {
          this.message = message;
          this.retryable = retryable;
        }
      }

      let retryCounter = 0;

      const eff = IO.lift(() => {
        retryCounter += 1;
        if (retryCounter === 2) {
          return retryCounter;
        } else {
          throw new Error("Operation failed");
        }
      }).mapErr((e) => new BusinessError(e instanceof Error ? e.message : "Unexpected error", true));

      const result = await schedule
        .retryIf(
          eff,
          (e) => e.retryable === true,
          (e) => new BusinessError(e.message, false)
        )
        .unsafeRun();

      expect(result.type === "Ok").toBe(true);
      expect((result as Ok<number>).value).toBe(2);
    });

    it("should reject when the maximum retries is reached without meeting the condition", async () => {
      const eff = IO.lift<Error, string>(() => {
        throw new RetryError("Failed to execute operation");
      });
      const condition = () => true;
      const liftE = (error: Error): Error => error;

      const result = await schedule.retryIf(eff, condition, liftE).unsafeRun();

      expect(result.type === "Err").toBe(true);
      expect((result as Err<Error>).error.message).toBe(
        "Retry limit reached without success: RetryError: Failed to execute operation"
      );
    });

    it("should reject when the timeout is exceeded", async () => {
      const timeoutPromise = () => new Promise<number>((resolve) => setTimeout(() => resolve(42), 350));
      const eff = IO.lift<Error, number>(timeoutPromise);
      const condition = () => true;
      const liftE = (error: Error): Error => error;

      const result = await schedule.retryIf(eff, condition, liftE).unsafeRun();

      expect(result.type === "Err").toBe(true);
      expect((result as Err<Error>).error.message).toBe(
        "Retry limit reached without success: TimeoutError: The operation timed out after 300 milliseconds"
      );
    });
  });

  describe("repeat", () => {
    let schedule: Schedule;
    let policy: Policy;

    beforeEach(() => {
      policy = {
        recurs: 3,
        factor: 1,
        delay: 0,
        timeout: 1000,
      };
      schedule = new Schedule(policy);
    });

    it("should repeat the asynchronous function defined number of times", async () => {
      let counter = 0;

      const eff = IO.lift<string, number>(() => {
        counter += 1;
        return counter;
      });

      const liftE = (error: Error): string => error.message;
      const result = await schedule.repeat(eff, liftE).unsafeRun();

      expect(result.type).toBe("Ok");
      expect((result as Ok<number>).value).toBe(3);
    });

    it("should repeat an operation created from multiple IOs", async () => {
      let counter = 0;
      const eff = IO.lift<Error, number>(() => {
        counter += 1;
        return counter;
      });
      const eff2 = IO.lift<Error, number>(() => 3);
      const eff3 = IO.lift<Error, number>(() => 5);

      const liftE = (error: Error): Error => new Error(`Unexpected error: ${error.message}`);

      const op = eff.flatMap(() => eff2).flatMap(() => eff3);
      const result = await schedule.repeat(op, liftE).unsafeRun();

      expect(result.type).toBe("Ok");
      expect((result as Ok<number>).value).toBe(5);
    });

    it("should return the last value after the number after retries is completed", async () => {
      let counter = 0;
      const eff = IO.lift<Error, number>(() => {
        counter += 1;
        if (counter === 3) {
          return 42;
        } else {
          return counter;
        }
      });
      const liftE = (error: Error): Error => new Error(`Unexpected error: ${error.message}`);

      const result = await schedule.repeat(eff, liftE).unsafeRun();

      expect(result.type === "Ok").toBe(true);
      expect((result as Ok<number>).value).toBe(42);
    });

    it("should fail if the operation repeated fails", async () => {
      let counter = 0;
      const eff = IO.lift<Error, number>(() => {
        counter += 1;
        if (counter === 2) {
          throw new Error("Failed to complete the operation");
        } else {
          return counter;
        }
      });
      const liftE = (error: Error) => error;

      const result = await schedule.repeat(eff, liftE).unsafeRun();

      expect(result.type === "Err").toBe(true);
      expect((result as Err<Error>).error.message).toContain("Failed to complete the operation");
    });
  });

  describe("cancel", () => {
    let schedule: Schedule;
    let policy: Policy;

    beforeEach(() => {
      policy = {
        recurs: 5,
        factor: 1.2,
        delay: 100,
        timeout: 300,
      };
    });

    test("should cancel retryIf operation", async () => {
      schedule = new Schedule(policy);
      let attempt = 0;
      const eff = IO.lift(() => {
        attempt++;
        if (attempt === 4) {
          return 42;
        } else {
          throw new Error("Unexpected error");
        }
      });

      // always retry
      const retryCondition = () => true;
      const liftE = (error: Error): string => error.message;

      const operation = schedule.retryIf(eff, retryCondition, liftE);
      // Cancel the operation after a short delay
      setTimeout(() => schedule.cancel(), 150);

      const result = await operation.unsafeRun();

      expect(result.type === "Err").toEqual(true);

      const error = result as Err<string>;
      expect(error.error).toBe("Operation was cancelled");

      // Ensure it was cancelled before completing all retries
      expect(attempt).toBeLessThan(5);
    });

    test("should cancel repeat operation", async () => {
      // repeats indefinitely until an error occurs or the scheduler is cancelled
      schedule = new Schedule({
        recurs: Infinity,
        factor: 1,
        delay: 100,
        timeout: 300,
      });

      class BusinessError {
        message: string;

        constructor(message: string) {
          this.message = message;
        }
      }

      const eff = IO.lift(() => 42);
      const liftE = (error: Error): BusinessError => new BusinessError(error.message);

      const operation = schedule.repeat(eff, liftE);
      // Cancel the operation after a short delay
      setTimeout(() => schedule.cancel(), 150);

      const result = await operation.unsafeRun();

      expect(result.type === "Err").toEqual(true);

      const error = result as Err<BusinessError>;
      expect(error.error.message).toBe("Operation was cancelled");
    });
  });

  describe("policy validation (NaN / invalid values)", () => {
    it("should reject NaN recurs", () => {
      expect(() => new Schedule({ recurs: NaN, factor: 1, delay: 0 })).toThrow(PolicyValidationError);
    });

    it("should reject NaN factor", () => {
      expect(() => new Schedule({ recurs: 1, factor: NaN, delay: 0 })).toThrow(PolicyValidationError);
    });

    it("should reject NaN delay", () => {
      expect(() => new Schedule({ recurs: 1, factor: 1, delay: NaN })).toThrow(PolicyValidationError);
    });

    it("should reject NaN timeout", () => {
      expect(() => new Schedule({ recurs: 1, factor: 1, delay: 0, timeout: NaN })).toThrow(PolicyValidationError);
    });

    it("should reject NaN jitter", () => {
      expect(() => new Schedule({ recurs: 1, factor: 1, delay: 0, jitter: NaN })).toThrow(PolicyValidationError);
    });

    it("should accept Infinity recurs for unbounded repeat/retry", () => {
      const schedule = new Schedule({ recurs: Infinity, factor: 1, delay: 0 });
      expect(schedule).not.toBe(null);
    });
  });

  describe("retryIf (cancellation during delay)", () => {
    it("should not deadlock when cancelled during retry delay", async () => {
      const schedule = new Schedule({ recurs: 10, factor: 1, delay: 500 });
      let attempt = 0;

      const eff = IO.lift<Error, number>(() => {
        attempt++;
        throw new Error("always fails");
      });

      const operation = schedule.retryIf(
        eff,
        () => true,
        (e) => e
      );

      // Cancel after first attempt completes but during the delay before second attempt
      setTimeout(() => schedule.cancel(), 50);

      const result = await operation.unsafeRun();

      expect(result.type).toBe("Err");
      expect((result as Err<Error>).error).toBeInstanceOf(CancellationError);
      expect(attempt).toBe(1);
    }, 2000);

    it("should handle condition function that throws", async () => {
      const schedule = new Schedule({ recurs: 3, factor: 1, delay: 0 });

      const eff = IO.lift<Error, number>(() => {
        throw new Error("op failed");
      });

      const result = await schedule
        .retryIf(
          eff,
          () => {
            throw new Error("condition exploded");
          },
          (e) => e
        )
        .unsafeRun();

      expect(result.type).toBe("Err");
      expect((result as Err<Error>).error.message).toContain("condition exploded");
    });
  });

  describe("IO signal cancellation", () => {
    it("should abort retryIf when the IO fiber is cancelled", async () => {
      const schedule = new Schedule({ recurs: 10, factor: 1, delay: 500 });
      let attempt = 0;

      const eff = IO.lift<Error, number>(() => {
        attempt++;
        throw new Error("always fails");
      });

      const operation = schedule.retryIf(
        eff,
        () => true,
        (e) => e
      );
      const fiber = await operation.fork().getOrNull();

      // Cancel via fiber after the first attempt but during the delay
      await new Promise((resolve) => setTimeout(resolve, 50));
      await fiber!.cancel();

      const result = await fiber!.join();

      expect(result.type).toBe("Cancelled");
      expect(attempt).toBe(1);
    }, 2000);

    it("should abort repeat when the IO fiber is cancelled", async () => {
      const schedule = new Schedule({ recurs: Infinity, factor: 1, delay: 200 });
      let counter = 0;

      const eff = IO.lift<Error, number>(() => {
        counter++;
        return counter;
      });

      const operation = schedule.repeat(eff, (e) => e);
      const fiber = await operation.fork().getOrNull();

      // Cancel via fiber during a delay
      await new Promise((resolve) => setTimeout(resolve, 100));
      await fiber!.cancel();

      const result = await fiber!.join();

      expect(result.type).toBe("Cancelled");
      expect(counter).toBeGreaterThanOrEqual(1);
      expect(counter).toBeLessThan(10);
    }, 2000);

    it("should abort retryIf immediately when IO signal is already aborted", async () => {
      const schedule = new Schedule({ recurs: 5, factor: 1, delay: 500 });

      const eff = IO.lift<Error, number>(() => {
        throw new Error("fails");
      });

      const operation = schedule.retryIf(
        eff,
        () => true,
        (e) => e
      );
      const fiber = await operation.fork().getOrNull();

      // Cancel immediately
      await fiber!.cancel();

      const result = await fiber!.join();

      expect(result.type).toBe("Cancelled");
    }, 2000);
  });

  describe("ConditionalRetryError export", () => {
    it("should be importable and usable", () => {
      const error = new ConditionalRetryError("test");
      expect(error).toBeInstanceOf(Error);
      expect(error.name).toBe("ConditionalRetryError");
      expect(error.message).toBe("test");
    });

    it("should be produced when retry condition is not met", async () => {
      const schedule = new Schedule({ recurs: 3, factor: 1, delay: 0 });

      const eff = IO.lift<Error, number>(() => {
        throw new Error("op failed");
      });

      const result = await schedule
        .retryIf(
          eff,
          () => false,
          (e) => e
        )
        .unsafeRun();

      expect(result.type).toBe("Err");
      expect((result as Err<Error>).error.message).toContain("Retry condition not met");
    });
  });

  describe("repeat (fixes)", () => {
    it("should apply exponential backoff with policy.factor", async () => {
      const schedule = new Schedule({ recurs: 3, factor: 2, delay: 100 });
      let counter = 0;

      const eff = IO.lift<Error, number>(() => {
        counter++;
        return counter;
      });

      const start = Date.now();
      const result = await schedule.repeat(eff, (e) => e).unsafeRun();
      const elapsed = Date.now() - start;

      expect(result.type).toBe("Ok");
      expect((result as Ok<number>).value).toBe(3);
      // With factor=2: first delay=100ms, second delay=200ms, total >= 300ms
      // Allow some tolerance for timing
      expect(elapsed).toBeGreaterThanOrEqual(250);
    }, 5000);

    it("should handle null success value correctly", async () => {
      const schedule = new Schedule({ recurs: 2, factor: 1, delay: 0 });

      const eff = IO.lift<Error, null>(() => null);

      const result = await schedule.repeat(eff, (e) => e).unsafeRun();

      expect(result.type).toBe("Ok");
      expect((result as Ok<null>).value).toBe(null);
    });

    it("should handle undefined success value correctly", async () => {
      const schedule = new Schedule({ recurs: 2, factor: 1, delay: 0 });

      const eff = IO.lift<Error, undefined>(() => undefined);

      const result = await schedule.repeat(eff, (e) => e).unsafeRun();

      expect(result.type).toBe("Ok");
      expect((result as Ok<undefined>).value).toBe(undefined);
    });

    it("should handle void IO (IO.unit) with repeat", async () => {
      const schedule = new Schedule({ recurs: 3, factor: 1, delay: 0 });
      let counter = 0;

      const eff = IO.lift<Error, void>(() => {
        counter++;
      });

      const result = await schedule.repeat(eff, (e) => e).unsafeRun();

      expect(result.type).toBe("Ok");
      expect(counter).toBe(3);
    });
  });
});
