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
      const f = IO.ofSync(() => {
        retryCounter += 1;
        if (retryCounter === 2) {
          return retryCounter;
        } else {
          throw new Error("Unexpected error");
        }
      });
      const condition = () => retryCounter !== 2;
      const liftE = (error: Error): Error => error;

      const result = await schedule.retryIf(() => f, condition, liftE).runAsync();

      expect(IO.isOk(result)).toBe(true);
      expect((result as Ok<number>).value).toBe(2);
    });

    it("should reject when the maximum retries is reached without meeting the condition", async () => {
      const f = IO.of<Error, string>(() => {
        throw new RetryError("Failed to execute operation");
      });
      const condition = () => true;
      const liftE = (error: Error): Error => error;

      const result = await schedule.retryIf(() => f, condition, liftE).runAsync();

      expect(IO.isErr(result)).toBe(true);
      expect((result as Err<Error>).error.message).toBe("Failed to execute operation");
    });

    it("should reject when the timeout is exceeded", async () => {
      const timeoutPromise = () => new Promise<number>((resolve) => setTimeout(() => resolve(42), 350));
      const f = IO.of<Error, number>(timeoutPromise);
      const condition = () => true;
      const liftE = (error: Error): Error => error;

      const result = await schedule.retryIf(() => f, condition, liftE).runAsync();

      expect(IO.isErr(result)).toBe(true);
      expect((result as Err<Error>).error.message).toBe("The operation timed out after 300 milliseconds");
    });
  });

  describe("retry", () => {
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

    describe("repeat", () => {
      it("should repeat the asynchronous function defined number of times", async () => {
        let counter = 0;

        const operation = IO.ofSync<string, number>(() => {
          counter += 1;
          return counter;
        });

        const liftE = (error: Error): string => error.message;
        const result = await schedule.repeat(() => operation, liftE).runAsync();

        expect(result.type).toBe("Ok");
        expect((result as Ok<number>).value).toBe(3);
      });

      it("should return the last value after the number after retries is completed", async () => {
        let counter = 0;
        const f = IO.ofSync<Error, number>(() => {
          counter += 1;
          if (counter === 3) {
            return 42;
          } else {
            return counter;
          }
        });
        const liftE = (error: Error): Error => new Error(`Unexpected error: ${error.message}`);

        const result = await schedule.repeat(() => f, liftE).runAsync();

        expect(IO.isOk(result)).toBe(true);
        expect((result as Ok<number>).value).toBe(42);
      });

      it("should fail if the operation repeated fails", async () => {
        let counter = 0;
        const f = IO.ofSync<Error, number>(() => {
          counter += 1;
          if (counter === 2) {
            throw new Error("Failed to complete the operation");
          } else {
            return counter;
          }
        });
        const liftE = (error: Error) => error;

        const result = await schedule.repeat(() => f, liftE).runAsync();

        expect(IO.isErr(result)).toBe(true);
        expect((result as Err<Error>).error.message).toContain("Failed to complete the operation");
      });
    });
  });
});
