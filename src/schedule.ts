/**
 * Represents a scheduling policy with configurable retries, delay factor, initial delay, and optional timeout.
 */
export interface Policy {
  recurs: number;
  factor: number;
  delay: number;
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
export class Schedule<A> {
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
   * Tries to execute a function as long as a condition is true, retrying up to a maximum number of times defined in the policy.
   * Note: If the condition is mutable, changes to its state after this function starts executing will influence the retry logic.
   *
   * @param {() => Promise<A>} f - The asynchronous function to attempt.
   * @param {() => boolean} condition - A function that returns true if retry should continue or false to stop.
   * @returns {Promise<A>} The result of the function `f` if successful.
   */
  retryIf = async (f: () => Promise<A>, condition: () => boolean): Promise<A> => {
    const policy = this.policy;
    const retry = async (
      wrappedF: () => Promise<A>,
      condition: () => boolean,
      counter: number = 0,
      delay: number = policy.delay
    ): Promise<A> => {
      if (!condition() || counter >= policy.recurs) {
        return Promise.reject(new RetryLimitReachedError("Retry ended without fulfilling the condition"));
      }
      try {
        return await wrappedF();
      } catch (error) {
        if (error instanceof TimeoutError) {
          return Promise.reject(error);
        }
        const nextDelay = delay * policy.factor;
        await new Promise((resolve) => setTimeout(resolve, delay));
        return retry(this.withPolicyTimeout(wrappedF, counter + 1), condition, counter + 1, nextDelay);
      }
    };
    return retry(this.withPolicyTimeout(f, 1), condition, 0, policy.delay);
  };

  /**
   * Repeats the execution of the action, and if it succeeds, keeps executing it again based on the scheduling policy
   * defined. It stops if the action fails or the policy determines it should not be executed again.
   * It returns the last internal state of the scheduling policy or the error that happened running the action.
   *
   * @param {() => Promise<A>} f - The asynchronous function to attempt.
   * @return {Promise<A>} The result of the function `f`.
   */
  async repeat(f: () => Promise<A>): Promise<Error | A> {
    let lastResult: A | undefined = undefined;
    let attempt = 0;

    while (attempt < this.policy.recurs) {
      const wrappedF = this.withPolicyTimeout(f, attempt + 1);

      try {
        lastResult = await wrappedF();
        attempt++;
        if (attempt < this.policy.recurs) {
          await new Promise((resolve) => setTimeout(resolve, this.policy.delay));
        }
      } catch (error) {
        if (error instanceof Error) {
          return new RepeatError(error.message);
        } else {
          return new RepeatError("Failed to execute repeat");
        }
      }
    }

    if (lastResult === undefined) {
      return new RepeatError("The function provided never succeeded");
    }
    return lastResult;
  }

  /**
   * Wraps an asynchronous function with an optional timeout.
   *
   * If a valid timeout is provided (greater than 0), the function will reject if not completed within that time frame.
   * Otherwise, the function will execute normally without a timeout.
   *
   * @param {() => Promise<A>} f - The asynchronous function to wrap.
   * @param attempt - The current attempt
   * @returns {Promise<A>} A promise that resolves with the function's result or rejects if the timeout is exceeded.
   */
  private withPolicyTimeout = <A>(f: () => Promise<A>, attempt: number = 0): (() => Promise<A>) => {
    const timeout = this.policy.timeout;
    if (!timeout || timeout <= 0) {
      return f;
    }

    return () =>
      Promise.race([
        f(),
        new Promise<A>((_, reject) =>
          setTimeout(
            () => reject(new TimeoutError(`Operation timed out on attempt ${attempt} after ${timeout} milliseconds`)),
            timeout
          )
        ),
      ]);
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
export class RetryLimitReachedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RetryLimitReachedError";
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
