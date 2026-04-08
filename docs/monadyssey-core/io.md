# IO

`IO<E, A>` is a lazy, composable description of an effectful computation that may succeed with a value of type `A` or fail with an error of type `E`.

Nothing runs until you call a terminal method like `unsafeRun()`. Until then, `IO` is just a value — you can pass it around, compose it, and test it without triggering side effects.

Internally, `IO` builds an immutable tree of operations (an ADT). When executed, a trampoline interpreter walks the tree with an explicit stack, so arbitrarily deep chains are stack-safe.

```typescript
import { IO } from "monadyssey";
```

---

## Table of Contents

- [Creating IOs](#creating-ios)
- [Transforming Values](#transforming-values)
- [Error Handling](#error-handling)
- [Side Effects](#side-effects)
- [Validation](#validation)
- [Resource Safety](#resource-safety)
- [Timeout](#timeout)
- [Composition](#composition)
- [Parallelism](#parallelism)
- [Cancellation](#cancellation)
- [Scheduling](#scheduling)
- [Running](#running)
- [Result Types](#result-types)

---

## Creating IOs

### `IO.lift`

Wraps a synchronous or asynchronous function into an IO. The function is not called until the IO is executed.

```typescript
static lift<E, A>(f: (signal?: AbortSignal) => A | Promise<A>, liftE?: (e: unknown) => E): IO<E, A>
```

```typescript
// Sync
const effect = IO.lift(() => 42);

// Async
const effect = IO.lift(() => fetch("/api/data").then(r => r.json()));

// With error transformation
const effect = IO.lift(
  () => riskyOperation(),
  (e) => new AppError(String(e))
);
```

The optional `liftE` parameter transforms caught exceptions into the error type `E`. Without it, the raw exception is placed in the error channel.

---

### `IO.pure`

Wraps an already-computed value. No deferred computation takes place.

```typescript
static pure<A>(a: A): IO<never, A>
```

```typescript
const effect = IO.pure(42);
// result: { type: "Ok", value: 42 }
```

---

### `IO.fail`

Creates an IO that fails immediately with the given error.

```typescript
static fail<E, A = never>(error: E): IO<E, A>
```

```typescript
const effect = IO.fail(new AppError("not found"));
// result: { type: "Err", error: AppError("not found") }
```

---

### `IO.unit`

An IO that succeeds with `void`. Useful as a no-op.

```typescript
static readonly unit: IO<never, void>
```

---

### `IO.cancellable`

Creates an IO from a function that receives an `AbortSignal` for cooperative cancellation. Use this when the underlying operation supports cancellation (fetch, streams, timers).

```typescript
static cancellable<E, A>(f: (signal: AbortSignal) => A | Promise<A>, liftE?: (e: unknown) => E): IO<E, A>
```

```typescript
const operation = IO.cancellable<AppError, Response>(
  (signal) => fetch("/api/data", { signal }),
  (e) => new AppError(String(e))
);
```

See [Cancellation](#cancellation) for details on how this works with `fork()`.

---

## Transforming Values

### `map`

Transforms the success value. If the IO fails, the function is not called.

```typescript
map<B>(f: (a: A) => B): IO<E, B>
```

```typescript
const effect = IO.lift(() => 21).map(n => n * 2);
// result: { type: "Ok", value: 42 }
```

---

### `flatMap`

Chains a dependent IO on the success value. This is monadic bind — each step can depend on the previous result.

```typescript
flatMap<B>(f: (a: A) => IO<E, B>): IO<E, B>
```

```typescript
const operation = IO.lift(() => fetchUserId())
  .flatMap(id => IO.lift(() => fetchUser(id)));
```

---

### `bimap`

Transforms both the error and success channels at the same time.

```typescript
bimap<F, B>(fe: (e: E) => F, fa: (a: A) => B): IO<F, B>
```

```typescript
const effect = IO.lift(() => 42).bimap(
  err => `Error: ${err}`,
  val => val * 2
);
```

---

## Error Handling

### `mapErr`

Transforms the error value. If the IO succeeds, the function is not called.

```typescript
mapErr<F>(f: (e: E) => F): IO<F, A>
```

```typescript
const effect = IO.lift(() => { throw new Error("boom"); })
  .mapErr(e => new AppError(e.message));
```

---

### `flatMapErr`

Chains a dependent IO on the error value. Use this for error recovery — the returned IO can succeed or fail with a new error.

```typescript
flatMapErr(f: (error: E) => IO<E, A>): IO<E, A>
```

```typescript
const operation = IO.fail("primary failed")
  .flatMapErr(err => IO.lift(() => fetchFromFallback()));
```

---

### `foldM`

Monadic fold — branches on both success and error, where each arm returns a new IO. Unlike `fold` (which is terminal), `foldM` produces a composable IO.

```typescript
foldM<F, B>(onErr: (e: E) => IO<F, B>, onOk: (a: A) => IO<F, B>): IO<F, B>
```

```typescript
const effect = IO.lift(() => riskyOp()).foldM(
  err => IO.fail(`Recovered: ${err}`),
  val => IO.pure(val * 2)
);
```

---

## Side Effects

### `tap`

Runs a side effect on the success value without changing the result. If the side effect throws, the exception is swallowed.

```typescript
tap(f: (a: A) => void | Promise<void>): IO<E, A>
```

```typescript
const effect = IO.lift(() => 42).tap(value => console.log("Got:", value));
```

---

### `tapErr`

Runs a side effect on the error value without changing the result. If the side effect throws, the exception is swallowed.

```typescript
tapErr(f: (e: E) => void | Promise<void>): IO<E, A>
```

```typescript
const effect = IO.fail(new AppError("boom"))
  .tapErr(e => logger.error(e));
```

---

## Validation

### `ensure`

Validates the success value against a predicate. If the predicate returns `false`, the value is converted into an error using `liftE`.

```typescript
ensure(predicate: (a: A) => boolean, liftE: (a: A) => E): IO<E, A>
```

```typescript
const effect = IO.lift(() => fetchAge())
  .ensure(
    age => age >= 18,
    age => new ValidationError(`Must be 18+, got ${age}`)
  );
```

---

## Resource Safety

### `IO.bracket`

Guarantees resource cleanup by structuring code into three phases: **acquire**, **use**, and **release**. The release action always runs — whether use succeeds, fails, or is cancelled.

```typescript
static bracket<E, R, A>(
  acquire: IO<E, R>,
  use: (r: R) => IO<E, A>,
  release: (r: R) => IO<never, void>
): IO<E, A>
```

```typescript
const operation = IO.bracket(
  IO.lift(() => openConnection()),
  (conn) => IO.lift(() => conn.query("SELECT * FROM users")),
  (conn) => IO.lift(() => conn.close())
);
```

Semantics:
- If **acquire** fails or is cancelled, `use` and `release` are never called.
- If **use** succeeds, fails, or is cancelled, `release` always runs.
- **Release** runs without an `AbortSignal` — it always completes.
- If release itself fails, the error is swallowed and the use result takes priority.

Brackets nest correctly — inner resources are released before outer ones:

```typescript
const operation = IO.bracket(
  acquirePool(),
  (pool) => IO.bracket(
    acquireConnection(pool),
    (conn) => queryUsers(conn),
    (conn) => IO.lift(() => conn.release())
  ),
  (pool) => IO.lift(() => pool.shutdown())
);
```

---

## Timeout

### `timeout`

Applies a deadline to an IO. If the computation does not complete within `ms` milliseconds, it is cancelled and the error produced by `onTimeout` is returned.

```typescript
timeout<F>(ms: number, onTimeout: () => F): IO<E | F, A>
```

```typescript
const operation = IO.lift(() => fetch("/api/slow"))
  .timeout(5000, () => new TimeoutError("Request exceeded 5s"));
```

The timeout error type `F` is unioned with the original error type `E`, so the caller must handle both.

The underlying computation is cancelled via `AbortSignal` when the timeout fires. If the computation completes before the deadline, the timer is cleared.

```typescript
// Composable with mapErr to unify error types
const operation = fetchUser(id)
  .timeout(3000, () => ({ code: "TIMEOUT" as const }))
  .mapErr(e => normalizeError(e));
```

---

## Composition

### `IO.Do`

Do-notation for sequencing IO operations using async/await style. Call `bind(io)` to execute an IO and get its value. If any bound IO fails, the entire block short-circuits.

```typescript
static Do<E, A>(
  operation: (bind: <B>(effect: IO<E, B>) => Promise<B>) => Promise<A>,
  liftE?: (e: unknown) => E
): IO<E, A>
```

```typescript
const operation = IO.Do<AppError, CurrentConditions>(async bind => {
  const location = await bind(getCurrentLocation());
  const [lat, lon] = await bind(getLatitudeAndLongitude(location));
  const weather = await bind(getCurrentWeatherData(lat, lon));
  return mapToConditions(location, weather);
});
```

This is equivalent to nested `flatMap` calls but more readable. The optional `liftE` parameter transforms non-IO exceptions thrown inside the block into the error type `E`.

---

### `IO.traverse`

Sequentially runs a function over each item, collecting results. Fail-fast — stops on the first error.

```typescript
static traverse<E, A, B>(items: A[], f: (a: A) => IO<E, B>): IO<E, B[]>
```

```typescript
const operation = IO.traverse([1, 2, 3], id => fetchUser(id));
```

---

### `IO.sequence`

Sequentially runs an array of IOs, collecting results. Equivalent to `traverse(ios, x => x)`.

```typescript
static sequence<E, A>(ios: IO<E, A>[]): IO<E, A[]>
```

---

## Parallelism

### `IO.parMapN`

Runs multiple IOs in parallel and combines their results with a function. If any fail, all errors are collected into a `NonEmptyList`.

```typescript
// 2-6 IO overloads available
static parMapN<E1, E2, A1, A2, R>(
  io1: IO<E1, A1>,
  io2: IO<E2, A2>,
  f: (a1: A1, a2: A2) => R
): IO<NonEmptyList<E1 | E2>, R>
```

```typescript
const operation = IO.parMapN(
  IO.lift(() => fetchUser()),
  IO.lift(() => fetchOrders()),
  (user, orders) => ({ user, orders })
);
```

---

### `IO.parTraverse`

Runs a function over each item in parallel, collecting all results or all errors.

```typescript
static parTraverse<E, A, B>(items: A[], f: (a: A) => IO<E, B>): IO<NonEmptyList<E>, B[]>
```

---

### `IO.parSequence`

Runs an array of IOs in parallel, collecting all results or all errors.

```typescript
static parSequence<E, A>(ios: IO<E, A>[]): IO<NonEmptyList<E>, A[]>
```

---

### `IO.race`

Races multiple IOs. Returns the first one to succeed. If all fail, returns a `NonEmptyList` of all errors.

```typescript
static race<E, A>(...ops: IO<E, A>[]): IO<NonEmptyList<E>, A>
```

```typescript
const operation = IO.race(
  IO.lift(() => fetchFromPrimary()),
  IO.lift(() => fetchFromFallback())
);
```

When one IO succeeds, the remaining IOs are cancelled via `AbortSignal`.

---

## Cancellation

IO supports structural cancellation through `Fiber`, `fork()`, and `AbortSignal`.

### `fork`

Starts an IO as a background computation, returning a `Fiber` handle.

```typescript
fork(): IO<never, Fiber<E, A>>
```

```typescript
const operation = IO.Do<AppError, string>(async bind => {
  const fiber = await bind(longRunningTask.fork());
  // ... do other work ...
  const result = await fiber.join();
  return result.type === "Ok" ? result.value : "fallback";
});
```

### `Fiber<E, A>`

The handle returned by `fork()`:

```typescript
interface Fiber<E, A> {
  join: () => Promise<Ok<A> | Err<E> | Cancelled>;
  cancel: () => Promise<void>;
  signal: AbortSignal;
}
```

- `join()` waits for the computation to complete. Returns `Ok`, `Err`, or `Cancelled`.
- `cancel()` requests cancellation. Idempotent. Resolves after finalizers run.
- `signal` exposes the underlying `AbortSignal` for interop with platform APIs.

### `onCancel`

Registers a cleanup action that runs only if the IO is cancelled. Finalizers run in LIFO order (innermost first).

```typescript
onCancel(finalizer: () => void | Promise<void>): IO<E, A>
```

```typescript
const operation = IO.cancellable((signal) => fetch("/api", { signal }))
  .onCancel(() => console.log("Request was cancelled"));
```

### How cancellation works

1. `fork()` creates an `AbortController` and runs the IO with its signal.
2. `cancel()` calls `controller.abort()`.
3. The interpreter checks `signal.aborted` between each step in the computation tree.
4. When cancelled, `OnCancel` finalizers on the stack are run in LIFO order.
5. `join()` returns `{ type: "Cancelled" }`.

For IOs created with `IO.lift`, cancellation is **structural** — checked between frames. For IOs created with `IO.cancellable`, cancellation is **cooperative** — the signal is passed to user code (e.g., `fetch(url, { signal })`), allowing the operation itself to abort.

`unsafeRun()` does not pass a signal, so cancellation only applies to forked computations.

---

## Scheduling

### `retryIf`

Retries the IO when a condition on the error is met, using a scheduling policy with configurable delay, backoff factor, and jitter.

```typescript
retryIf(
  condition: (error: E) => boolean,
  liftE: (error: Error) => E,
  policy?: Policy
): IO<E, A>
```

```typescript
const operation = IO.lift(() => fetchData())
  .retryIf(
    err => err instanceof NetworkError,
    e => new AppError(e.message),
    { recurs: 5, delay: 1000, factor: 2 }
  );
```

The default policy is 3 retries, 1.2x backoff, 1s initial delay.

`liftE` transforms schedule errors (`RetryError`, `TimeoutError`, `ConditionalRetryError`) into the error type `E`.

See `Policy` for all options: `recurs`, `factor`, `delay`, `timeout` (per-attempt), `jitter`.

---

## Running

These are terminal methods — they execute the IO and return a result.

### `unsafeRun`

Executes the IO and returns the structured result.

```typescript
async unsafeRun(): Promise<Ok<A> | Err<E>>
```

```typescript
const result = await IO.lift(() => 42).unsafeRun();
// { type: "Ok", value: 42 }
```

---

### `fold`

Executes the IO and maps both outcomes into a single type.

```typescript
async fold<B>(onErr: (e: E) => B, onOk: (a: A) => B): Promise<B>
```

```typescript
const message = await IO.lift(() => 42).fold(
  err => `Failed: ${err}`,
  val => `Got: ${val}`
);
```

---

### `getOrNull`

Returns the success value, or `null` on failure.

```typescript
async getOrNull(): Promise<A | null>
```

---

### `getOrElse`

Returns the success value, or evaluates a default on failure.

```typescript
async getOrElse(defaultValue: () => A): Promise<A>
```

```typescript
const value = await IO.fail("err").getOrElse(() => 0); // 0
```

---

### `getOrHandleErr`

Returns the success value, or applies a handler to the error.

```typescript
async getOrHandleErr(handler: (error: E) => A): Promise<A>
```

```typescript
const value = await IO.fail(new AppError("boom"))
  .getOrHandleErr(e => fallbackValue(e));
```

---

## Result Types

```typescript
interface Ok<A>  { type: "Ok";  value: A }
interface Err<E> { type: "Err"; error: E }
interface Cancelled { type: "Cancelled" }
```

`unsafeRun()` returns `Ok<A> | Err<E>`.

`Fiber.join()` returns `Ok<A> | Err<E> | Cancelled`.

Convenience constructors:

```typescript
IO.ok(42)          // { type: "Ok", value: 42 }
IO.err("not found") // { type: "Err", error: "not found" }
```
