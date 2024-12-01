import { IO } from "./io.ts";

/**
 * Represents a scheduling policy with configurable retries, delay factor, initial delay, and optional timeout.
 */
export interface Policy {
  /**
   * The maximum number of retry attempts. Must be a positive integer.
   */
  readonly recurs: number;

  /**
   * The factor by which the delay increases after each retry. Must be greater than or equal to 1.
   */
  readonly factor: number;

  /**
   * The initial delay in milliseconds before the first retry. Must be non-negative.
   */
  readonly delay: number;

  /**
   * Optional. The maximum duration in milliseconds that each attempt can take before timing out.
   * If not set, attempts will not time out.
   */
  readonly timeout?: number;
}

/**
 * Provides a default policy configuration.
 *
 * @param {number} recurs - The maximum number of retries.
 * @param {number} factor - The factor by which the delay increases after each retry.
 * @param {number} delay - The initial delay before the first retry, in milliseconds.
 * @param {number} [timeout] - The optional timeout for each attempt, in milliseconds. If not set, attempts will not time out.
 * @returns {Policy} The default policy.
 */
export const defaultPolicy = (
  recurs: number = 3,
  factor: number = 1.2,
  delay: number = 1000,
  timeout?: number
): Policy => {
  return { recurs, factor, delay, timeout };
};

/**
 * Represents a scheduling strategy for retrying asynchronous operations.
 *
 * @template A - The type of the result returned by the asynchronous operations.
 */
export class Schedule {
  private readonly policy: Policy;
  private cancelled: boolean = false;

  /**
   * Constructs a new Schedule instance.
   *
   * @param {Policy} policy - The scheduling policy to use for retries.
   */
  constructor(policy: Policy = defaultPolicy()) {
    if (policy.recurs < 1) {
      throw new PolicyValidationError("Policy validation error: 'recurs' must be at least 1");
    }
    if (policy.factor < 1) {
      throw new PolicyValidationError("Policy validation error: 'factor' must be greater than or equal to 1");
    }
    if (policy.delay < 0) {
      throw new PolicyValidationError("Policy validation error: 'delay' must not be negative");
    }
    if (policy.timeout !== undefined && policy.timeout < 0) {
      throw new PolicyValidationError("Policy validation error: 'timeout' must not be negative");
    }
    this.policy = policy;
  }

  /**
   * @experimental
   *
   * Wraps an IO operation with retry logic based on a defined policy and a specific condition.
   * The operation is retried with an increasing delay, which grows according to the policy factor.
   * If an operation exceeds the retry limit or fails due to other reasons, a RetryError is thrown.
   * Other errors (including TimeoutError, if configured) are propagated immediately.
   *
   * @template E The error type inside the IO.
   * @template A The potential result of the IO operation.
   *
   * @param {IO<E, A>} eff The operation to retry.
   * @param {(error: E) => boolean} condition The condition under which to retry the operation.
   * @param {(error: Error) => E} liftE A function that transforms a generic Error into an instance of E.
   *
   * @returns {IO<E, A>} An IO instance that encapsulates the original operation's result if successful,
   *                      or encapsulates a RetryError if the retry limit is reached without success.
   */
  retryIf<E, A>(eff: IO<E, A>, condition: (error: E) => boolean, liftE: (error: Error) => E): IO<E, A> {
    const policy = this.policy;
    return IO.of<E, A>(async () => {
      let attempt = 0;
      let delay = policy.delay;
      let timeoutId: NodeJS.Timeout | null = null;

      while (attempt < policy.recurs) {
        if (this.cancelled) {
          if (timeoutId) {
            clearTimeout(timeoutId);
          }
          return Promise.reject(liftE(new CancellationError("Operation was cancelled")));
        }

        const result = await this.withTimeout(eff, liftE).runAsync();
        if (IO.isOk(result)) {
          return result.value;
        }
        const error = result.error;
        if (!condition(error)) {
          return Promise.reject(error);
        }
        if (attempt >= policy.recurs - 1) {
          return Promise.reject(error);
        }
        await new Promise((resolve) => {
          timeoutId = setTimeout(resolve, delay);
          if (this.cancelled) {
            clearTimeout(timeoutId);
            return Promise.reject(liftE(new CancellationError("Operation was cancelled")));
          }
        });
        delay *= policy.factor;
        attempt++;
      }
      return Promise.reject(liftE(new RetryError("Retry limit reached without success")));
    });
  }

  /**
   * @experimental
   *
   * Repeats the execution of an IO action based on a defined scheduling policy.
   * If the IO action succeeds, it is executed again until it either fails or the policy determines the execution should stop.
   *
   * The function returns the result of the last successful execution or throws a RepeatError.
   *
   * @template E The error type inside the IO.
   * @template A The potential result of the IO action.
   *
   * @param {IO<E, A>} eff The IO action to repeat.
   * @param {(error: Error) => E} liftE A function that transforms a generic Error into an instance of E.
   *
   * @returns {IO<E, A>} An IO instance that encapsulates the last successful result
   *                      or a RepeatError if the action fails or exhausts the retries determined by the policy.
   */
  repeat<E, A>(eff: IO<E, A>, liftE: (error: Error) => E): IO<E, A> {
    const policy = this.policy;
    let timeoutId: NodeJS.Timeout | null = null;

    return IO.of(async () => {
      let lastSuccessResult: A | null = null;

      for (let attempt = 0; attempt < policy.recurs; attempt++) {
        if (this.cancelled) {
          if (timeoutId) {
            clearTimeout(timeoutId);
          }
          return Promise.reject(liftE(new CancellationError("Operation was cancelled")));
        }

        const result = await this.withTimeout(eff, liftE).runAsync();

        if (IO.isOk(result)) {
          lastSuccessResult = result.value;

          if (attempt < policy.recurs - 1) {
            await new Promise((resolve) => (timeoutId = setTimeout(resolve, policy.delay)));
          }
        } else {
          return Promise.reject(liftE(new RepeatError(`Failed to execute repeat: ${result.error}`)));
        }
      }

      if (lastSuccessResult !== null && lastSuccessResult !== undefined) {
        return lastSuccessResult as A;
      }

      return Promise.reject(liftE(new RepeatError("The function provided never succeeded")));
    });
  }

  /**
   * @experimental
   *
   * Wraps an IO operation with an optional timeout configured by the scheduler policy.
   * If a valid timeout is provided and the operation exceeds this time,
   * it encapsulates a TimeoutError within the IO instance.
   * Otherwise, it proceeds as normal.
   *
   * @template E The error type inside the IO.
   * @template A The potential result of the IO operation.
   *
   * @param {IO<E, A>} eff The operation to wrap with the policy timeout.
   * @param {(error: Error) => E} liftE A function that transforms a generic Error into an instance of E.
   *
   * @returns {IO<E, A>} An IO instance that either encapsulates the original operation's result
   *                      or a TimeoutError if the timeout is exceeded.
   */
  withTimeout<E, A>(eff: IO<E, A>, liftE: (error: Error) => E): IO<E, A> {
    const timeout = this.policy.timeout;
    if (!timeout || timeout < 1) {
      return eff;
    }

    return IO.of<E, A>(async () => {
      let timeoutId: NodeJS.Timeout | null = null;

      const timeoutP = new Promise<A>((_, reject) => {
        timeoutId = setTimeout(() => {
          reject(liftE(new TimeoutError(`The operation timed out after ${timeout} milliseconds`)));
        }, timeout);
      });

      const opP = eff.runAsync().then((result) => {
        switch (result.type) {
          case "Ok":
            return result.value;
          case "Err":
            return Promise.reject(result.error);
        }
      });

      try {
        const result = await Promise.race([opP, timeoutP]);
        if (timeoutId) clearTimeout(timeoutId);
        return result;
      } catch (error) {
        if (timeoutId) clearTimeout(timeoutId);
        return Promise.reject(error);
      }
    });
  }

  /**
   * Cancels the ongoing scheduled operation. It should be used to stop the execution
   * of scheduled operations in response to changing conditions or to free up resources.
   *
   * @example
   * const schedule = new Schedule();
   * const operation = () => IO.ofSync(() => performOperation());
   * const retryCondition = () => true;
   * const errorLifter = (error: Error) => new CustomError(error.message);
   *
   * const retryIO = schedule.retryIf(operation, retryCondition, errorLifter);
   * // Cancel the operation after a short delay
   * setTimeout(() => {
   *   schedule.cancel();
   * }, 150);
   *
   * const result = await retryIO.runAsync();
   */
  cancel(): void {
    this.cancelled = true;
  }
}

/**
 * Represents an error related to invalid scheduling policy configurations.
 * This error is thrown when a policy is configured with invalid parameters.
 *
 * @extends Error
 */
export class PolicyValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PolicyValidationError";
  }
}

/**
 * Represents an error that occurs when an operation exceeds the allowed timeout limit.
 * This error is thrown when a scheduled operation does not complete within the specified timeout duration.
 *
 * @extends Error
 */
export class TimeoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TimeoutError";
  }
}

/**
 * Represents an error that occurs when the maximum number of retries is reached without successful completion of an operation.
 * This error is thrown when a retryable operation fails to succeed within the allowed number of attempts as defined by the policy.
 *
 * @extends Error
 */
export class RetryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RetryError";
  }
}

/**
 * Represents an error that occurs during the repetition of an operation, if the operation fails or if it cannot be repeated according to the policy.
 * This error is thrown when a repeated operation fails, or if the repeat logic encounters a condition that prevents further repetitions.
 *
 * @extends Error
 */
export class RepeatError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RepeatError";
  }
}

/**
 * Represents an error that occurs when an operation is cancelled.
 * This error is thrown when a scheduled operation is explicitly cancelled by the user.
 *
 * @extends Error
 */
export class CancellationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CancellationError";
  }
}
