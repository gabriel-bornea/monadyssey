import { describe, expect, it } from "@jest/globals";
import { Err, IO, Ok, Policy, PolicyValidationError, RetryError, Schedule } from "../src";

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
      ).toThrowError(PolicyValidationError);
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
      ).toThrowError(PolicyValidationError);
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
      ).toThrowError(PolicyValidationError);
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
      ).toThrowError(PolicyValidationError);
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
      const eff = IO.ofSync(() => {
        retryCounter += 1;
        if (retryCounter === 2) {
          return retryCounter;
        } else {
          throw new Error("Unexpected error");
        }
      });
      const condition = () => retryCounter !== 2;
      const liftE = (error: Error): Error => error;

      const result = await schedule.retryIf(eff, condition, liftE).runAsync();

      expect(IO.isOk(result)).toBe(true);
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

      const eff = IO.ofSync(() => {
        retryCounter += 1;
        if (retryCounter === 2) {
          return retryCounter;
        } else {
          throw new Error("Operation failed");
        }
      }).mapError((e) => new BusinessError(e instanceof Error ? e.message : "Unexpected error", true));

      const result = await schedule
        .retryIf(
          eff,
          (e) => e.retryable === true,
          (e) => new BusinessError(e.message, false)
        )
        .runAsync();

      expect(IO.isOk(result)).toBe(true);
      expect((result as Ok<number>).value).toBe(2);
    });

    it("should reject when the maximum retries is reached without meeting the condition", async () => {
      const eff = IO.of<Error, string>(() => {
        throw new RetryError("Failed to execute operation");
      });
      const condition = () => true;
      const liftE = (error: Error): Error => error;

      const result = await schedule.retryIf(eff, condition, liftE).runAsync();

      expect(IO.isErr(result)).toBe(true);
      expect((result as Err<Error>).error.message).toBe(
        "Retry limit reached without success: RetryError: Failed to execute operation"
      );
    });

    it("should reject when the timeout is exceeded", async () => {
      const timeoutPromise = () => new Promise<number>((resolve) => setTimeout(() => resolve(42), 350));
      const eff = IO.of<Error, number>(timeoutPromise);
      const condition = () => true;
      const liftE = (error: Error): Error => error;

      const result = await schedule.retryIf(eff, condition, liftE).runAsync();

      expect(IO.isErr(result)).toBe(true);
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

      const eff = IO.ofSync<string, number>(() => {
        counter += 1;
        return counter;
      });

      const liftE = (error: Error): string => error.message;
      const result = await schedule.repeat(eff, liftE).runAsync();

      expect(result.type).toBe("Ok");
      expect((result as Ok<number>).value).toBe(3);
    });

    it("should repeat an operation created from multiple IOs", async () => {
      let counter = 0;
      const eff = IO.ofSync<Error, number>(() => {
        counter += 1;
        return counter;
      });
      const eff2 = IO.ofSync<Error, number>(() => 3);
      const eff3 = IO.ofSync<Error, number>(() => 5);

      const liftE = (error: Error): Error => new Error(`Unexpected error: ${error.message}`);

      const op = eff.flatMap(() => eff2).flatMap(() => eff3);
      const result = await schedule.repeat(op, liftE).runAsync();

      expect(result.type).toBe("Ok");
      expect((result as Ok<number>).value).toBe(5);
    });

    it("should return the last value after the number after retries is completed", async () => {
      let counter = 0;
      const eff = IO.ofSync<Error, number>(() => {
        counter += 1;
        if (counter === 3) {
          return 42;
        } else {
          return counter;
        }
      });
      const liftE = (error: Error): Error => new Error(`Unexpected error: ${error.message}`);

      const result = await schedule.repeat(eff, liftE).runAsync();

      expect(IO.isOk(result)).toBe(true);
      expect((result as Ok<number>).value).toBe(42);
    });

    it("should fail if the operation repeated fails", async () => {
      let counter = 0;
      const eff = IO.ofSync<Error, number>(() => {
        counter += 1;
        if (counter === 2) {
          throw new Error("Failed to complete the operation");
        } else {
          return counter;
        }
      });
      const liftE = (error: Error) => error;

      const result = await schedule.repeat(eff, liftE).runAsync();

      expect(IO.isErr(result)).toBe(true);
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
      const eff = IO.ofSync(() => {
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

      const result = await operation.runAsync();

      expect(IO.isErr(result)).toEqual(true);

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

      const eff = IO.ofSync(() => 42);
      const liftE = (error: Error): BusinessError => new BusinessError(error.message);

      const operation = schedule.repeat(eff, liftE);
      // Cancel the operation after a short delay
      setTimeout(() => schedule.cancel(), 150);

      const result = await operation.runAsync();

      expect(IO.isErr(result)).toEqual(true);

      const error = result as Err<BusinessError>;
      expect(error.error.message).toBe("Operation was cancelled");
    });
  });
});
