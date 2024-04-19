import { IO } from "./io.ts";

/**
 * Represents a scheduling policy with configurable retries, delay factor, initial delay, and optional timeout.
 */
export interface Policy {
  /**
   * The maximum number of retry attempts. Must be a positive integer.
   */
  recurs: number;

  /**
   * The factor by which the delay increases after each retry. Must be greater than or equal to 1.
   */
  factor: number;

  /**
   * The initial delay in milliseconds before the first retry. Must be non-negative.
   */
  delay: number;

  /**
   * Optional. The maximum duration in milliseconds that each attempt can take before timing out.
   * If not set, attempts will not time out.
   */
  timeout?: number;
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
   * Wraps an IO operation with retry logic based on a defined policy and a specific condition.
   * The operation is retried with an increasing delay, which grows according to the policy factor.
   * If an operation exceeds the retry limit or fails due to other reasons, a RetryError is thrown.
   * Other errors (including TimeoutError, if configured) are propagated immediately.
   *
   * @template E The error type inside the IO.
   * @template A The potential result of the IO operation.
   *
   * @param {() => IO<E, A>} f The operation to retry.
   * @param {() => boolean} condition The condition under which to retry the operation.
   * @param {(error: Error) => E} liftE A function that transforms a generic Error into an instance of E.
   *
   * @returns {IO<E, A>} An IO instance that encapsulates the original operation's result if successful,
   *                      or encapsulates a RetryError if the retry limit is reached without success.
   *
   * @example
   * const operation = () => new IO(() => performOperationThatMayFail());
   * const retryCondition = () => hasResourcesForRetry();
   * const errorLifter = (error: Error) => new CustomError(error.message);
   *
   * const retryIO = retryIf(operation, retryCondition, errorLifter);
   *
   * retryIO.runAsync().then(result => {
   *   if (IO.isOk(result)) {
   *     // success handling
   *   } else {
   *     // error handling, includes RetryError and other potential failures
   *   }
   * });
   */
  retryIf = <E, A>(f: () => IO<E, A>, condition: () => boolean, liftE: (error: Error) => E): IO<E, A> => {
    const policy = this.policy;
    return IO.of<E, A>(async () => {
      let attempt = 0;
      let delay = policy.delay;

      while (condition() && attempt < policy.recurs) {
        const result = await this.withTimeout(f, liftE).runAsync();

        if (IO.isOk(result)) {
          return result.value;
        }

        if (attempt >= policy.recurs - 1 || !condition()) {
          throw result.error;
        }

        await new Promise((resolve) => setTimeout(resolve, delay));
        delay *= policy.factor;
        attempt++;
      }

      throw new RetryError("Retry limit reached without success");
    });
  };

  /**
   * Repeats the execution of an IO action based on a defined scheduling policy.
   * If the IO action succeeds, it is executed again until it either fails or the policy determines the execution should stop.
   *
   * The function returns the result of the last successful execution or throws a RepeatError.
   *
   * @template E The error type inside the IO.
   * @template A The potential result of the IO action.
   *
   * @param {() => IO<E, A>} f The IO action to repeat.
   * @param {(error: Error) => E} liftE A function that transforms a generic Error into an instance of E.
   *
   * @returns {IO<E, A>} An IO instance that encapsulates the last successful result
   *                      or a RepeatError if the action fails or exhausts the retries determined by the policy.
   *
   * @example
   * const operation = () => new IO(() => performOperationThatMaySucceedOrFail());
   * const errorLifter = (error: Error) => new CustomError(error.message);
   *
   * const repeatIO = repeat(operation, errorLifter);
   *
   * repeatIO.runAsync().then(result => {
   *   if (result.type === 'Ok') {
   *     // success handling with last successful result
   *   } else {
   *     // error handling, may involve RepeatError or other failures occurred during execution
   *   }
   * });
   */
  repeat<E, A>(f: () => IO<E, A>, liftE: (error: Error) => E): IO<E, A> {
    const policy = this.policy;

    return IO.of(async () => {
      let lastSuccessResult: A | null = null;

      for (let attempt = 0; attempt < policy.recurs; attempt++) {
        const result = await this.withTimeout(f, liftE).runAsync();

        if (IO.isOk(result)) {
          lastSuccessResult = result.value;

          // if this is not the last attempt then delay
          if (attempt < policy.recurs - 1) {
            await new Promise((resolve) => setTimeout(resolve, policy.delay));
          }
        } else {
          throw new RepeatError(`Failed to execute repeat: ${result.error}`);
        }
      }

      if (lastSuccessResult !== null) {
        return lastSuccessResult;
      }

      throw new RepeatError("The function provided never succeeded");
    });
  }

  /**
   * Wraps an IO operation with an optional timeout configured by the scheduler policy.
   * If a valid timeout is provided and the operation exceeds this time,
   * it encapsulates a TimeoutError within the IO instance.
   * Otherwise, it proceeds as normal.
   *
   * @template E The error type inside the IO.
   * @template A The potential result of the IO operation.
   *
   * @param {() => IO<E, A>} f The operation to wrap with the policy timeout.
   * @param {(error: Error) => E} liftE A function that transforms a generic Error into an instance of E.
   *
   * @returns {IO<E, A>} An IO instance that either encapsulates the original operation's result
   *                      or a TimeoutError if the timeout is exceeded.
   *
   * @example
   * const operation = () => new IO(() => performSomeOperation());
   * const timeoutErrorLifter = (error: Error) => new CustomError(error.message);
   *
   * const ioWithTimeout = withTimeout(operation, timeoutErrorLifter);
   *
   * ioWithTimeout.runAsync()
   *   .then(result => {
   *     if (IO.isOk(result)) {
   *       // success handling
   *     } else {
   *       // error handling, includes TimeoutError and other potential errors.
   *     }
   *   });
   */
  withTimeout = <E, A>(f: () => IO<E, A>, liftE: (error: Error) => E): IO<E, A> => {
    const timeout = this.policy.timeout;
    if (!timeout || timeout < 1) {
      return f();
    }

    return IO.of<E, A>(async () => {
      let timeoutId: NodeJS.Timeout | null = null;
      const timeoutError = liftE(new TimeoutError(`The operation timed out after ${timeout} milliseconds`));
      // Promise that completes after the specified duration.
      const timeoutPromise = new Promise<A>((_, reject) => {
        timeoutId = setTimeout(() => {
          reject(timeoutError);
        }, timeout);
      });

      // Promise that completes when the operation f finishes.
      const operationPromise = f()
        .runAsync()
        .then((result) => {
          if (result.type === "Ok") {
            return result.value;
          } else {
            throw result.error; // throw an error instead of returning it
          }
        });

      // Returns the promise that completes first: the operation or the timeout.
      return Promise.race([
        operationPromise
          .catch((error) => {
            throw error;
          })
          .finally(() => {
            if (timeoutId) clearTimeout(timeoutId);
          }),
        timeoutPromise.finally(() => {
          if (timeoutId) clearTimeout(timeoutId);
        }),
      ]);
    });
  };
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
