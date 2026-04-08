import { IO } from "./io";

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

  /**
   * Optional. A randomization factor between 0 and 1.
   * If set, adds random jitter to the delay to prevent thundering herd problems.
   * For example, a factor of 0.1 adds up to +/- 10% variation to the delay.
   */
  readonly jitter?: number;
}

/**
 * Provides a default policy configuration.
 *
 * @param {number} recurs - The maximum number of retries.
 * @param {number} factor - The factor by which the delay increases after each retry.
 * @param {number} delay - The initial delay before the first retry, in milliseconds.
 * @param {number} [timeout] - The optional timeout for each attempt, in milliseconds.
 * @param {number} [jitter] - The randomization factor (0-1). Defaults to 0.
 * @returns {Policy} The default policy.
 */
export const defaultPolicy = (
  recurs: number = 3,
  factor: number = 1.2,
  delay: number = 1000,
  timeout?: number,
  jitter: number = 0
): Policy => {
  return { recurs, factor, delay, timeout, jitter };
};

/**
 * Creates a delay promise that resolves after `ms` milliseconds, or rejects
 * immediately if the signal is already aborted or fires during the delay.
 */
const abortableDelay = <E>(ms: number, signal: AbortSignal, liftE: (error: Error) => E): Promise<void> =>
  new Promise<void>((resolve, reject) => {
    if (signal.aborted) {
      reject(liftE(new CancellationError("Operation was cancelled")));
      return;
    }

    const timeoutId = setTimeout(() => {
      signal.removeEventListener("abort", onAbort);
      resolve();
    }, ms);

    function onAbort() {
      clearTimeout(timeoutId);
      reject(liftE(new CancellationError("Operation was cancelled")));
    }

    signal.addEventListener("abort", onAbort, { once: true });
  });

/**
 * Represents a scheduling strategy for retrying asynchronous operations.
 *
 * Schedule integrates with IO's cancellation model through `AbortSignal`. When an IO
 * running a scheduled operation is cancelled (via `fiber.cancel()` or `IO.timeout`),
 * the signal propagates into the schedule's delay loops and aborts them immediately.
 *
 * The manual `cancel()` method is still supported for standalone usage outside IO.
 *
 * @template A - The type of the result returned by the asynchronous operations.
 */
export class Schedule {
  private readonly policy: Policy;
  private readonly controller: AbortController = new AbortController();

  /**
   * Constructs a new Schedule instance.
   *
   * @param {Policy} policy - The scheduling policy to use for retries.
   */
  constructor(policy: Policy = defaultPolicy()) {
    if (policy.recurs !== Infinity && (!Number.isFinite(policy.recurs) || policy.recurs < 1)) {
      throw new PolicyValidationError("Policy validation error: 'recurs' must be a positive number >= 1 (or Infinity)");
    }
    if (!Number.isFinite(policy.factor) || policy.factor < 1) {
      throw new PolicyValidationError("Policy validation error: 'factor' must be a finite number >= 1");
    }
    if (!Number.isFinite(policy.delay) || policy.delay < 0) {
      throw new PolicyValidationError("Policy validation error: 'delay' must be a finite non-negative number");
    }
    if (policy.timeout !== undefined && (!Number.isFinite(policy.timeout) || policy.timeout < 0)) {
      throw new PolicyValidationError("Policy validation error: 'timeout' must be a finite non-negative number");
    }
    if (policy.jitter !== undefined && (!Number.isFinite(policy.jitter) || policy.jitter < 0 || policy.jitter > 1)) {
      throw new PolicyValidationError("Policy validation error: 'jitter' must be a finite number between 0 and 1");
    }
    this.policy = policy;
  }

  /**
   * @experimental
   *
   * Wraps an IO operation with retry logic based on a defined policy and a specific condition.
   * The operation is retried with an increasing delay, which grows according to the policy factor.
   * If an operation exceeds the retry limit or fails due to other reasons, a RetryError is thrown.
   *
   * Cancellation is supported through two mechanisms:
   * - **IO signal**: When the IO running this schedule is cancelled (fiber, timeout), the AbortSignal
   *   propagates and aborts any in-progress delay immediately.
   * - **Manual cancel()**: Calling `schedule.cancel()` aborts the internal controller, which has the
   *   same effect.
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
    const manualSignal = this.controller.signal;

    return IO.cancellable<E, A>(
      async (ioSignal: AbortSignal) => {
        // Merge IO signal and manual cancel signal: abort when either fires
        const merged = new AbortController();
        const abortMerged = () => merged.abort();

        if (ioSignal.aborted || manualSignal.aborted) {
          throw liftE(new CancellationError("Operation was cancelled"));
        }

        ioSignal.addEventListener("abort", abortMerged, { once: true });
        manualSignal.addEventListener("abort", abortMerged, { once: true });

        try {
          let attempt = 0;
          let delay = policy.delay;

          while (attempt < policy.recurs) {
            if (merged.signal.aborted) {
              throw liftE(new CancellationError("Operation was cancelled"));
            }

            const result = await this.withTimeout(eff, liftE).unsafeRun();
            if (result.type === "Ok") {
              return result.value;
            }
            const error = result.error;

            let shouldRetry: boolean;
            try {
              shouldRetry = condition(error);
            } catch (conditionError) {
              throw liftE(
                new ConditionalRetryError(
                  `Retry condition threw: ${conditionError instanceof Error ? conditionError.message : String(conditionError)}`
                )
              );
            }

            if (!shouldRetry) {
              throw liftE(new ConditionalRetryError(`Retry condition not met: ${error}`));
            }
            if (attempt >= policy.recurs - 1) {
              throw liftE(new RetryError(`Retry limit reached without success: ${error}`));
            }

            await abortableDelay(this.applyJitter(delay), merged.signal, liftE);

            delay *= policy.factor;
            attempt++;
          }
          throw liftE(new RetryError("Retry limit reached without success"));
        } finally {
          ioSignal.removeEventListener("abort", abortMerged);
          manualSignal.removeEventListener("abort", abortMerged);
        }
      },
      (e: unknown) => (isLiftedError<E>(e) ? e : liftE(e instanceof Error ? e : new Error(String(e))))
    );
  }

  /**
   * @experimental
   *
   * Repeats the execution of an IO action based on a defined scheduling policy.
   * If the IO action succeeds, it is executed again until it either fails or the policy determines the execution should stop.
   *
   * Cancellation is supported through both the IO signal and `schedule.cancel()`.
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
    const manualSignal = this.controller.signal;

    return IO.cancellable<E, A>(
      async (ioSignal: AbortSignal) => {
        const merged = new AbortController();
        const abortMerged = () => merged.abort();

        if (ioSignal.aborted || manualSignal.aborted) {
          throw liftE(new CancellationError("Operation was cancelled"));
        }

        ioSignal.addEventListener("abort", abortMerged, { once: true });
        manualSignal.addEventListener("abort", abortMerged, { once: true });

        try {
          let hasResult = false;
          let lastSuccessResult: A | undefined;
          let delay = policy.delay;

          for (let attempt = 0; attempt < policy.recurs; attempt++) {
            if (merged.signal.aborted) {
              throw liftE(new CancellationError("Operation was cancelled"));
            }

            const result = await this.withTimeout(eff, liftE).unsafeRun();

            if (result.type === "Ok") {
              hasResult = true;
              lastSuccessResult = result.value;

              if (attempt < policy.recurs - 1) {
                await abortableDelay(this.applyJitter(delay), merged.signal, liftE);
                delay *= policy.factor;
              }
            } else {
              throw liftE(new RepeatError(`Failed to execute repeat: ${result.error}`));
            }
          }

          if (hasResult) {
            return lastSuccessResult as A;
          }

          throw liftE(new RepeatError("The function provided never succeeded"));
        } finally {
          ioSignal.removeEventListener("abort", abortMerged);
          manualSignal.removeEventListener("abort", abortMerged);
        }
      },
      (e: unknown) => (isLiftedError<E>(e) ? e : liftE(e instanceof Error ? e : new Error(String(e))))
    );
  }

  /**
   * @experimental
   *
   * Wraps an IO operation with an optional timeout configured by the scheduler policy.
   * If a valid timeout is provided and the operation exceeds this time,
   * it encapsulates a TimeoutError within the IO instance.
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

    return IO.lift<E, A>(async () => {
      let timeoutId: NodeJS.Timeout | null = null;
      let settled = false;

      const timeoutP = new Promise<A>((_, reject) => {
        timeoutId = setTimeout(() => {
          if (settled) return;
          settled = true;
          reject(liftE(new TimeoutError(`The operation timed out after ${timeout} milliseconds`)));
        }, timeout);
      });

      const opP = eff.unsafeRun().then((result) => {
        if (settled) return result.type === "Ok" ? result.value : Promise.reject(result.error);
        settled = true;
        if (timeoutId) clearTimeout(timeoutId);
        switch (result.type) {
          case "Ok":
            return result.value;
          case "Err":
            return Promise.reject(result.error);
        }
      });

      try {
        return await Promise.race([opP, timeoutP]);
      } catch (error) {
        if (timeoutId) clearTimeout(timeoutId);
        return Promise.reject(error);
      }
    });
  }

  /**
   * Cancels the ongoing scheduled operation. Aborts any in-progress delay immediately.
   *
   * This works both when the schedule is used standalone and when it's running inside an IO.
   * For IO-managed schedules (via `retryIf` on IO), cancellation through `fiber.cancel()` or
   * `IO.timeout` is preferred — it automatically propagates through the AbortSignal.
   *
   * @example
   * const schedule = new Schedule();
   * const operation = schedule.retryIf(eff, () => true, e => e);
   *
   * setTimeout(() => schedule.cancel(), 150);
   * const result = await operation.unsafeRun();
   */
  cancel(): void {
    this.controller.abort();
  }

  private applyJitter(delay: number): number {
    if (!this.policy.jitter) return delay;
    const amount = delay * this.policy.jitter;
    const offset = (Math.random() * 2 - 1) * amount;
    return Math.max(0, delay + offset);
  }
}

/**
 * Type guard: returns true if the value was already lifted through `liftE` and should not be double-wrapped.
 * We detect this by checking if the value is NOT a plain Error subclass from this module.
 */
const isLiftedError = <E>(e: unknown): e is E =>
  !(
    e instanceof CancellationError ||
    e instanceof RetryError ||
    e instanceof RepeatError ||
    e instanceof ConditionalRetryError ||
    e instanceof TimeoutError ||
    e instanceof PolicyValidationError
  );

/**
 * Represents an error related to invalid scheduling policy configurations.
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
 * @extends Error
 */
export class TimeoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TimeoutError";
  }
}

/**
 * Represents an error that occurs when a retry condition is not met or the condition function itself throws.
 * @extends Error
 */
export class ConditionalRetryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConditionalRetryError";
  }
}

/**
 * Represents an error that occurs when the maximum number of retries is reached.
 * @extends Error
 */
export class RetryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RetryError";
  }
}

/**
 * Represents an error that occurs during the repetition of an operation.
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
 * @extends Error
 */
export class CancellationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CancellationError";
  }
}
