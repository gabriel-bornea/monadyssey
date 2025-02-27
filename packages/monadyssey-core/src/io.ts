import { NonEmptyList } from "./non-empty-list";
import { defaultPolicy, Policy, Schedule } from "./schedule";

/**
 * Represents a successful outcome of an operation.
 *
 * @template A The type of the value encapsulated by this successful outcome.
 */
export interface Ok<A> {
  /**
   * Discriminator property for type narrowing. Always "Ok" for instances of Ok.
   */
  type: "Ok";

  /**
   * The value resulting from a successful operation.
   */
  value: A;
}

/**
 * Represents a failed outcome of an operation.
 *
 * @template E The type of the error encapsulated by this failed outcome.
 */
export interface Err<E> {
  /**
   * Discriminator property for type narrowing. Always "Err" for instances of Err.
   */
  type: "Err";

  /**
   * The error resulting from a failed operation.
   */
  error: E;
}

/**
 * Represents an encapsulated asynchronous operation that may either result in a value of type `A` (success)
 * or an error of type `E` (failure). The `IO` data type provides methods for constructing, transforming, and composing
 * such operations in a functional style, facilitating error handling and asynchronous workflows.
 *
 * @template E The type of the error that the operation may produce.
 * @template A The type of the result that the operation may yield upon success.
 */
export class IO<E, A> {
  private _effect?: (input: any) => Promise<Err<E> | Ok<A>>;
  private _operations: Array<(input: any) => Promise<Err<any> | Ok<any>>> = [];

  /**
   * Private constructor to prevent direct instantiation from outside the class.
   * Use static factory methods instead.
   *
   * @param _eff A function returning a Promise that resolves to either an `Err<E>` or `Ok<A>`.
   */
  private constructor(_eff?: () => Promise<Err<E> | Ok<A>>) {
    if (_eff) {
      this._operations.push(_eff);
    }
  }

  /**
   * Creates an `IO` instance from an asynchronous function. This method allows you to initiate
   * an `IO` operation that encapsulates an asynchronous effect, which can eventually result in
   * a successful value of type `A` or an error of type `E`. The `of` method automatically catches
   * any errors thrown by the asynchronous function and wraps them in an `Err<E>`, while successful
   * results are wrapped in an `Ok<A>`.
   *
   * This approach enables the seamless integration of asynchronous operations into the functional
   * flow of `IO` operations, providing a foundation for complex asynchronous workflows with integrated
   * error handling.
   *
   * @template E The type of the error that the operation may produce.
   * @template A The type of the result that the operation may yield upon success.
   * @param {() => Promise<A>} f An asynchronous function that returns a Promise of a result. The function
   * should not manually handle errors with try/catch; instead, any thrown errors will be automatically
   * caught and transformed into an `Err<E>` by the `IO` operation.
   * @param {(error: unknown) => E} [liftE=(error) => error as E] A function that transforms unknown errors into
   * type `E`. If not provided, the default transformation casts the error as `E`.
   * @returns {IO<E, A>} An `IO` instance encapsulating the asynchronous operation, which can later be
   * executed, transformed, or composed with other `IO` operations.
   */
  static of = <E, A>(f: () => Promise<A>, liftE: (error: unknown) => E = (error) => error as E): IO<E, A> =>
    new IO(async (): Promise<Err<E> | Ok<A>> => {
      try {
        return IO.ok(await f());
      } catch (error: unknown) {
        return IO.err(liftE(error));
      }
    });

  /**
   * Creates an `IO` instance from a synchronous function. This method enables the wrapping of
   * synchronous operations within the `IO` monad, allowing these operations to be integrated
   * into asynchronous workflows managed by `IO`. It provides a way to include synchronous code
   * that might throw exceptions into the error handling and compositional patterns used by `IO`.
   *
   * Any thrown exceptions within the synchronous function are caught and encapsulated as an `Err<E>`,
   * while successful results are wrapped in an `Ok<A>`. This facilitates uniform error handling and
   * composition of both synchronous and asynchronous operations within the same functional flow.
   *
   * @template E The type of the error that the operation may produce in case of failure.
   * @template A The type of the result that the operation produces upon success.
   * @param {() => A} f A synchronous function that returns a result of type `A`. If this function throws
   * an exception, the exception is caught and transformed into an `Err<E>`, allowing for consistent
   * error handling within `IO` workflows.
   * @param {(error: unknown) => E} [liftE=(error) => error as E] A function that transforms unknown errors into
   * type `E`. If not provided, the default transformation casts the error as `E`.
   * @returns {IO<E, A>} An `IO` instance encapsulating the synchronous operation. This `IO` can be
   * executed, transformed, or composed with other `IO` instances in a manner consistent with
   * asynchronous operations, providing a seamless integration of synchronous code into asynchronous
   * functional flows.
   */
  static ofSync = <E, A>(f: () => A, liftE: (error: unknown) => E = (error) => error as E): IO<E, A> =>
    new IO(async () => {
      try {
        return IO.ok(f());
      } catch (error: unknown) {
        return IO.err(liftE(error));
      }
    });

  /**
   * Creates an `Ok` instance representing a successful outcome of an operation with the specified value.
   * This utility method is used to construct an `Ok<A>` object directly, encapsulating a successful result
   * of type `A`. It is typically used in scenarios where an immediate representation of a successful
   * operation is needed, allowing for integration into the functional flow of operations that use the
   * `Ok` and `Err` pattern for error handling.
   *
   * The `ok` method facilitates the creation of `Ok` instances without the need to explicitly construct
   * the object with its type and value properties, providing a concise and readable way to represent
   * success states in a type-safe manner.
   *
   * @template A The type of the value encapsulated by the successful outcome.
   * @param {A} value The value to be encapsulated in the `Ok` instance, representing the successful
   * outcome of an operation.
   * @returns {Ok<A>} An `Ok<A>` instance containing the provided value, signifying a successful
   * outcome.
   */
  static ok = <A>(value: A): Ok<A> => ({ type: "Ok", value });

  /**
   * Creates an `Err` instance representing a failed outcome of an operation with the specified error.
   * This utility method is used to construct an `Err<E>` object directly, encapsulating an error of
   * type `E`. It is typically used in scenarios where an immediate representation of a failure is
   * necessary, allowing for integration into the functional flow of operations that use the `Ok` and
   * `Err` pattern for comprehensive error handling.
   *
   * The `err` method simplifies the creation of `Err` instances without the need to explicitly
   * construct the object with its type and error properties, offering a straightforward and
   * type-safe manner to represent error states in operations.
   *
   * @template E The type of the error encapsulated by the failed outcome.
   * @param {E} error The error to be encapsulated in the `Err` instance, representing the failed
   * outcome of an operation.
   * @returns {Err<E>} An `Err<E>` instance containing the provided error, signifying a failed
   * outcome.
   */
  static err = <E>(error: E): Err<E> => ({ type: "Err", error: error });

  /**
   * Type guard function that checks if a given effect is an instance of `Ok<A>`. This method is used
   * to determine whether a given value (which could be either an `Ok<A>` or an `Err<E>`) represents a
   * successful outcome of an operation. It facilitates type-safe branching logic based on the success
   * or failure of operations within the context of operations that use the `Ok` and `Err` pattern for
   * error handling and functional programming flows.
   *
   * By using this method, TypeScript's type system can correctly infer the type of the `effect`
   * argument in branches where this function returns `true`, allowing for safe access to the `value`
   * property of `Ok<A>` instances without type assertions.
   *
   * @template E The type of the error that could be encapsulated by the effect if it represents a failure.
   * @template A The type of the value that is encapsulated by the effect if it represents a success.
   * @param {Err<E> | Ok<A>} effect The effect to be checked, which could either be an `Ok<A>` representing
   * a successful outcome, or an `Err<E>` representing a failed outcome.
   * @returns {boolean} `true` if the effect is an instance of `Ok<A>`, indicating a successful outcome;
   * otherwise, `false`.
   */
  static isOk = <E, A>(effect: Err<E> | Ok<A>): effect is Ok<A> => effect.type === "Ok";

  /**
   * Type guard function that checks if a given effect is an instance of `Err<E>`. This method is crucial
   * for determining whether a given value, which could be either an `Ok<A>` or an `Err<E>`, represents a
   * failed outcome of an operation. It enables type-safe branching logic based on the success or failure
   * of operations within the context of utilizing the `Ok` and `Err` pattern for error handling and
   * functional programming flows.
   *
   * Utilizing this method allows TypeScript's type system to accurately infer the type of the `effect`
   * argument in code branches where this function returns `true`, enabling safe access to the `error`
   * property of `Err<E>` instances without the need for explicit type assertions.
   *
   * @template E The type of the error that is encapsulated by the effect if it represents a failure.
   * @template A The type of the value that could be encapsulated by the effect if it represents a success.
   * @param {Err<E> | Ok<A>} effect The effect to be checked, which could either be an `Err<E>` representing
   * a failed outcome, or an `Ok<A>` representing a successful outcome.
   * @returns {boolean} `true` if the effect is an instance of `Err<E>`, indicating a failed outcome;
   * otherwise, `false`.
   */
  static isErr = <E, A>(effect: Err<E> | Ok<A>): effect is Err<E> => effect.type === "Err";

  /**
   * Creates an `IO` instance that represents an operation with no side effects and an undefined result.
   * This method is useful for initializing an `IO` operation that effectively does nothing, serving as a
   * neutral element in compositions of `IO` operations. The result of this operation is explicitly typed
   * as `undefined`, but due to TypeScript's type system, it can be cast to any type `A`, making it
   * versatile for various initial or placeholder scenarios in functional programming flows.
   *
   * The `empty` method facilitates the creation of `IO` instances that can be used as starting points or
   * placeholders in complex compositions of asynchronous operations, where a no-op or undefined
   * operation is required. It ensures that even such no-op operations are integrated into the `IO`
   * monad's error handling and compositional framework.
   *
   * @template A The type of the result that this `IO` operation is expected to yield. The actual
   * operation, however, does not yield any value and is effectively a no-op.
   * @returns {IO<never, A>} An `IO` instance representing an operation that does nothing and yields
   * an undefined result. This result is typed as `unknown`, allowing for flexible casting to any
   * desired result type `A` within the `IO` monad's compositional and type-safe framework.
   */
  static empty = <A>(): IO<never, A> => new IO<never, A>(async () => IO.ok(undefined as any as A));

  /**
   * Creates an `IO` instance that immediately resolves to the given value without performing any
   * asynchronous operation or side effect. This method is akin to the identity function in functional
   * programming, returning a value without alteration. It encapsulates the provided value in an `IO`
   * monad, enabling it to be integrated into the functional flow of `IO` operations.
   *
   * The `identity` method is particularly useful for wrapping values in `IO` instances to allow them
   * to participate in compositions and transformations that expect `IO` types, facilitating a seamless
   * integration of constant values into asynchronous workflows.
   *
   * @template A The type of the value to be encapsulated by the resulting `IO` instance.
   * @param {A} a The value to be wrapped in an `IO` instance. This value is returned unmodified
   * by the `IO` operation, effectively making the operation an identity function within the `IO` monad.
   * @returns {IO<never, A>} An `IO` instance that, when executed, immediately yields the provided
   * value `a` without any asynchronous operation or side effect. The error type is set to `unknown`
   * as this operation does not produce errors, ensuring type safety in compositions that may handle
   * errors.
   */
  static identity = <A>(a: A): IO<never, A> => {
    const effect = new IO<never, A>();
    effect._operations.push(async () => IO.ok(a));
    return effect;
  };

  /**
   * Creates an `IO` instance that represents a failed operation with a specified error. This method
   * is used to immediately construct an `IO` operation that results in an error, encapsulating the
   * error within an `Err<E>` without performing any asynchronous operation or side effect. It provides
   * a straightforward way to represent known errors or failure states within the `IO` monad, allowing
   * these errors to be integrated into the functional flow of `IO` operations and handled consistently
   * with other asynchronous errors.
   *
   * The `failed` method is especially useful for starting a chain of `IO` operations with a predefined
   * error, or for injecting known errors into compositions of `IO` operations for testing or error
   * handling purposes.
   *
   * @template E The type of the error to be encapsulated by the resulting `IO` instance.
   * @template A The type parameter for the successful result type, which is not used since this operation
   * fails by design, but is required for type compatibility within the `IO` monad.
   * @param {E} error The error to be wrapped in an `IO` instance. This error is returned as the failure
   * reason by the `IO` operation, effectively making the operation a constant failure function within
   * the `IO` monad.
   * @returns {IO<E, A>} An `IO` instance that, when executed, immediately yields the provided error `error`
   * as a failure, without any asynchronous operation or side effect. The successful result type `A` is
   * specified for type compatibility but is not used since this operation results in an error.
   */
  static failed = <E, A>(error: E): IO<E, A> => new IO(() => Promise.resolve(IO.err(error)));

  /**
   * Refines the successful result of this `IO` operation based on a specified predicate function. If the
   * predicate returns `true` for the result, the operation continues to be considered successful. If the
   * predicate returns `false`, the provided handler function is called with the current result to produce
   * a new error, which then turns the operation into a failure.
   *
   * This method allows for conditional validation of the result within the `IO` monad, enabling the
   * creation of more complex logical flows where the outcome of an operation can be refined or altered
   * based on dynamic conditions. It is particularly useful for cases where an operation's success needs
   * to be further qualified by additional criteria not covered by the operation itself.
   *
   * @template A The type of the result that the operation may yield upon success.
   * @template E The type of the error that the operation may produce either initially or as a result of
   * refinement failure.
   * @param {function(a: A): boolean} predicate A function that takes the current successful result and
   * returns a boolean indicating whether the result meets the specified criteria (`true`) or not (`false`).
   * @param {function(a: A): E} liftE A function that takes the current result (in case the predicate
   * returns `false`) and returns a new error of type `E`, which is then used to represent the refined
   * failure state of the operation.
   * @returns {IO<E, A>} An `IO` instance representing the refined operation. If the predicate function
   * returns `true` for the original result, the operation remains successful. If the predicate returns
   * `false`, the operation is considered failed with the new error produced by the handler function.
   */
  refine(predicate: (a: A) => boolean, liftE: (a: A) => E): IO<E, A> {
    const effect = new IO<E, A>();
    effect._operations = [
      ...this._operations,
      async (prev: Err<E> | Ok<A>): Promise<Err<E> | Ok<A>> => {
        if (IO.isOk(prev)) {
          return predicate(prev.value) ? prev : IO.err(liftE(prev.value));
        }
        return prev;
      },
    ];
    return effect;
  }

  /**
   * Transforms the successful result of this `IO` operation using a provided function. If the operation
   * is successful, the transformation function is applied to the result, and a new `IO` instance
   * encapsulating the transformed result is returned. If the operation fails, the error is propagated
   * unchanged.
   *
   * This method follows the functor pattern, allowing for the results of `IO` operations to be mapped
   * to different types or values without altering the overall flow of the operation. It is a foundational
   * method for functional programming, enabling operations to be composed and their results transformed
   * in a declarative manner.
   *
   * @template A The type of the original result that the operation yields upon success.
   * @template B The type of the transformed result.
   * @template E The type of the error that the operation may produce.
   * @param {function(a: A): B} f A transformation function that takes the successful result of the current
   * `IO` operation as input and returns a new value of type `B`, which will be encapsulated in the returned
   * `IO` instance.
   * @returns {IO<E, B>} A new `IO` instance representing the operation with its result transformed by the
   * provided function. If the original operation was successful, the new instance will encapsulate the
   * transformed result. If the original operation failed, the new instance will encapsulate the original
   * error.
   */
  map = <B>(f: (a: A) => B): IO<E, B> => {
    const effect = new IO<E, B>();
    effect._operations = [
      ...this._operations,
      async (prev: Err<E> | Ok<A>): Promise<Err<E> | Ok<B>> => {
        if (IO.isOk(prev)) {
          return IO.ok(f(prev.value));
        }
        return prev as Err<E>;
      },
    ];
    return effect;
  };

  /**
   * Transforms the error of this `IO` operation using a provided function. If the operation fails, the
   * transformation function is applied to the error, and a new `IO` instance encapsulating the
   * transformed error is returned. If the operation is successful, its result is propagated unchanged.
   *
   * This method enables the customization or refinement of error types within the `IO` monad, allowing
   * for more granular error handling and the possibility to adapt errors to different contexts or
   * requirements. It follows the concept of error mapping found in functional programming, providing a
   * declarative way to handle and transform errors in asynchronous operations.
   *
   * @template E The type of the original error that the operation may produce.
   * @template F The type of the transformed error. `F` extends `E` to ensure that the transformed error
   * is compatible with the original error type, allowing for type-safe transformations.
   * @template A The type of the result that the operation yields upon success.
   * @param {function(e: E): F} f A transformation function that takes the error of the failed operation
   * as input and returns a new error of type `F`. This transformed error will be encapsulated in the
   * returned `IO` instance if the original operation fails.
   * @returns {IO<F, A>} A new `IO` instance representing the operation with its error transformed by the
   * provided function. If the original operation failed, the new instance will encapsulate the
   * transformed error. If the original operation was successful, the new instance will encapsulate the
   * original result.
   */
  mapError = <F>(f: (e: E) => F): IO<F, A> => {
    const effect = new IO<F, A>();
    effect._operations = this._operations.map((op) => async (prev: Err<E> | Ok<A>): Promise<Err<F> | Ok<A>> => {
      const result = await op(prev);
      if (IO.isErr(result)) {
        return IO.err(f(result.error));
      }
      return result;
    });
    return effect;
  };

  /**
   * Transforms the successful, non-null result of this `IO` operation using a provided function,
   * returning a new `IO` instance that encapsulates the transformed result. This method is similar
   * to `map`, but it specifically operates on non-null results, ensuring that the transformation
   * function is only applied to values that are neither `null` nor `undefined`. If the operation
   * fails, or if the result is `null` or `undefined`, the original error or a `null`/`undefined`
   * result is propagated unchanged.
   *
   * The `mapNotNull` method is useful in scenarios where the operation's result may legitimately
   * be `null` or `undefined`, and such results should be treated differently from other successful
   * outcomes. It allows for a safe transformation of only those results that are present, avoiding
   * potential runtime errors due to null or undefined values.
   *
   * @template A The type of the original result that the operation yields upon success, excluding
   * `null` and `undefined`.
   * @template B The type of the transformed result.
   * @template E The type of the error that the operation may produce.
   * @param {function(a: NonNullable<A>): B} f A transformation function that takes the successful,
   * non-null result of the current `IO` operation as input and returns a new value of type `B`,
   * which will be encapsulated in the returned `IO` instance.
   * @returns {IO<E, B>} A new `IO` instance representing the operation with its result transformed
   * by the provided function, if the original result was non-null. If the original operation failed,
   * or if the result was `null` or `undefined`, the new instance will encapsulate the original error
   * or a `null`/`undefined` result.
   */
  mapNotNull = <B>(f: (a: NonNullable<A>) => B): IO<E, B> => {
    const effect = new IO<E, B>();
    effect._operations = [
      ...this._operations,
      async (prev: Err<E> | Ok<A>): Promise<Err<E> | Ok<B>> => {
        if (IO.isOk(prev) && prev.value) {
          return IO.ok(f(prev.value as NonNullable<A>));
        }
        return prev as Err<E>;
      },
    ];
    return effect;
  };

  /**
   * Transforms the successful result of this `IO` operation into another `IO` operation using a
   * provided function, and then flattens the result into a single `IO` instance. This method is
   * essential for composing multiple asynchronous operations in a sequence where each operation
   * may depend on the result of the previous one.
   *
   * Unlike `map`, which applies a transformation function to a successful result and wraps it in a
   * new `IO` instance, `flatMap` expects the transformation function to return an `IO` instance
   * itself. This allows for the dynamic chaining of operations based on the results of preceding
   * operations. If the initial operation fails, `flatMap` bypasses the transformation function
   * and propagates the error.
   *
   * `flatMap` is a powerful tool for creating complex, dependent asynchronous workflows in a
   * functional style, ensuring that errors are consistently handled and propagated throughout the
   * chain of operations.
   *
   * @template A The type of the original result that the operation yields upon success.
   * @template B The type of the result produced by the subsequent `IO` operation.
   * @template E The type of the error that the operations may produce.
   * @param {function(a: A): IO<E, B>} f A transformation function that takes the successful result
   * of the current `IO` operation as input and returns a new `IO` instance representing the next
   * operation in the sequence. This allows for the result of the current operation to be used in
   * determining the next step in a workflow.
   * @returns {IO<E, B>} A new `IO` instance that represents the flattened result of applying the
   * transformation function to the original operation's successful result, and executing the
   * resulting `IO` operation. If the original operation fails, the new instance will encapsulate
   * the original error, effectively skipping the transformation.
   */
  flatMap = <B>(f: (a: A) => IO<E, B>): IO<E, B> => {
    const effect = new IO<E, B>();
    effect._operations = [
      ...this._operations,
      async (prev: Err<E> | Ok<A>): Promise<Err<E> | Ok<B>> => {
        if (IO.isOk(prev)) {
          const next = f(prev.value);
          const combined = next._operations;
          let result: Err<E> | Ok<any> = prev;
          for (const op of combined) {
            result = await op(result);
            if (IO.isErr(result)) {
              break;
            }
          }
          return result;
        }
        return prev as Err<E>;
      },
    ];
    return effect;
  };

  /**
   * Transforms the successful, non-null result of this `IO` operation into another `IO` operation using a
   * provided function, similar to `flatMap`, but specifically operates on non-null results. The transformation
   * function is applied only if the original operation's result is neither `null` nor `undefined`. This method
   * then flattens the result into a single `IO` instance. If the initial operation fails, or if the result is
   * `null` or `undefined`, `flatMapNotNull` bypasses the transformation function and propagates the original
   * error or results in a new `IO` operation that effectively represents a `null` or `undefined` value.
   *
   * `flatMapNotNull` is particularly useful for sequencing asynchronous operations that are dependent on the
   * presence of a non-null result from the previous operation, enabling the creation of complex workflows
   * that safely handle nullable types without introducing explicit null checks at each step.
   *
   * @template A The type of the original result that the operation yields upon success, excluding
   * `null` and `undefined`.
   * @template B The type of the result produced by the subsequent `IO` operation.
   * @template E The type of the error that the operations may produce.
   * @param {function(a: NonNullable<A>): IO<E, B>} f A transformation function that takes the successful,
   * non-null result of the current `IO` operation as input and returns a new `IO` instance representing the
   * next operation in the sequence. This allows for the result of the current operation to be used in
   * determining the next step in a workflow, with the assurance that the value is neither `null` nor
   * `undefined`.
   * @returns {IO<E, B>} A new `IO` instance that represents the flattened result of applying the
   * transformation function to the original operation's successful, non-null result, and executing the
   * resulting `IO` operation. If the original operation fails, or if the result is `null` or `undefined`,
   * the new instance will encapsulate the original error or represent a `null`/`undefined` outcome,
   * effectively skipping the transformation.
   */
  flatMapNotNull = <B>(f: (a: NonNullable<A>) => IO<E, B>): IO<E, B> => {
    const effect = new IO<E, B>();
    effect._operations = [
      ...this._operations,
      async (prev: Err<E> | Ok<A>): Promise<Err<E> | Ok<B>> => {
        if (IO.isOk(prev) && prev.value) {
          const next = f(prev.value as NonNullable<A>);
          const combined = next._operations;
          let result: Err<E> | Ok<any> = prev;
          for (const op of combined) {
            result = await op(result);
            if (IO.isErr(result)) {
              break;
            }
          }
          return result;
        }
        return prev as Err<E>;
      },
    ];
    return effect;
  };

  /**
   * @experimental
   * Retries the effect if the given condition is met.
   *
   * This method wraps the effect in a retry mechanism defined by a `Schedule` instance,
   * using the provided retry policy. If no error transformation function (`liftE`) is provided,
   * a default transformation will structure the error as an object containing `message`, `name`,
   * and `stack`.
   *
   * @template E - The type of error that the effect can produce.
   * @template A - The type of value that the effect can produce.
   *
   * @param {(error: E) => boolean} condition - A function that determines whether the effect
   *   should be retried based on the error. Returns `true` to retry, `false` to stop retrying.
   * @param {((error: Error) => any)} [liftE] - A function to transform the error into a user-defined
   *   structure. Defaults to a function that returns an object with `message`, `name`, and `stack`.
   * @param {Policy} [policy=defaultPolicy()] - The retry policy, which defines the number of retries,
   *   delay between retries, and backoff strategy. Defaults to the `defaultPolicy`.
   *
   * @returns {IO<E, A>} A new `IO` instance that retries the effect based on the given condition
   *   and policy.
   *
   * @example
   * // Retry a failing HTTP request if the error message contains "retryable"
   * HttpClient.get("/api/resource")
   *   .retryIf((error) => error.message.includes("retryable")) // Retry condition
   *   .runAsync();
   *
   * // Output (after retries are exhausted):
   * // {
   * //   message: "Original error message",
   * //   name: "Error",
   * //   stack: "Error stack trace..."
   * // }
   */
  retryIf<E, A>(
    this: IO<E, A>,
    condition: (error: E) => boolean,
    policy: Policy = defaultPolicy(),
    liftE?: (error: Error) => any
  ): IO<E, A> {
    if (policy.recurs < 1 || policy.factor < 1 || policy.delay < 0 || (policy.timeout && policy.timeout < 0)) {
      policy = defaultPolicy();
    }
    const scheduler = new Schedule(policy);
    if (!liftE) {
      liftE = (error: Error): any => ({
        message: error.message,
        name: error.name,
        stack: error.stack,
      });
    }
    return scheduler.retryIf(this, condition, liftE);
  }

  /**
   * Handles both the success (`Ok`) and failure (`Err`) cases of the current `IO` computation
   * and returns a new `IO` instance based on the provided handlers.
   *
   * This method allows branching logic for both `Ok` and `Err` scenarios, enabling seamless
   * composition of computations. It is a non-terminal operation, meaning the returned `IO`
   * can be further composed and executed lazily.
   *
   * @template E - The error type of the current `IO`.
   * @template F - The error type of the resulting `IO` after applying the handlers.
   * @template A - The success type of the current `IO`.
   * @template B - The success type of the resulting `IO` after applying the handlers.
   *
   * @param {function(E): IO<F, B>} onError - A handler function to process the `Err` case.
   *        It receives the error value and returns a new `IO` instance for further computation.
   * @param {function(A): IO<F, B>} onSuccess - A handler function to process the `Ok` case.
   *        It receives the success value and returns a new `IO` instance for further computation.
   *
   * @returns {IO<F, B>} A new `IO` instance representing the result of applying the appropriate
   *          handler (`onError` or `onSuccess`) to the current computation.
   *
   * @example
   * const task: IO<string, number> = IO.ofSync(() => 42);
   *
   * const result = await task.match(
   *   (err) => IO.failed(`Recovered from error: ${err}`),
   *   (value) => IO.identity(value * 2)
   * ).runAsync();
   *
   * console.log(result); // { type: "Ok", value: 84 }
   */
  match<E, F, A, B>(this: IO<E, A>, onError: (e: E) => IO<F, B>, onSuccess: (a: A) => IO<F, B>): IO<F, B> {
    const effect = new IO<F, B>();
    effect._operations = [
      ...this._operations,
      async (prev: Err<E> | Ok<A>): Promise<Err<F> | Ok<B>> => {
        if (prev.type === "Ok") {
          return await onSuccess(prev.value).runAsync();
        } else {
          return await onError(prev.error).runAsync();
        }
      },
    ];
    return effect;
  }

  /**
   * @deprecated use `parZip` instead
   * Combines two `IO` operations into a single `IO` operation that, when executed, will run both
   * operations in parallel and encapsulate their results in a tuple. If both operations succeed, the
   * resulting `IO` instance will contain an `Ok` with a tuple of the results. If one or both operations
   * fail, the resulting `IO` instance will contain an `Err` with a non-empty list of errors.
   *
   * This method is useful for scenarios where two independent asynchronous operations need to be
   * executed and their results combined. The `zip2` method ensures that errors from both operations are
   * captured and combined into a single error value if necessary, allowing for comprehensive error
   * handling that accounts for the potential failure of either or both operations.
   *
   * @template E The type of the errors that the input `IO` operations may produce. The resulting `IO`
   * operation will produce a `NonEmptyList<E>` of errors if failures occur.
   * @template A The type of the result produced by the first `IO` operation.
   * @template B The type of the result produced by the second `IO` operation.
   * @param {IO<E, A>} f1 The first `IO` operation to be combined.
   * @param {IO<E, B>} f2 The second `IO` operation to be combined.
   * @returns {IO<NonEmptyList<E>, [A, B]>} An `IO` instance representing the combined operation. On
   * success, it yields an `Ok` with a tuple containing the results of `f1` and `f2`. On failure, it
   * yields an `Err` with a non-empty list of errors from `f1` and/or `f2`.
   */
  static zip2<E, A, B>(f1: IO<E, A>, f2: IO<E, B>): IO<NonEmptyList<E>, [A, B]> {
    return new IO(async () => {
      const results = await Promise.all([f1.runAsync(), f2.runAsync()]);
      if (results.every((result) => result.type === "Ok")) {
        const res = results as [Ok<A>, Ok<B>];
        return IO.ok([res[0].value, res[1].value]);
      } else {
        const errors = results.flatMap((result) => (result.type === "Ok" ? [] : result.error));
        return IO.err(NonEmptyList.fromArray(errors));
      }
    });
  }

  /**
   * @deprecated use `parZip` instead
   * Combines three `IO` operations into a single `IO` operation that, when executed, will run all
   * three operations in parallel and encapsulate their results in a tuple. If all operations succeed,
   * the resulting `IO` instance will contain an `Ok` with a tuple of the results. If any of the
   * operations fail, the resulting `IO` instance will contain an `Err` with a non-empty list of errors,
   * aggregating the errors from any and all failed operations.
   *
   * This method is especially useful for scenarios where multiple independent asynchronous operations
   * need to be executed concurrently and their results combined. It allows for efficient parallel
   * execution while ensuring comprehensive error handling, capturing and combining errors from all
   * operations into a single error value if needed.
   *
   * @template E The type of the errors that the input `IO` operations may produce. The resulting `IO`
   * operation will produce a `NonEmptyList<E>` of errors if any failures occur.
   * @template A The type of the result produced by the first `IO` operation.
   * @template B The type of the result produced by the second `IO` operation.
   * @template C The type of the result produced by the third `IO` operation.
   * @param {IO<E, A>} f1 The first `IO` operation to be combined.
   * @param {IO<E, B>} f2 The second `IO` operation to be combined.
   * @param {IO<E, C>} f3 The third `IO` operation to be combined.
   * @returns {IO<NonEmptyList<E>, [A, B, C]>} An `IO` instance representing the combined operation. On
   * success, it yields an `Ok` with a tuple containing the results of `f1`, `f2`, and `f3`. On failure,
   * it yields an `Err` with a non-empty list of errors from `f1`, `f2`, and/or `f3`.
   */
  static zip3<E, A, B, C>(f1: IO<E, A>, f2: IO<E, B>, f3: IO<E, C>): IO<NonEmptyList<E>, [A, B, C]> {
    return new IO(async () => {
      const results = await Promise.all([f1.runAsync(), f2.runAsync(), f3.runAsync()]);
      if (results.every((result) => result.type === "Ok")) {
        const res = results as [Ok<A>, Ok<B>, Ok<C>];
        return IO.ok([res[0].value, res[1].value, res[2].value]);
      } else {
        const errors = results.flatMap((result) => (result.type === "Ok" ? [] : result.error));
        return IO.err(NonEmptyList.fromArray(errors));
      }
    });
  }

  /**
   * @experimental
   * Combines multiple `IO` operations into a single `IO` operation that, when executed, will run all
   * operations in parallel and process their results using a provided callback function. If all operations
   * succeed, the resulting `IO` instance will contain an `Ok` with the result of the callback function applied
   * to the results of the `IO` operations. If one or more operations fail, the resulting `IO` instance will
   * contain an `Err` with a non-empty list of errors.
   *
   * @template E - The type of the error.
   * @template T - A tuple type representing the types of the values contained in each IO instance.
   * @template R - The return type of the callback function.
   * @param {...{ [K in keyof T]: IO<E, T[K]> }, (...args: T) => R} ops - A variable number of IO operations to
   * be executed in parallel, followed by a callback function that processes the results of the IO operations.
   * @returns {IO<NonEmptyList<E>, R>} - A new IO instance that resolves to the result of the callback function
   *                                    if all operations succeed, or a NonEmptyList of errors if any operation fails.
   * @example
   * const first = IO.ofSync(() => 1);
   * const second = IO.ofSync(() => "2");
   *
   * const result = await IO.parZip(first, second, (num, str) => `${num}, ${str}`).runAsync();
   *
   * switch (result.type) {
   *   case "Err":
   *     console.error("Errors:", result.error.errors);
   *   case "Ok":
   *     console.log(result.value); // Output: "1, 2"
   * }
   */
  static parZip<E, T extends any[], R>(
    ...ops: [...{ [K in keyof T]: IO<E, T[K]> }, (...args: T) => R]
  ): IO<NonEmptyList<E>, R> {
    const input = ops.slice(0, -1) as { [K in keyof T]: IO<E, T[K]> };
    const combiner = ops[ops.length - 1] as (...args: T) => R;
    const effect = new IO<NonEmptyList<E>, R>();

    effect._operations.push(async () => {
      const promises = input.map((io) => {
        if (!io._effect) {
          io._compose();
        }
        return io._effect!(undefined);
      });

      const results = await Promise.all(promises);

      const errors = results.filter((result): result is Err<E> => result.type === "Err").map((result) => result.error);

      if (errors.length > 0) {
        return IO.err(NonEmptyList.fromArray(errors));
      }

      const values = results.filter((result): result is Ok<any> => result.type === "Ok").map(({ value }) => value) as T;

      return IO.ok(combiner(...values));
    });

    return effect;
  }

  /**
   * Provides a mechanism for recovering from errors in this `IO` operation by applying a provided
   * function that transforms an error of type `E` into a new `IO` operation. This new operation can
   * either correct the error and return a result of type `A` (or a subtype `B` of `A`), or it can
   * return another error of type `E`. If the original `IO` operation succeeds, its result is propagated
   * unchanged.
   *
   * The `recover` method allows for the implementation of sophisticated error recovery strategies,
   * where an error in one operation can trigger another operation as an attempt to correct or handle
   * the failure. This method is crucial for creating resilient asynchronous workflows that can adapt
   * to and recover from unexpected conditions.
   *
   * Note: The recovery function should be used judiciously to ensure that it does not inadvertently
   * swallow or obscure errors. It is typically used in scenarios where there is a clear recovery path
   * or an alternative operation that can be attempted in case of failure.
   *
   * @template E The type of the error that the operation may produce and that the recovery function
   * deals with.
   * @template A The type of the result that the operation yields upon success.
   * @template B A subtype of `A` that the recovery operation can return, allowing for recovery
   * operations that return a specific subtype of the original success type.
   * @param {function(error: E): IO<E, B>} f A recovery function that takes the error of the failed
   * operation as input and returns a new `IO` instance representing an attempt to recover from that
   * error. This new `IO` operation can either yield a successful result of type `B` (a subtype of `A`)
   * or another error of type `E`.
   * @returns {IO<E, A>} An `IO` instance that represents the original operation with an added recovery
   * path. If the original operation fails, the provided function is used to attempt recovery. If the
   * original operation succeeds, or if the recovery operation also succeeds, the result is of type `A`.
   * If the recovery operation fails, the resulting `IO` instance will contain the new error of type `E`.
   */
  recover = <B extends A>(f: (error: E) => IO<E, B>): IO<E, A> => {
    const effect = new IO<E, A>();
    effect._operations = this._operations.map((op) => async (prev: Err<E> | Ok<A>): Promise<Err<E> | Ok<A>> => {
      const result = await op(prev);
      if (IO.isOk(result)) {
        return result;
      } else {
        const rec = f(result.error);
        let res: Err<E> | Ok<B> = result;
        for (const operation of rec._operations) {
          res = await operation(res);
          if (IO.isErr(res)) {
            break;
          }
        }
        return res as Err<E> | Ok<A>;
      }
    });
    return effect;
  };

  /**
   * Applies a given side effect function to the successful result of this `IO` operation, without
   * altering the result. This method is primarily used for executing side effects such as logging,
   * metrics collection, or other operations that should not modify the main result of the `IO`
   * operation.
   *
   * The `tap` method is useful for scenarios where you need to perform operations based on the
   * success value of the `IO` instance, but you want to ensure that these operations do not interfere
   * with the original workflow. It allows for the injection of side effects in a controlled manner,
   * ensuring that the integrity of the main computation is preserved.
   *
   * @template E The type of the error that the operation may produce.
   * @template A The type of the result that the operation yields upon success.
   * @param {function(a: A): void} f A side-effect function that takes the successful result of the
   * current `IO` operation as input. This function should not return a value, and any return value
   * will be ignored.
   * @returns {IO<E, A>} The same `IO` instance, allowing for method chaining. The successful result
   * is passed through unchanged, ensuring that the primary workflow continues as intended.
   */
  tap = (f: (a: A) => void): IO<E, A> => {
    const effect = new IO<E, A>();
    effect._operations = [
      ...this._operations,
      async (prev: Err<E> | Ok<A>): Promise<Err<E> | Ok<A>> => {
        if (IO.isOk(prev)) {
          f(prev.value);
        }
        return prev;
      },
    ];
    return effect;
  };

  /**
   * Applies a given side effect function to the error of this `IO` operation, if it fails, without
   * altering the outcome. This method is useful for executing side effects such as logging errors,
   * metrics collection related to failures, or other operations that should occur in response to an
   * error but should not modify the error itself or the flow of the operation.
   *
   * The `tapError` method allows for the integration of side effects specifically related to error
   * handling, providing a mechanism to observe and respond to errors without interfering with the
   * original error handling and propagation logic of the `IO` monad. It ensures that while side effects
   * can be performed in response to an error, the integrity and flow of error handling remains intact.
   *
   * @template E The type of the error that the operation may produce.
   * @template A The type of the result that the operation yields upon success.
   * @param {function(error: E): void} f A side effect function that takes the error produced by the
   * failed operation as input. This function should not return a value, and any return value will be
   * ignored.
   * @returns {IO<E, A>} The same `IO` instance, allowing for method chaining. The error is passed
   * through unchanged if the operation fails, ensuring that the primary error handling flow continues
   * as intended.
   */
  tapError(f: (error: E) => void): IO<E, A> {
    const effect = new IO<E, A>();
    effect._operations = [
      ...this._operations,
      async (prev: Err<E> | Ok<A>): Promise<Err<E> | Ok<A>> => {
        if (IO.isErr(prev)) {
          f(prev.error);
        }
        return prev;
      },
    ];
    return effect;
  }

  /**
   * Handles errors within this `IO` operation by applying a provided error handler function, which
   * can transform the error or perform recovery actions. This method is designed to manage both
   * errors encapsulated in an `Err<E>` result and exceptions thrown during the execution of the
   * operation. If the operation succeeds without throwing an exception, its result is returned
   * unchanged.
   *
   * This comprehensive error handling mechanism allows for robust and flexible error management
   * strategies within the `IO` monad, enabling operations to recover from errors or transform them
   * as needed, while also ensuring that unexpected exceptions are caught and handled in a consistent
   * manner.
   *
   * @template E The type of the error that the operation may produce.
   * @template F The type of the error returned by the handler function.
   * @template A The type of the result that the operation yields upon success.
   * @param {function(error: E): F} handle An error handler function that takes the error of the failed
   * operation or the caught exception as input and returns a new error of type `F`. This transformed
   * or recovered error will be encapsulated in the returned `IO` instance if the original operation
   * fails or an exception is caught.
   * @returns {IO<F, A>} A new `IO` instance representing the operation with its error handled by the
   * provided function. If the original operation or the catch block throws an exception, the new
   * instance will encapsulate the error returned by the error handler function. If the original
   * operation succeeds, the new instance will encapsulate the original result.
   */
  handleErrorWith<F>(handle: (error: E | unknown) => F): IO<F, A> {
    const effect = new IO<F, A>();
    effect._operations = this._operations.map((op) => async (prev: Err<E> | Ok<A>): Promise<Err<F> | Ok<A>> => {
      try {
        const result = await op(prev);
        if (IO.isErr(result)) {
          return IO.err(handle(result.error));
        }
        return result;
      } catch (error: any) {
        return IO.err(handle(error));
      }
    });
    return effect;
  }

  /**
   * @experimental
   * Performs a monadic bind over a sequence of IO operations encapsulated in an `IO` monad.
   * This function abstracts the complexity of chaining and error management of IO operations,
   * allowing for a declarative style of programming. This method is experimental and may
   * change in future releases.
   *
   * @template E - The error type that can be returned in case of failure.
   * @template A - The result type of the successful execution of the `operation`.
   * @param {function(bind: <B>(effect: IO<E, B>) => Promise<B>): Promise<A>} operation -
   *        A function that takes a `bind` function and returns a `Promise`. The `bind` function
   *        is used to execute `IO` operations sequentially. `operation` should utilize `bind`
   *        to chain together several `IO` operations and compute a final result based on their
   *        successful execution.
   * @returns {IO<E, A>} An IO that resolves to either an error `E`,
   *          if any of the IO operations fail, or a success with value `A`, if all operations
   *          complete successfully. The method ensures that all started operations are completed
   *          before it resolves.
   *
   * @example
   * const sum = IO.forM(async bind => {
   *   const one = await bind(IO.ofSync(() => 1));
   *   const two = await bind(IO.ofSync(() => 2));
   *   const three = await bind(IO.ofSync(() => 3));
   *   return one + two + three;
   * });
   */
  static forM<E, A>(operation: (bind: <B>(effect: IO<E, B>) => Promise<B>) => Promise<A>): IO<E, A> {
    const bind = async <B>(eff: IO<E, B>): Promise<B> => {
      const result = await eff.runAsync();
      if (IO.isOk(result)) {
        return result.value;
      } else {
        throw result.error;
      }
    };
    return IO.of(async () => await operation(bind));
  }

  /**
   * Executes the encapsulated effect and applies one of two provided functions based on the outcome:
   * one if the operation fails and another if it succeeds. This method is a way to consolidate handling
   * of both successful and failed outcomes into a single operation, with each outcome being transformed
   * into a common type `B`. The `fold` method is especially useful in scenarios where you want to
   * normalize the result of the `IO` operation to a single type, regardless of success or failure.
   *
   * This approach allows for a clear separation of success and error handling logic while still
   * enabling them to converge on a single result type. It's particularly beneficial in contexts where
   * the distinction between success and failure is handled uniformly or when integrating `IO` operations
   * into systems that do not distinguish between these outcomes.
   *
   * @template E The type of the error that may be produced by the operation if it fails.
   * @template A The type of the result that may be produced by the operation upon success.
   * @template B The common return type into which both success and failure results are transformed.
   * @param {function(e: E): B} onError A function to be applied if the operation fails, transforming
   * the error into a value of type `B`.
   * @param {function(a: A): B} onSuccess A function to be applied if the operation succeeds, transforming
   * the result into a value of type `B`.
   * @returns {Promise<B>} A Promise that resolves to the result of applying the appropriate transformation
   * function based on the outcome of the `IO` operation. This provides a unified type `B` as the final
   * result, abstracting over the success/failure dichotomy.
   */
  fold = async <B>(onError: (e: E) => B, onSuccess: (a: A) => B): Promise<B> => {
    const result = await this.runAsync();
    if (IO.isOk(result)) {
      return onSuccess(result.value);
    } else {
      return onError(result.error);
    }
  };

  /**
   * Asynchronously executes the encapsulated effect and returns a Promise that resolves with the
   * operation's result if successful, or `null` if the operation fails or yields an undefined result.
   * This method provides a way to execute the `IO` operation and access its result directly, with a
   * simplified error handling mechanism that converts all failure cases to `null`.
   *
   * The `getOrNull` method is useful when the precise details of the failure are not needed, and the
   * presence or absence of a result is sufficient to determine the next steps in the application logic.
   * It simplifies handling operations where a missing or undefined result can be treated the same as
   * an error, allowing for straightforward integration into workflows that prefer nullability over
   * explicit error handling.
   *
   * @template E The type of the error that may be produced by the operation if it fails.
   * @template A The type of the result that may be produced by the operation upon success.
   * @returns {Promise<A | null>} A Promise that, when resolved, yields the successful result of the
   * operation, or `null` if the operation failed or produced an undefined result. This approach
   * streamlines error handling by treating all errors and undefined results uniformly as `null`.
   */
  getOrNull = async (): Promise<A | null> =>
    this.fold(
      () => null,
      (a) => a
    );

  /**
   * Asynchronously executes the encapsulated effect and returns a Promise that resolves with the
   * operation's result if successful, or the provided default value if the operation fails.
   *
   * This default value can be either a constant or a function that returns a value of type `A`.
   *
   * @example
   * getOrElse(() => 5);
   *
   * @template A The type of the result that may be produced by the operation upon success.
   * @param {A | (() => A)} defaultValue The default value to be returned if the operation fails.
   * @returns {Promise<A>} A Promise that, when resolved, yields the successful result of the operation, or the provided default value if the operation fails.
   */
  getOrElse = (defaultValue: () => A): Promise<A> =>
    this.fold(
      () => defaultValue(),
      (a) => a
    );

  /**
   * Asynchronously executes the encapsulated effect and returns a Promise that resolves with the
   * operation's result if successful, or invokes the provided handler function if the operation fails.
   *
   * This handler function is supposed to handle the error scenario and return an appropriate value
   * of type `A` that can be used in its place.
   *
   * @example  Usage with a handler function:
   * getOrHandle(error => {
   *   console.log(error);
   *   return defaultA;
   * });
   *
   * @template E The type of the error that may be produced by the operation if it fails.
   * @template A The type of the result that may be produced by the operation upon success.
   * @param {(error: E) => A} handler The handler function to be invoked if the operation fails.
   * @returns {Promise<A>} A Promise that, when resolved, yields the successful result of the operation,
   * or the return value of the provided handler function if the operation failed.
   */
  getOrHandle = async (handler: (error: E) => A): Promise<A> => {
    return this.fold(handler, (v) => v);
  };

  /**
   * Executes the encapsulated asynchronous effect and returns a Promise that resolves with the outcome
   * of the operation. This method triggers the execution of the operation represented by this `IO`
   * instance, which can result in either a successful outcome encapsulated in an `Ok<A>`, or a failure
   * outcome encapsulated in an `Err<E>`.
   *
   * The `runAsync` method is the point at which the deferred computation encapsulated by the `IO` monad
   * is actually performed. Until this method is called, the `IO` operation remains a description of an
   * asynchronous effect without being executed. This design allows for the construction of complex
   * asynchronous workflows that are executed only when their effects are explicitly triggered.
   *
   * @template E The type of the error that may be produced by the operation if it fails.
   * @template A The type of the result that may be produced by the operation upon success.
   * @returns {Promise<Err<E> | Ok<A>>} A Promise that resolves with the outcome of the asynchronous
   * effect. The Promise resolves to an `Err<E>` if the operation fails, encapsulating the error
   * associated with the failure. If the operation succeeds, the Promise resolves to an `Ok<A>`,
   * encapsulating the successful result.
   */
  runAsync = async (): Promise<Err<E> | Ok<A>> => {
    if (!this._effect) {
      this._compose();
    }
    return this._effect!(undefined);
  };

  private _compose(): void {
    this._effect = async (input) => {
      let result: Err<E> | Ok<any> = { type: "Ok", value: input };
      for (const op of this._operations) {
        result = await op(result);
      }
      return result as Err<E> | Ok<A>;
    };
  }
}
