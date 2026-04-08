import { NonEmptyList } from "./non-empty-list";
// Circular dependency: schedule.ts imports IO from this module.
// Safe because both modules only reference each other's exports at runtime (inside methods),
// never at import/evaluation time. Do not add top-level code that uses Schedule eagerly.
import { defaultPolicy, Policy, Schedule } from "./schedule";

export interface Ok<A> {
  type: "Ok";
  value: A;
}

export interface Err<E> {
  type: "Err";
  error: E;
}

export interface Cancelled {
  type: "Cancelled";
}

export interface Fiber<E, A> {
  /** Wait for the computation to complete. */
  readonly join: () => Promise<Ok<A> | Err<E> | Cancelled>;
  /** Request cancellation. Idempotent. Resolves after finalizers run. */
  readonly cancel: () => Promise<void>;
  /** The underlying AbortSignal for interop with platform APIs. */
  readonly signal: AbortSignal;
}

type Node<E, A> =
  | { tag: "Pure"; value: A }
  | { tag: "Fail"; error: E }
  | { tag: "Lift"; run: (signal?: AbortSignal) => A | Promise<A>; liftE?: (e: unknown) => E }
  | { tag: "Map"; io: Node<any, any>; f: (a: any) => A }
  | { tag: "FlatMap"; io: Node<any, any>; f: (a: any) => IO<any, A> }
  | { tag: "MapErr"; io: Node<any, any>; f: (e: any) => E }
  | { tag: "FlatMapErr"; io: Node<any, any>; f: (e: any) => IO<E, A> }
  | { tag: "Tap"; io: Node<E, A>; f: (a: any) => void | Promise<void> }
  | { tag: "TapErr"; io: Node<E, A>; f: (e: any) => void | Promise<void> }
  | { tag: "Ensure"; io: Node<E, A>; predicate: (a: any) => boolean; liftE: (a: any) => E }
  | { tag: "FoldM"; io: Node<any, any>; onOk: (a: any) => IO<E, A>; onErr: (e: any) => IO<E, A> }
  | { tag: "OnCancel"; io: Node<E, A>; finalizer: () => void | Promise<void> };

type Frame =
  | { tag: "Map"; f: (a: any) => any }
  | { tag: "FlatMap"; f: (a: any) => IO<any, any> }
  | { tag: "MapErr"; f: (e: any) => any }
  | { tag: "FlatMapErr"; f: (e: any) => IO<any, any> }
  | { tag: "Tap"; f: (a: any) => void | Promise<void> }
  | { tag: "TapErr"; f: (e: any) => void | Promise<void> }
  | { tag: "FoldM"; onOk: (a: any) => IO<any, any>; onErr: (e: any) => IO<any, any> }
  | { tag: "Ensure"; predicate: (a: any) => boolean; liftE: (a: any) => any }
  | { tag: "OnCancel"; finalizer: () => void | Promise<void> };

/** Module-private key for IO's ADT node. Not exported — external code cannot access it. */
const NODE = Symbol("IO.node");

/** Module-private sentinel tag for typed error escape in Do/parMapN/race. */
const IO_ESCAPE = Symbol("IO.escape");

interface IOEscape<E> {
  readonly [IO_ESCAPE]: true;
  readonly error: E;
}

function ioEscape<E>(error: E): IOEscape<E> {
  return { [IO_ESCAPE]: true, error };
}

function isIOEscape(e: unknown): e is IOEscape<any> {
  return e != null && typeof e === "object" && IO_ESCAPE in (e as object);
}

/** Module-private sentinel for cancellation propagation through Lift boundaries. */
const IO_CANCELLED = Symbol("IO.cancelled");

interface IOCancelled {
  readonly [IO_CANCELLED]: true;
}

function ioCancelled(): never {
  throw { [IO_CANCELLED]: true } as IOCancelled;
}

function isIOCancelled(e: unknown): e is IOCancelled {
  return e != null && typeof e === "object" && IO_CANCELLED in (e as object);
}

function isThenable(value: unknown): value is PromiseLike<unknown> {
  return value != null && typeof (value as any).then === "function";
}

async function interpret<E, A>(root: Node<E, A>, signal?: AbortSignal): Promise<Ok<A> | Err<E> | Cancelled> {
  const stack: Frame[] = [];
  let cur: Node<any, any> = root;

  while (true) {
    if (signal?.aborted) {
      const finalizers: Array<() => void | Promise<void>> = [];
      while (stack.length > 0) {
        const frame = stack.pop()!;
        if (frame.tag === "OnCancel") {
          finalizers.push(frame.finalizer);
        }
      }
      for (const fin of finalizers) {
        try {
          const r = fin();
          if (isThenable(r)) await r;
        } catch {
          /* swallow */
        }
      }
      return { type: "Cancelled" };
    }

    switch (cur.tag) {
      case "Map":
        stack.push({ tag: "Map", f: cur.f });
        cur = cur.io;
        break;
      case "FlatMap":
        stack.push({ tag: "FlatMap", f: cur.f });
        cur = cur.io;
        break;
      case "MapErr":
        stack.push({ tag: "MapErr", f: cur.f });
        cur = cur.io;
        break;
      case "FlatMapErr":
        stack.push({ tag: "FlatMapErr", f: cur.f });
        cur = cur.io;
        break;
      case "Tap":
        stack.push({ tag: "Tap", f: cur.f });
        cur = cur.io;
        break;
      case "TapErr":
        stack.push({ tag: "TapErr", f: cur.f });
        cur = cur.io;
        break;
      case "FoldM":
        stack.push({ tag: "FoldM", onOk: cur.onOk, onErr: cur.onErr });
        cur = cur.io;
        break;
      case "Ensure":
        stack.push({ tag: "Ensure", predicate: cur.predicate, liftE: cur.liftE });
        cur = cur.io;
        break;
      case "OnCancel":
        stack.push({ tag: "OnCancel", finalizer: cur.finalizer });
        cur = cur.io;
        break;

      case "Lift": {
        const { run, liftE } = cur;
        try {
          const result = run(signal);
          const value = isThenable(result) ? await result : result;
          cur = { tag: "Pure", value };
        } catch (e) {
          if (isIOCancelled(e)) {
            // Child computation was cancelled — propagate by letting the
            // cancellation check at the top of the loop fire
            cur = { tag: "Pure", value: undefined }; // dummy, will be overridden
            break;
          }
          cur = { tag: "Fail", error: liftE ? liftE(e) : e };
        }
        break;
      }

      case "Pure": {
        if (stack.length === 0) return { type: "Ok", value: cur.value };

        const frame = stack.pop()!;
        switch (frame.tag) {
          case "Map":
            try {
              cur = { tag: "Pure", value: frame.f(cur.value) };
            } catch (e) {
              cur = { tag: "Fail", error: e };
            }
            break;
          case "FlatMap":
            try {
              cur = frame.f(cur.value)[NODE];
            } catch (e) {
              cur = { tag: "Fail", error: e };
            }
            break;
          case "Tap":
            try {
              const r = frame.f(cur.value);
              if (isThenable(r)) await r;
            } catch {
              // Side-effect failure is swallowed — tap preserves the original value
            }
            break;
          case "Ensure": {
            const val = cur.value;
            try {
              if (!frame.predicate(val)) {
                cur = { tag: "Fail", error: frame.liftE(val) };
              }
            } catch {
              // Predicate threw — treat as predicate failure to preserve typed error
              cur = { tag: "Fail", error: frame.liftE(val) };
            }
            break;
          }
          case "FoldM":
            try {
              cur = frame.onOk(cur.value)[NODE];
            } catch (e) {
              cur = { tag: "Fail", error: e };
            }
            break;
          // Error-only frames: pass through on Ok
          case "MapErr":
          case "FlatMapErr":
          case "TapErr":
          case "OnCancel":
            break;
        }
        break;
      }

      case "Fail": {
        if (stack.length === 0) return { type: "Err", error: cur.error };

        const frame = stack.pop()!;
        switch (frame.tag) {
          case "MapErr":
            try {
              cur = { tag: "Fail", error: frame.f(cur.error) };
            } catch (e) {
              cur = { tag: "Fail", error: e };
            }
            break;
          case "FlatMapErr":
            try {
              cur = frame.f(cur.error)[NODE];
            } catch (e) {
              cur = { tag: "Fail", error: e };
            }
            break;
          case "TapErr":
            try {
              const r = frame.f(cur.error);
              if (isThenable(r)) await r;
            } catch {
              // Side-effect failure is swallowed — tapErr preserves the original error
            }
            break;
          case "FoldM":
            try {
              cur = frame.onErr(cur.error)[NODE];
            } catch (e) {
              cur = { tag: "Fail", error: e };
            }
            break;
          // Ok-only frames: pass through on Err
          case "Map":
          case "FlatMap":
          case "Tap":
          case "Ensure":
          case "OnCancel":
            break;
        }
        break;
      }
    }
  }
}

/**
 * `IO<E, A>` represents a lazy, composable description of an effectful computation
 * that may succeed with a value of type `A` or fail with an error of type `E`.
 *
 * Computations are described as an immutable ADT tree and only executed when
 * `unsafeRun()` is called. The interpreter uses an explicit stack (trampoline)
 * to evaluate the tree, ensuring stack safety for arbitrarily deep chains.
 */
export class IO<E, A> {
  /** @internal Keyed by module-private Symbol — inaccessible to external code. */
  readonly [NODE]: Node<E, A>;

  /** @internal */
  private constructor(node: Node<E, A>) {
    this[NODE] = node;
  }

  /**
   * @internal Type-erased constructor for combinators that change E or A.
   * Use `new IO(...)` when the return type matches `IO<E, A>` (same types).
   * Use `IO.wrap(...)` when the combinator changes E or A (e.g. map, flatMap, mapErr, foldM).
   */
  private static wrap<E, A>(node: Node<any, any>): IO<E, A> {
    return new IO<E, A>(node as Node<E, A>);
  }

  /**
   * Creates an IO from an effectful function that may be synchronous or asynchronous.
   * The function is not executed until `unsafeRun()` is called on the resulting IO,
   * preserving laziness. The interpreter detects whether the return value is a
   * Promise at runtime and awaits only when necessary.
   *
   * If the function throws (or the returned Promise rejects), the error is captured
   * as the `Err` channel. When `liftE` is provided, caught exceptions are transformed
   * into the error type `E` before being placed in the error channel.
   *
   * @template E The error type.
   * @template A The success type.
   * @param {() => A | Promise<A>} f The effectful function to defer.
   * @param {(e: unknown) => E} [liftE] Optional function to transform caught exceptions into the error type E.
   * @returns {IO<E, A>} A new IO that, when executed, will run the function and capture its result.
   *
   * @example
   * // Synchronous effect
   * const syncIO = IO.lift(() => 42);
   *
   * // Asynchronous effect
   * const asyncIO = IO.lift(() => fetch('/api/data').then(r => r.json()));
   *
   * // With error transformation
   * const typedIO = IO.lift(
   *   () => riskyOperation(),
   *   (e) => new AppError(String(e))
   * );
   */
  static lift<E, A>(f: (signal?: AbortSignal) => A | Promise<A>, liftE?: (e: unknown) => E): IO<E, A> {
    return new IO({ tag: "Lift", run: f, liftE });
  }

  /**
   * Creates an IO from a function that receives an `AbortSignal` for cooperative cancellation.
   * Use this when the underlying operation supports cancellation (e.g., `fetch`, streams, timers).
   *
   * The signal is provided by the interpreter when the IO is forked. If the IO is run
   * without forking (via `unsafeRun`), the signal is never aborted.
   *
   * @template E The error type.
   * @template A The success type.
   * @param {(signal: AbortSignal) => A | Promise<A>} f The cancellable effectful function.
   * @param {(e: unknown) => E} [liftE] Optional function to transform caught exceptions into E.
   * @returns {IO<E, A>} A new IO that cooperates with cancellation.
   *
   * @example
   * const io = IO.cancellable<AppError, Response>(
   *   (signal) => fetch('/api/data', { signal }),
   *   (e) => new AppError(String(e))
   * );
   */
  static cancellable<E, A>(f: (signal: AbortSignal) => A | Promise<A>, liftE?: (e: unknown) => E): IO<E, A> {
    return new IO({ tag: "Lift", run: (signal?: AbortSignal) => f(signal ?? new AbortController().signal), liftE });
  }

  /**
   * Guarantees resource cleanup by structuring effectful code into three phases:
   * **acquire**, **use**, and **release**. The release action is *always* executed,
   * regardless of whether `use` succeeds, fails, or is cancelled.
   *
   * This is the classic functional `bracket` pattern (Cats `bracket`, Haskell `bracket`,
   * ZIO `acquireRelease`). It eliminates resource leaks by construction — the type
   * system ensures that every acquired resource has a corresponding release.
   *
   * Semantics:
   * - If **acquire** fails or is cancelled, `use` and `release` are never called.
   * - If **use** succeeds, `release` runs and the success value is returned.
   * - If **use** fails, `release` runs and the original error is returned.
   * - If **use** is cancelled, `release` runs and `Cancelled` is propagated.
   * - **release** runs without an `AbortSignal` — it always runs to completion.
   * - If `release` itself fails, the error is swallowed and `use`'s result takes priority
   *   (following Cats Effect semantics).
   *
   * @template E The error type shared by acquire and use.
   * @template R The resource type produced by acquire.
   * @template A The success type produced by use.
   * @param {IO<E, R>} acquire An IO that acquires the resource.
   * @param {(r: R) => IO<E, A>} use A function that uses the resource and produces a result.
   * @param {(r: R) => IO<never, void>} release A function that releases the resource. Must not fail.
   * @returns {IO<E, A>} An IO that acquires, uses, and releases the resource.
   *
   * @example
   * // Database connection with guaranteed cleanup
   * const io = IO.bracket(
   *   IO.lift(() => openConnection()),
   *   (conn) => IO.lift(() => conn.query('SELECT * FROM users')),
   *   (conn) => IO.lift(() => conn.close())
   * );
   *
   * @example
   * // File handle with guaranteed close
   * const io = IO.bracket(
   *   IO.lift(() => fs.open('/tmp/data.txt', 'r')),
   *   (fd) => IO.lift(() => fs.read(fd, buffer, 0, 1024, 0)),
   *   (fd) => IO.lift(() => fs.close(fd))
   * );
   *
   * @example
   * // Composable with other IO combinators
   * const io = IO.bracket(
   *   acquirePool(),
   *   (pool) => queryUsers(pool).map(users => users.filter(u => u.active)),
   *   (pool) => IO.lift(() => pool.shutdown())
   * ).mapErr(e => new AppError(e));
   */
  static bracket<E, R, A>(acquire: IO<E, R>, use: (r: R) => IO<E, A>, release: (r: R) => IO<never, void>): IO<E, A> {
    return IO.lift<E, A>(
      async (signal?: AbortSignal) => {
        // Phase 1: Acquire — respects cancellation
        const acqResult = await interpret(acquire[NODE], signal);
        if (acqResult.type === "Cancelled") ioCancelled();
        if (acqResult.type === "Err") throw ioEscape(acqResult.error);

        const resource = acqResult.value;

        // Phase 2: Use — respects cancellation, but release is guaranteed after
        let useResult: Ok<A> | Err<E> | Cancelled;
        try {
          useResult = await interpret(use(resource)[NODE], signal);
        } catch (e) {
          // use() threw during IO construction — still release
          await interpret(release(resource)[NODE]).catch(() => {});
          throw e;
        }

        // Phase 3: Release — always runs, no signal (must complete), errors swallowed
        await interpret(release(resource)[NODE]).catch(() => {});

        // Propagate use's original outcome
        if (useResult.type === "Cancelled") ioCancelled();
        if (useResult.type === "Err") throw ioEscape(useResult.error);
        return useResult.value;
      },
      (e: unknown) => {
        if (isIOCancelled(e)) throw e;
        if (isIOEscape(e)) return e.error as E;
        return e as E;
      }
    );
  }

  /**
   * Lifts an already-computed value into IO with no side effect.
   * The value is available immediately — no deferred computation takes place.
   *
   * This is useful for wrapping a known value in the IO type so it can be composed
   * with other IO operations via `flatMap`, `map`, etc.
   *
   * @template A The type of the value.
   * @param {A} a The value to wrap.
   * @returns {IO<never, A>} An IO that immediately succeeds with the given value.
   *
   * @example
   * const io = IO.pure(42);
   * const result = await io.unsafeRun(); // { type: "Ok", value: 42 }
   */
  static pure<A>(a: A): IO<never, A> {
    return new IO({ tag: "Pure", value: a });
  }

  /**
   * Creates an IO that fails immediately with the given error.
   * No computation is performed — the error is placed directly in the error channel.
   *
   * @template E The error type.
   * @template A The success type (defaults to `never` since this IO never succeeds).
   * @param {E} error The error value.
   * @returns {IO<E, A>} An IO that immediately fails with the given error.
   *
   * @example
   * const io = IO.fail(new Error("something went wrong"));
   * const result = await io.unsafeRun(); // { type: "Err", error: Error("something went wrong") }
   */
  static fail<E, A = never>(error: E): IO<E, A> {
    return new IO({ tag: "Fail", error });
  }

  /**
   * An IO that succeeds with `void`. Useful as a no-op placeholder
   * or as the terminal value in a chain of side-effecting operations.
   *
   * @example
   * const io = IO.unit;
   * const result = await io.unsafeRun(); // { type: "Ok", value: undefined }
   */
  static readonly unit: IO<never, void> = new IO<never, void>({
    tag: "Pure",
    value: undefined as unknown as void,
  });

  /**
   * Creates an Ok result value. Convenience constructor for building result values
   * outside of the IO execution context.
   *
   * @template A The type of the success value.
   * @param {A} value The success value.
   * @returns {Ok<A>} A result representing success.
   */
  static ok<A>(value: A): Ok<A> {
    return { type: "Ok", value };
  }

  /**
   * Creates an Err result value. Convenience constructor for building result values
   * outside of the IO execution context.
   *
   * @template E The type of the error value.
   * @param {E} error The error value.
   * @returns {Err<E>} A result representing failure.
   */
  static err<E>(error: E): Err<E> {
    return { type: "Err", error };
  }

  /**
   * Transforms the success value of this IO using the provided function.
   * If this IO fails, the function is not called and the error propagates unchanged.
   *
   * This is an O(1) operation — it wraps the current computation in a new node
   * without executing anything.
   *
   * @template B The type of the transformed value.
   * @param {(a: A) => B} f The transformation function.
   * @returns {IO<E, B>} A new IO representing the transformed computation.
   *
   * @example
   * const io = IO.lift(() => 21).map(n => n * 2);
   * const result = await io.unsafeRun(); // { type: "Ok", value: 42 }
   */
  map<B>(f: (a: A) => B): IO<E, B> {
    return IO.wrap({ tag: "Map", io: this[NODE], f });
  }

  /**
   * Chains a dependent IO computation on the success value.
   * If this IO fails, the function is not called and the error propagates unchanged.
   *
   * This is the monadic `bind` operation, enabling sequential composition of IO
   * operations where each step may depend on the result of the previous one.
   *
   * @template B The type of the value produced by the chained computation.
   * @param {(a: A) => IO<E, B>} f A function that takes the success value and returns a new IO.
   * @returns {IO<E, B>} A new IO representing the composed computation.
   *
   * @example
   * const io = IO.lift(() => 1).flatMap(n => IO.lift(() => n + 1));
   * const result = await io.unsafeRun(); // { type: "Ok", value: 2 }
   */
  flatMap<B>(f: (a: A) => IO<E, B>): IO<E, B> {
    return IO.wrap({ tag: "FlatMap", io: this[NODE], f });
  }

  /**
   * Transforms the error value of this IO using the provided function.
   * If this IO succeeds, the function is not called and the value propagates unchanged.
   *
   * Useful for converting raw exceptions or generic errors into typed domain errors.
   *
   * @template F The type of the transformed error.
   * @param {(e: E) => F} f The error transformation function.
   * @returns {IO<F, A>} A new IO with the transformed error type.
   *
   * @example
   * const io = IO.lift(() => { throw new Error("boom"); })
   *   .mapErr(e => new AppError(e.message));
   */
  mapErr<F>(f: (e: E) => F): IO<F, A> {
    return IO.wrap({ tag: "MapErr", io: this[NODE], f });
  }

  /**
   * Transforms both the error and success channels simultaneously.
   * This is the Bifunctor `bimap` operation.
   *
   * @template F The transformed error type.
   * @template B The transformed success type.
   * @param {(e: E) => F} fe The error transformation function.
   * @param {(a: A) => B} fa The success transformation function.
   * @returns {IO<F, B>} A new IO with both channels transformed.
   *
   * @example
   * const io = IO.lift(() => 42)
   *   .bimap(
   *     err => `Error: ${err}`,
   *     val => val * 2
   *   );
   */
  bimap<F, B>(fe: (e: E) => F, fa: (a: A) => B): IO<F, B> {
    return this.map(fa).mapErr(fe);
  }

  /**
   * Chains a dependent IO computation on the error value.
   * If this IO succeeds, the function is not called and the value propagates unchanged.
   * If this IO fails, the function receives the error and returns a new IO
   * that replaces the failed computation.
   *
   * This is the error-channel counterpart to `flatMap`.
   *
   * @param {(error: E) => IO<E, A>} f A function that takes the error and returns a new IO.
   * @returns {IO<E, A>} A new IO that either succeeds normally or recovers from the error.
   *
   * @example
   * const io = IO.fail("not found")
   *   .flatMapErr(err => IO.lift(() => fetchFromFallback()));
   */
  flatMapErr(f: (error: E) => IO<E, A>): IO<E, A> {
    return IO.wrap({ tag: "FlatMapErr", io: this[NODE], f });
  }

  /**
   * Executes a side-effect on the success value without changing the result.
   * If this IO fails, the function is not called. The callback may be synchronous
   * or asynchronous — the interpreter awaits if it returns a Promise.
   *
   * If the side-effect throws, the exception is swallowed and the original success
   * value is preserved. Use `map` or `flatMap` if failure should propagate.
   *
   * @param {(a: A) => void | Promise<void>} f The side-effect function.
   * @returns {IO<E, A>} A new IO that performs the side-effect but preserves the original result.
   *
   * @example
   * const io = IO.lift(() => 42).tap(value => console.log("Got:", value));
   */
  tap(f: (a: A) => void | Promise<void>): IO<E, A> {
    return IO.wrap({ tag: "Tap", io: this[NODE], f });
  }

  /**
   * Executes a side-effect on the error value without changing the result.
   * If this IO succeeds, the function is not called. The callback may be synchronous
   * or asynchronous — the interpreter awaits if it returns a Promise.
   *
   * If the side-effect throws, the exception is swallowed and the original error
   * is preserved. Use `mapErr` or `flatMapErr` if failure should propagate.
   *
   * @param {(e: E) => void | Promise<void>} f The side-effect function.
   * @returns {IO<E, A>} A new IO that performs the side-effect but preserves the original error.
   *
   * @example
   * const io = IO.fail(new Error("boom")).tapErr(e => logger.error(e));
   */
  tapErr(f: (e: E) => void | Promise<void>): IO<E, A> {
    return IO.wrap({ tag: "TapErr", io: this[NODE], f });
  }

  /**
   * Validates the success value against a predicate (Cats `ensure`).
   * If the predicate returns `false`, the success is converted into an error
   * using the `liftE` function. If this IO already fails, the predicate is not checked.
   *
   * @param {(a: A) => boolean} predicate The validation function.
   * @param {(a: A) => E} liftE Converts the value into an error when the predicate fails.
   * @returns {IO<E, A>} A new IO that validates the result.
   *
   * @example
   * const io = IO.lift(() => fetchAge())
   *   .ensure(age => age >= 18, age => `Must be 18+, got ${age}`);
   */
  ensure(predicate: (a: A) => boolean, liftE: (a: A) => E): IO<E, A> {
    return IO.wrap({ tag: "Ensure", io: this[NODE], predicate, liftE });
  }

  /**
   * Registers a cleanup action that runs only if this IO is cancelled.
   * If the IO completes normally (Ok or Err), the finalizer is never called.
   * Finalizers run in LIFO order (innermost first) during cancellation unwinding.
   *
   * @param {() => void | Promise<void>} finalizer The cleanup function.
   * @returns {IO<E, A>} A new IO with the finalizer registered.
   *
   * @example
   * const io = IO.cancellable((signal) => fetch('/api', { signal }))
   *   .onCancel(() => console.log("Request was cancelled"));
   */
  onCancel(finalizer: () => void | Promise<void>): IO<E, A> {
    return IO.wrap({ tag: "OnCancel", io: this[NODE], finalizer });
  }

  /**
   * Monadic fold — branches on both success and error channels, where each arm
   * returns a new IO. Unlike `fold` (which is terminal and returns a plain value),
   * `foldM` produces a composable IO that can be further chained.
   *
   * @template F The error type of the resulting IO.
   * @template B The success type of the resulting IO.
   * @param {(e: E) => IO<F, B>} onErr Handler for the error case.
   * @param {(a: A) => IO<F, B>} onOk Handler for the success case.
   * @returns {IO<F, B>} A new IO representing the branched computation.
   *
   * @example
   * const io = IO.lift(() => riskyOp()).foldM(
   *   err => IO.fail(`Recovered: ${err}`),
   *   val => IO.pure(val * 2)
   * );
   */
  foldM<F, B>(onErr: (e: E) => IO<F, B>, onOk: (a: A) => IO<F, B>): IO<F, B> {
    return IO.wrap({ tag: "FoldM", io: this[NODE], onOk, onErr });
  }

  /**
   * Executes the computation described by this IO and returns the result.
   * The interpreter walks the ADT tree using an explicit stack (trampoline),
   * ensuring stack safety for arbitrarily deep chains.
   *
   * @returns {Promise<Err<E> | Ok<A>>} The result of the computation.
   *
   * @example
   * const result = await IO.lift(() => 42).unsafeRun();
   * // result: { type: "Ok", value: 42 }
   */
  async unsafeRun(): Promise<Err<E> | Ok<A>> {
    return interpret(this[NODE]) as Promise<Ok<A> | Err<E>>;
  }

  /**
   * Executes the IO and folds both outcomes (success and error) into a single type.
   * This is a terminal operation — it runs the computation and returns a plain value.
   *
   * @template B The result type after folding.
   * @param {(e: E) => B} onErr Handler for the error case.
   * @param {(a: A) => B} onOk Handler for the success case.
   * @returns {Promise<B>} The folded result.
   *
   * @example
   * const message = await IO.lift(() => 42).fold(
   *   err => `Failed: ${err}`,
   *   val => `Got: ${val}`
   * );
   * // message: "Got: 42"
   */
  async fold<B>(onErr: (e: E) => B, onOk: (a: A) => B): Promise<B> {
    const result = await this.unsafeRun();
    return result.type === "Ok" ? onOk(result.value) : onErr(result.error);
  }

  /**
   * Executes the IO and returns the success value, or `null` if the computation fails.
   *
   * Note: if `A` itself can be `null`, the return value is ambiguous — a `null` result
   * could mean either "succeeded with null" or "failed." Use `unsafeRun()` or `fold`
   * when the distinction matters.
   *
   * @returns {Promise<A | null>} The success value or null.
   *
   * @example
   * const value = await IO.lift(() => 42).getOrNull(); // 42
   * const nope = await IO.fail("err").getOrNull();    // null
   */
  async getOrNull(): Promise<A | null> {
    const result = await this.unsafeRun();
    return result.type === "Ok" ? result.value : null;
  }

  /**
   * Executes the IO and returns the success value, or evaluates the provided
   * default function on error. The default is lazy to avoid unnecessary computation.
   *
   * @param {() => A} defaultValue A function that produces the fallback value.
   * @returns {Promise<A>} The success value or the default.
   *
   * @example
   * const value = await IO.fail("err").getOrElse(() => 0); // 0
   */
  async getOrElse(defaultValue: () => A): Promise<A> {
    const result = await this.unsafeRun();
    return result.type === "Ok" ? result.value : defaultValue();
  }

  /**
   * Executes the IO and returns the success value, or applies the handler
   * function to the error to produce a fallback value.
   *
   * @param {(error: E) => A} handler A function that transforms the error into a success value.
   * @returns {Promise<A>} The success value or the handled error.
   *
   * @example
   * const value = await IO.fail(new Error("boom"))
   *   .getOrHandleErr(e => `Handled: ${e.message}`);
   * // value: "Handled: boom"
   */
  async getOrHandleErr(handler: (error: E) => A): Promise<A> {
    const result = await this.unsafeRun();
    return result.type === "Ok" ? result.value : handler(result.error);
  }

  /**
   * Retries this IO when the condition is met, using the given scheduling policy.
   * The operation is retried with increasing delay based on the policy's factor and jitter settings.
   *
   * If the operation exceeds the retry limit, a `RetryError` is thrown.
   * If the condition is not met, a `ConditionalRetryError` is thrown.
   * Both are transformed through `liftE` into the error type `E`.
   *
   * @param {(error: E) => boolean} condition Predicate on the error — retry only when this returns true.
   * @param {(error: Error) => E} liftE Transforms schedule errors (e.g. RetryError, TimeoutError) into E.
   * @param {Policy} [policy] Scheduling policy (defaults to 3 retries, 1.2x backoff, 1s delay).
   * @returns {IO<E, A>} A new IO that wraps the retry logic.
   *
   * @example
   * const io = IO.lift(() => fetchData())
   *   .retryIf(
   *     err => err instanceof NetworkError,
   *     e => new AppError(e.message),
   *     { recurs: 5, delay: 1000, factor: 2 }
   *   );
   */
  retryIf(condition: (error: E) => boolean, liftE: (error: Error) => E, policy: Policy = defaultPolicy()): IO<E, A> {
    return IO.lift<E, Schedule>(
      () => new Schedule(policy),
      (e: unknown) => liftE(e instanceof Error ? e : new Error(String(e)))
    ).flatMap((scheduler) => scheduler.retryIf(this, condition, liftE));
  }

  /**
   * Applies a timeout to this IO. If the computation does not complete within `ms`
   * milliseconds, it is cancelled and the error produced by `onTimeout` is returned
   * in the error channel. If the computation completes before the deadline, the
   * timeout timer is cleared and the result is returned normally.
   *
   * The timeout error type `F` is unioned with the original error type `E`,
   * so the caller must handle both. The underlying computation is cooperatively
   * cancelled via `AbortSignal` when the timeout fires.
   *
   * This is a first-class replacement for the verbose `IO.race` workaround:
   * ```typescript
   * // Before — manual race
   * IO.race(
   *   operation,
   *   IO.lift(async () => { await delay(5000); throw new TimeoutError(); })
   * )
   *
   * // After — first-class combinator
   * operation.timeout(5000, () => new TimeoutError('Exceeded 5s'))
   * ```
   *
   * @template F The timeout error type.
   * @param {number} ms The timeout duration in milliseconds.
   * @param {() => F} onTimeout A thunk that produces the timeout error value.
   * @returns {IO<E | F, A>} A new IO that fails with `F` if the timeout elapses.
   *
   * @example
   * const io = IO.lift(() => fetch('/api/slow'))
   *   .timeout(5000, () => new TimeoutError('Request exceeded 5s'));
   *
   * @example
   * // Composable with mapErr to unify error types
   * const io = fetchUser(id)
   *   .timeout(3000, () => ({ code: 'TIMEOUT', message: 'User fetch timed out' }))
   *   .mapErr(e => normalizeError(e));
   */
  timeout<F>(ms: number, onTimeout: () => F): IO<E | F, A> {
    const node = this[NODE];
    return IO.lift<E | F, A>(
      (signal?: AbortSignal) => {
        return new Promise<A>((resolve, reject) => {
          const controller = new AbortController();

          // Link parent signal — clean up listener when settled
          let unlinkParent: (() => void) | undefined;
          if (signal) {
            if (signal.aborted) {
              controller.abort();
            } else {
              const onAbort = () => controller.abort();
              signal.addEventListener("abort", onAbort, { once: true });
              unlinkParent = () => signal.removeEventListener("abort", onAbort);
            }
          }

          let settled = false;
          const settle = () => {
            settled = true;
            if (unlinkParent) unlinkParent();
          };

          const timer = setTimeout(() => {
            if (settled) return;
            settle();
            controller.abort(); // cancel the underlying IO
            reject(ioEscape(onTimeout()));
          }, ms);

          interpret(node, controller.signal).then((result) => {
            if (settled) return;
            settle();
            clearTimeout(timer);
            if (result.type === "Ok") resolve(result.value);
            else if (result.type === "Cancelled") reject({ [IO_CANCELLED]: true });
            else reject(ioEscape(result.error));
          });

          // Clear timer on cancellation to avoid retaining the closure
          controller.signal.addEventListener(
            "abort",
            () => {
              clearTimeout(timer);
            },
            { once: true }
          );
        });
      },
      (e: unknown) => {
        if (isIOCancelled(e)) throw e;
        if (isIOEscape(e)) return e.error as E | F;
        return e as E | F;
      }
    );
  }

  /**
   * Starts this IO as a background computation, returning a `Fiber` handle.
   * The fiber can be joined (await result) or cancelled.
   *
   * `fork()` returns `IO<never, Fiber<E, A>>` — it is lazy and composable.
   * The computation only starts when the outer IO is executed.
   *
   * @returns {IO<never, Fiber<E, A>>} An IO that, when executed, starts this IO and returns a Fiber.
   *
   * @example
   * const io = IO.Do<AppError, string>(async bind => {
   *   const fiber = await bind(longRunningTask.fork());
   *   // ... do other work ...
   *   const result = await fiber.join();
   *   return result;
   * });
   */
  fork(): IO<never, Fiber<E, A>> {
    const node = this[NODE];
    return IO.lift(() => {
      const controller = new AbortController();
      const promise = interpret(node, controller.signal);
      return {
        join: () => promise,
        cancel: async () => {
          controller.abort();
          await promise.catch(() => {});
        },
        signal: controller.signal,
      } as Fiber<E, A>;
    });
  }

  /**
   * Runs multiple IOs in parallel and combines their results with a function.
   * All IOs are executed concurrently via `Promise.all`. If any IO fails,
   * all errors are collected into a `NonEmptyList`.
   *
   * Supports heterogeneous error types — each IO may have a different error type `E`,
   * and the resulting error is the union of all error types.
   *
   * The last argument is always the combiner function that receives the success values
   * in the same order as the IO arguments.
   *
   * @example
   * const io = IO.parMapN(
   *   IO.lift(() => fetchUser()),
   *   IO.lift(() => fetchOrders()),
   *   (user, orders) => ({ user, orders })
   * );
   */
  static parMapN<E1, E2, A1, A2, R>(
    io1: IO<E1, A1>,
    io2: IO<E2, A2>,
    f: (a1: A1, a2: A2) => R
  ): IO<NonEmptyList<E1 | E2>, R>;
  static parMapN<E1, E2, E3, A1, A2, A3, R>(
    io1: IO<E1, A1>,
    io2: IO<E2, A2>,
    io3: IO<E3, A3>,
    f: (a1: A1, a2: A2, a3: A3) => R
  ): IO<NonEmptyList<E1 | E2 | E3>, R>;
  static parMapN<E1, E2, E3, E4, A1, A2, A3, A4, R>(
    io1: IO<E1, A1>,
    io2: IO<E2, A2>,
    io3: IO<E3, A3>,
    io4: IO<E4, A4>,
    f: (a1: A1, a2: A2, a3: A3, a4: A4) => R
  ): IO<NonEmptyList<E1 | E2 | E3 | E4>, R>;
  static parMapN<E1, E2, E3, E4, E5, A1, A2, A3, A4, A5, R>(
    io1: IO<E1, A1>,
    io2: IO<E2, A2>,
    io3: IO<E3, A3>,
    io4: IO<E4, A4>,
    io5: IO<E5, A5>,
    f: (a1: A1, a2: A2, a3: A3, a4: A4, a5: A5) => R
  ): IO<NonEmptyList<E1 | E2 | E3 | E4 | E5>, R>;
  static parMapN<E1, E2, E3, E4, E5, E6, A1, A2, A3, A4, A5, A6, R>(
    io1: IO<E1, A1>,
    io2: IO<E2, A2>,
    io3: IO<E3, A3>,
    io4: IO<E4, A4>,
    io5: IO<E5, A5>,
    io6: IO<E6, A6>,
    f: (a1: A1, a2: A2, a3: A3, a4: A4, a5: A5, a6: A6) => R
  ): IO<NonEmptyList<E1 | E2 | E3 | E4 | E5 | E6>, R>;
  static parMapN(...ops: any[]): IO<NonEmptyList<any>, any> {
    if (ops.length < 3) {
      throw new Error("IO.parMapN requires at least two IO arguments and a combiner function");
    }
    const input = ops.slice(0, -1) as IO<any, any>[];
    const combiner = ops[ops.length - 1] as (...args: any[]) => any;

    return IO.lift<NonEmptyList<any>, any>(
      async (signal?: AbortSignal) => {
        const results = await Promise.all(input.map((io) => interpret(io[NODE], signal)));

        // If any cancelled, propagate cancellation
        if (results.some((r) => r.type === "Cancelled")) {
          ioCancelled();
        }

        const errors = results.filter((r): r is Err<any> => r.type === "Err").map((r) => r.error);

        if (errors.length > 0) {
          throw ioEscape(NonEmptyList.fromArray(errors));
        }

        const values = results.filter((r): r is Ok<any> => r.type === "Ok").map((r) => r.value);

        return combiner(...values);
      },
      (e: unknown) => {
        if (isIOEscape(e)) return e.error as NonEmptyList<any>;
        return NonEmptyList.fromArray([e]);
      }
    );
  }

  /**
   * Races multiple IOs concurrently, returning the result of the first one to succeed.
   * If all IOs fail, returns a `NonEmptyList` of all errors in the order they were provided.
   *
   * This is useful for implementing fallback strategies where you want the fastest
   * successful response from multiple sources.
   *
   * @template E The error type of the individual IOs.
   * @template A The success type (must be the same for all IOs).
   * @param {...IO<E, A>} ops The IO operations to race.
   * @returns {IO<NonEmptyList<E>, A>} An IO that succeeds with the first result or fails with all errors.
   *
   * @example
   * const io = IO.race(
   *   IO.lift(() => fetchFromPrimary()),
   *   IO.lift(() => fetchFromFallback()),
   * );
   */
  static race<E, A>(...ops: IO<E, A>[]): IO<NonEmptyList<E>, A> {
    if (ops.length === 0) {
      throw new Error("IO.race requires at least one IO argument");
    }

    return IO.lift<NonEmptyList<E>, A>(
      (signal?: AbortSignal) => {
        return new Promise<A>((resolve, reject) => {
          const controller = new AbortController();

          // Link parent signal — clean up listener when settled
          let unlinkParent: (() => void) | undefined;
          if (signal) {
            if (signal.aborted) {
              controller.abort();
            } else {
              const onAbort = () => controller.abort();
              signal.addEventListener("abort", onAbort, { once: true });
              unlinkParent = () => signal.removeEventListener("abort", onAbort);
            }
          }

          let completed = 0;
          let settled = false;
          const errors: (E | undefined)[] = new Array(ops.length);

          const settle = () => {
            settled = true;
            if (unlinkParent) unlinkParent();
          };

          ops.forEach((io, index) => {
            interpret(io[NODE], controller.signal).then((result) => {
              if (settled) return;
              if (result.type === "Ok") {
                settle();
                controller.abort(); // Cancel losers
                resolve(result.value);
              } else if (result.type === "Err") {
                errors[index] = result.error;
                completed++;
                if (completed === ops.length) {
                  settle();
                  // Filter out undefined holes from cancelled entries
                  const realErrors = errors.filter((e): e is E => e !== undefined);
                  if (realErrors.length > 0) {
                    reject(ioEscape(NonEmptyList.fromArray(realErrors)));
                  } else {
                    // All completed but no real errors (shouldn't happen), propagate cancellation
                    reject({ [IO_CANCELLED]: true });
                  }
                }
              } else {
                // Cancelled
                completed++;
                if (completed === ops.length && !settled) {
                  settle();
                  // Filter out undefined holes from cancelled entries
                  const realErrors = errors.filter((e): e is E => e !== undefined);
                  if (realErrors.length > 0) {
                    reject(ioEscape(NonEmptyList.fromArray(realErrors)));
                  } else {
                    // All cancelled — propagate cancellation, not a fake error
                    reject({ [IO_CANCELLED]: true });
                  }
                }
              }
            });
          });
        });
      },
      (e: unknown) => {
        if (isIOCancelled(e)) throw e;
        if (isIOEscape(e)) return e.error as NonEmptyList<E>;
        return NonEmptyList.fromArray([e as E]);
      }
    );
  }

  /**
   * Monadic do-notation. Sequences IO operations using an imperative-style
   * `bind` function that unwraps IO values or short-circuits on the first error.
   *
   * Inside the `operation` callback, call `bind(io)` to execute an IO and extract its
   * success value. If any bound IO fails, the entire `Do` short-circuits with that error —
   * subsequent `bind` calls are not executed.
   *
   * Uses an `IOEscape` sentinel internally to preserve the typed error `E` through
   * JavaScript's throw/catch mechanism, ensuring the error channel remains type-safe.
   *
   * When `liftE` is provided, non-IO exceptions thrown inside the operation block
   * (e.g. programming errors, unexpected throws) are transformed into the error type `E`
   * via `liftE`, closing the type hole. Without `liftE`, such exceptions pass through
   * untyped — use with care.
   *
   * @template E The error type shared by all bound IO operations.
   * @template A The final success type produced by the comprehension.
   * @param {(bind: <B>(effect: IO<E, B>) => Promise<B>) => Promise<A>} operation
   *   An async function that receives a `bind` callback for unwrapping IO values.
   * @param {(e: unknown) => E} [liftE] Optional function to transform non-IO exceptions into E.
   * @returns {IO<E, A>} An IO that, when executed, runs the comprehension.
   *
   * @example
   * const io = IO.Do<AppError, number>(async bind => {
   *   const user = await bind(fetchUser(userId));
   *   const orders = await bind(fetchOrders(user.id));
   *   return orders.length;
   * });
   */
  static Do<E, A>(
    operation: (bind: <B>(effect: IO<E, B>) => Promise<B>) => Promise<A>,
    liftE?: (e: unknown) => E
  ): IO<E, A> {
    const userLiftE = liftE;
    return IO.lift<E, A>(
      async (signal?: AbortSignal) => {
        const bind = async <B>(eff: IO<E, B>): Promise<B> => {
          const result = await interpret(eff[NODE], signal);
          if (result.type === "Ok") {
            return result.value;
          }
          if (result.type === "Cancelled") {
            ioCancelled(); // throws
          }
          throw ioEscape(result.error);
        };
        return await operation(bind);
      },
      (e: unknown): E => {
        if (isIOCancelled(e)) throw e; // re-throw, don't process through liftE
        if (isIOEscape(e)) return e.error as E;
        if (userLiftE) return userLiftE(e);
        return e as E;
      }
    );
  }

  /**
   * Sequentially executes a function over each item, collecting results into an array.
   * Fail-fast: if any invocation fails, the remaining items are not processed and the
   * error is returned immediately.
   *
   * @template E The error type.
   * @template A The input item type.
   * @template B The output type for each item.
   * @param {A[]} items The items to traverse.
   * @param {(a: A) => IO<E, B>} f A function that produces an IO for each item.
   * @returns {IO<E, B[]>} An IO that succeeds with all results or fails with the first error.
   *
   * @example
   * const io = IO.traverse([1, 2, 3], n => IO.lift(() => n * 2));
   * // result: { type: "Ok", value: [2, 4, 6] }
   */
  static traverse<E, A, B>(items: A[], f: (a: A) => IO<E, B>): IO<E, B[]> {
    return IO.Do<E, B[]>(async (bind) => {
      const results: B[] = [];
      for (const item of items) {
        results.push(await bind(f(item)));
      }
      return results;
    });
  }

  /**
   * Executes a function over each item in parallel, collecting all results or all errors.
   * Unlike `traverse`, all items are processed concurrently. If any fail, all errors
   * are collected into a `NonEmptyList`.
   *
   * @template E The error type.
   * @template A The input item type.
   * @template B The output type for each item.
   * @param {A[]} items The items to traverse in parallel.
   * @param {(a: A) => IO<E, B>} f A function that produces an IO for each item.
   * @returns {IO<NonEmptyList<E>, B[]>} An IO that succeeds with all results or fails with all errors.
   *
   * @example
   * const io = IO.parTraverse([1, 2, 3], n => IO.lift(() => n * 2));
   * // result: { type: "Ok", value: [2, 4, 6] }
   */
  static parTraverse<E, A, B>(items: A[], f: (a: A) => IO<E, B>): IO<NonEmptyList<E>, B[]> {
    return IO.lift<NonEmptyList<E>, B[]>(
      async (signal?: AbortSignal) => {
        const results = await Promise.all(items.map((item) => interpret(f(item)[NODE], signal)));

        // If any cancelled, propagate cancellation
        if (results.some((r) => r.type === "Cancelled")) {
          ioCancelled();
        }

        const errors = results.filter((r): r is Err<E> => r.type === "Err").map((r) => r.error);

        if (errors.length > 0) {
          throw ioEscape(NonEmptyList.fromArray(errors));
        }

        return results.filter((r): r is Ok<B> => r.type === "Ok").map((r) => r.value);
      },
      (e: unknown) => {
        if (isIOEscape(e)) return e.error as NonEmptyList<E>;
        return NonEmptyList.fromArray([e as E]);
      }
    );
  }

  /**
   * Sequentially executes an array of IOs, collecting results into an array.
   * Equivalent to `traverse(ios, x => x)`. Fail-fast on the first error.
   *
   * @template E The error type.
   * @template A The success type of each IO.
   * @param {IO<E, A>[]} ios The IO operations to sequence.
   * @returns {IO<E, A[]>} An IO that succeeds with all results or fails with the first error.
   *
   * @example
   * const io = IO.sequence([IO.lift(() => 1), IO.lift(() => 2), IO.lift(() => 3)]);
   * // result: { type: "Ok", value: [1, 2, 3] }
   */
  static sequence<E, A>(ios: IO<E, A>[]): IO<E, A[]> {
    return IO.traverse(ios, (io) => io);
  }

  /**
   * Executes an array of IOs in parallel, collecting all results or all errors.
   * Equivalent to `parTraverse(ios, x => x)`.
   *
   * @template E The error type.
   * @template A The success type of each IO.
   * @param {IO<E, A>[]} ios The IO operations to execute in parallel.
   * @returns {IO<NonEmptyList<E>, A[]>} An IO that succeeds with all results or fails with all errors.
   *
   * @example
   * const io = IO.parSequence([IO.lift(() => 1), IO.lift(() => 2), IO.lift(() => 3)]);
   * // result: { type: "Ok", value: [1, 2, 3] }
   */
  static parSequence<E, A>(ios: IO<E, A>[]): IO<NonEmptyList<E>, A[]> {
    return IO.parTraverse(ios, (io) => io);
  }
}
