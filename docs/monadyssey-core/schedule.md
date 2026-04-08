# Schedule

`Schedule` controls how IO operations are retried or repeated over time. It combines a `Policy` (how many times, how long to wait, how fast to back off) with execution logic that handles delays, timeouts, and cancellation.

Most users interact with Schedule indirectly through `IO.retryIf`. Direct use is needed when you want to `repeat` an operation or `cancel` a running schedule.

```typescript
import { Schedule, Policy } from "monadyssey";
```

---

## Table of Contents

- [Policy](#policy)
- [Creating a Schedule](#creating-a-schedule)
- [retryIf](#retryif)
- [repeat](#repeat)
- [Per-Attempt Timeout](#per-attempt-timeout)
- [Cancellation](#cancellation)
- [Error Types](#error-types)
- [Integration with IO](#integration-with-io)

---

## Policy

A `Policy` defines the behavior of a schedule:

```typescript
interface Policy {
  recurs: number;       // Max attempts. Must be >= 1 (or Infinity).
  factor: number;       // Backoff multiplier. Must be >= 1.
  delay: number;        // Initial delay in ms between attempts. Must be >= 0.
  timeout?: number;     // Per-attempt timeout in ms. Optional.
  jitter?: number;      // Random variation factor, 0–1. Optional.
}
```

### `recurs`

The maximum number of attempts. Set to `Infinity` for unbounded retry/repeat (pair with `cancel()` to stop).

### `factor`

The multiplier applied to the delay after each attempt. With `delay: 100` and `factor: 2`, delays are 100ms, 200ms, 400ms, 800ms, etc.

A factor of `1` means constant delay (no backoff).

### `delay`

The initial wait time in milliseconds before the second attempt. The first attempt runs immediately.

### `timeout`

If set, each individual attempt is wrapped in a timeout. If an attempt takes longer than this, it is abandoned and counts as a failure with `TimeoutError`.

This is a per-attempt timeout, not a total timeout. A policy with `recurs: 3` and `timeout: 1000` allows up to 3 seconds total (plus delays).

For a total timeout on the entire operation, use `IO.timeout()` instead.

### `jitter`

Adds random variation to the delay to prevent thundering herd problems. A jitter of `0.1` adds up to +/- 10% to each delay. Set to `0` (default) for deterministic delays.

### Default Policy

```typescript
import { defaultPolicy } from "monadyssey";

const policy = defaultPolicy();
// { recurs: 3, factor: 1.2, delay: 1000, jitter: 0 }
```

`defaultPolicy` accepts optional overrides for each field:

```typescript
const policy = defaultPolicy(5, 2, 500, 3000, 0.1);
// { recurs: 5, factor: 2, delay: 500, timeout: 3000, jitter: 0.1 }
```

### Validation

The `Schedule` constructor validates the policy and throws `PolicyValidationError` for invalid values:

- `recurs` must be a positive number >= 1, or `Infinity`
- `factor` must be a finite number >= 1
- `delay` must be a finite non-negative number
- `timeout` (if set) must be a finite non-negative number
- `jitter` (if set) must be a finite number between 0 and 1
- `NaN` is rejected for all fields

---

## Creating a Schedule

```typescript
const schedule = new Schedule({ recurs: 5, factor: 2, delay: 200 });
```

Or with the default policy:

```typescript
const schedule = new Schedule();
```

---

## retryIf

Retries an IO when a condition on the error is met. Stops when the operation succeeds, the condition returns `false`, or the retry limit is reached.

```typescript
retryIf<E, A>(
  eff: IO<E, A>,
  condition: (error: E) => boolean,
  liftE: (error: Error) => E
): IO<E, A>
```

```typescript
const schedule = new Schedule({ recurs: 5, factor: 2, delay: 200 });

const operation = schedule.retryIf(
  IO.lift(() => fetchData()),
  (err) => err instanceof NetworkError,    // only retry network errors
  (e) => new AppError(e.message)           // transform schedule errors into AppError
);

const result = await operation.unsafeRun();
```

### How it works

1. Run the operation.
2. If it succeeds, return the result.
3. If it fails, call `condition(error)`.
   - If `condition` returns `false`, fail with `ConditionalRetryError` (through `liftE`).
   - If `condition` returns `true` and attempts remain, wait (with backoff + jitter), then go to step 1.
   - If `condition` returns `true` but attempts are exhausted, fail with `RetryError` (through `liftE`).

### The `liftE` parameter

Schedule produces its own error types (`RetryError`, `TimeoutError`, `ConditionalRetryError`, `CancellationError`) which extend `Error`. The `liftE` function transforms these into your domain error type `E`:

```typescript
type AppError = { code: string; message: string };

const liftE = (e: Error): AppError => ({ code: "SCHEDULE", message: e.message });
```

If the `condition` function itself throws, the exception is caught and wrapped as a `ConditionalRetryError` through `liftE`.

---

## repeat

Runs an IO a fixed number of times, returning the last successful result. If any execution fails, the repeat stops immediately.

```typescript
repeat<E, A>(
  eff: IO<E, A>,
  liftE: (error: Error) => E
): IO<E, A>
```

```typescript
const schedule = new Schedule({ recurs: 10, factor: 1, delay: 1000 });

const operation = schedule.repeat(
  IO.lift(() => pollForUpdates()),
  (e) => new AppError(e.message)
);
```

### Backoff in repeat

The `factor` field applies to repeat delays just like retry. With `delay: 100` and `factor: 2`, the gaps between executions are 100ms, 200ms, 400ms, etc.

### Null and void results

`repeat` correctly handles operations that return `null`, `undefined`, or `void`. The last successful result is always returned, regardless of its value.

---

## Per-Attempt Timeout

When a `Policy` includes a `timeout` value, each individual attempt is wrapped in a `Promise.race` against a timer. If the attempt exceeds the timeout, it fails with `TimeoutError`.

```typescript
const schedule = new Schedule({
  recurs: 3,
  factor: 1.2,
  delay: 500,
  timeout: 2000    // each attempt gets 2 seconds
});
```

This timeout is per-attempt. The total time can be up to `recurs * timeout + total_delays`. For a hard deadline on the entire operation, wrap the result in `IO.timeout()`:

```typescript
const operation = schedule.retryIf(eff, condition, liftE)
  .timeout(10000, () => new AppError("Total deadline exceeded"));
```

---

## Cancellation

Schedule supports two cancellation mechanisms that both propagate through `AbortSignal`:

### IO signal (fiber / timeout)

When a Schedule operation runs inside an IO, cancelling the IO (via `fiber.cancel()` or `IO.timeout`) propagates the `AbortSignal` into the schedule's delay loops. In-progress delays are aborted immediately — no time is wasted waiting for the next check point.

```typescript
const schedule = new Schedule({ recurs: 10, factor: 2, delay: 1000 });

const operation = schedule.retryIf(
  IO.lift(() => fetchData()),
  (err) => err instanceof NetworkError,
  (e) => new AppError(e.message)
);

const fiber = await operation.fork().getOrNull();

// Later: cancel the fiber — aborts the current delay immediately
await fiber!.cancel();

const result = await fiber!.join();
// result: { type: "Cancelled" }
```

Combined with `IO.timeout` for a hard deadline on the entire retry sequence:

```typescript
const operation = schedule.retryIf(eff, condition, liftE)
  .timeout(10000, () => new AppError("Total deadline exceeded"));
```

### Manual cancel

Calling `schedule.cancel()` aborts the internal `AbortController`, which has the same immediate effect on in-progress delays. This works both standalone and when the schedule is running inside an IO.

```typescript
const schedule = new Schedule({ recurs: Infinity, factor: 1, delay: 1000 });

const operation = schedule.repeat(
  IO.lift(() => pollForStatus()),
  (e) => new AppError(e.message)
);

// Cancel after 30 seconds
setTimeout(() => schedule.cancel(), 30000);

const result = await operation.unsafeRun();
// result: { type: "Err", error: AppError("Operation was cancelled") }
```

Manual cancellation produces a `CancellationError` which is transformed through `liftE` into the error type `E`. IO signal cancellation produces a `Cancelled` result directly.

### Signal merging

Internally, `retryIf` and `repeat` merge the IO signal and the manual cancel signal into a single `AbortController`. Either signal firing aborts the merged controller, which immediately resolves any pending `abortableDelay`. Event listeners are cleaned up in a `finally` block to prevent leaks.

---

## Error Types

All schedule errors extend `Error` and are exported from `monadyssey`:

```typescript
import {
  RetryError,
  TimeoutError,
  ConditionalRetryError,
  RepeatError,
  CancellationError,
  PolicyValidationError
} from "monadyssey";
```

| Error | When |
|---|---|
| `RetryError` | All retry attempts exhausted without success |
| `TimeoutError` | A single attempt exceeded the per-attempt timeout |
| `ConditionalRetryError` | The retry condition returned `false`, or the condition function threw |
| `RepeatError` | A repeated operation failed, or repeat completed with no result |
| `CancellationError` | `schedule.cancel()` was called during execution |
| `PolicyValidationError` | Invalid policy passed to `new Schedule()` — thrown synchronously |

All errors except `PolicyValidationError` pass through `liftE` before reaching the IO error channel.

---

## Integration with IO

Most users don't create a `Schedule` directly. Instead, use `IO.retryIf`, which creates a schedule internally:

```typescript
const operation = IO.lift(() => fetchData())
  .retryIf(
    (err) => err instanceof NetworkError,
    (e) => new AppError(e.message),
    { recurs: 5, delay: 1000, factor: 2 }
  );
```

This is equivalent to:

```typescript
const schedule = new Schedule({ recurs: 5, delay: 1000, factor: 2 });
const operation = schedule.retryIf(
  IO.lift(() => fetchData()),
  (err) => err instanceof NetworkError,
  (e) => new AppError(e.message)
);
```

Use `Schedule` directly when you need `repeat`, `cancel`, or want to share a single schedule instance across multiple operations.
