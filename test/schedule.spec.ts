import { describe, expect, it } from "@jest/globals";
import { Policy, RetryLimitReachedError, Schedule, TimeoutError } from "../src/schedule";

describe("Schedule", () => {
  describe("retryIf", () => {
    let schedule: Schedule<number>;
    let policy: Policy;

    beforeEach(() => {
      policy = {
        recurs: 3,
        factor: 1.1,
        delay: 100,
        timeout: 300,
      };
      schedule = new Schedule<number>(policy);
    });

    it("should resolve when the condition is met before the maximum retries", async () => {
      let retryCounter = 0;
      const f = jest.fn(() => {
        return new Promise<number>((resolve, reject) => {
          retryCounter += 1;
          if (retryCounter === 2) {
            resolve(retryCounter);
          } else {
            reject(new Error("Test error"));
          }
        });
      });
      const condition = () => retryCounter !== 2;

      await expect(schedule.retryIf(f, condition)).resolves.toBe(2);
      expect(f).toHaveBeenCalledTimes(2);
    });

    it("should reject when the maximum retries is reached without meeting the condition", async () => {
      const f = jest.fn(() => Promise.reject(new Error("Test error")));
      const condition = () => true;

      await expect(schedule.retryIf(f, condition)).rejects.toThrowError(RetryLimitReachedError);
      expect(f).toHaveBeenCalledTimes(policy.recurs);
    });

    it("should reject when the timeout is exceeded", async () => {
      const f = () => new Promise<number>((resolve) => setTimeout(() => resolve(42), 350));
      const condition = () => true;

      const result = schedule.retryIf(f, condition);

      await expect(result).rejects.toThrowError(TimeoutError);
      await expect(result).rejects.toThrow("Operation timed out on attempt 1 after 300 milliseconds");
    });
  });

  describe("retry", () => {
    let schedule: Schedule<number>;
    let policy: Policy;

    beforeEach(() => {
      policy = {
        recurs: 3,
        factor: 1,
        delay: 0,
        timeout: 1000,
      };
      schedule = new Schedule<number>(policy);
    });

    describe("repeat method tests", () => {
      it("should repeat the asynchronous function defined number of times", async () => {
        let counter = 0;
        const expectedResult = 3;
        await schedule.repeat(async () => counter++);
        expect(counter).toBe(expectedResult);
      });

      it("should reject with RepeatError if the function does not complete within the limited tries", async () => {
        const f = jest.fn(() => Promise.reject(new Error("Test error")));
        const result = await schedule.repeat(f);
        expect((result as Error).message).toBe("Test error");
        expect(f).toHaveBeenCalledTimes(1);
      });

      it("should resolve to the return value of the last successful call to the given function", async () => {
        let counter = 0;
        const result = await schedule.repeat(async () => counter++);

        expect(result).toBe(policy.recurs - 1);
      });
    });
  });
});
