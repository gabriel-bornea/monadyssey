/**
 * `Eval` represents a deferred computation, which allows operations to be delayed, chained,
 * and lazily evaluated. It provides a foundation for creating different types of deferred operations
 * that can be evaluated on demand.
 *
 * Its primary goal is to facilitate the construction and manipulation of computations in a way
 * that allows for efficient and flexible execution strategies. It can create immediate, deferred,
 * and lazy computations, and compose them using monadic operations.
 *
 * @template A The type of the value that this computation produces.
 */
export abstract class Eval<A> {
  /**
   * Retrieves the value of the operation.
   *
   * @returns {A} The value produced by the operation.
   */
  abstract value(): A;

  /**
   * Creates a deferred operation that will be evaluated later.
   * The provided function is not executed until the value of the operation is needed.
   *
   * This method is useful for deferring expensive computations until their results are required,
   * thereby improving performance and resource utilization.
   *
   * @template A The type of the value that the operation produces.
   * @param {() => A} f The function to defer, which produces the operation's value when called.
   * @returns {Eval<A>} A new deferred operation.
   *
   * @example
   * // Defers the computation of a value
   * const deferredEval = Eval.defer(() => {
   *   console.log("Computing value...");
   *   return 42;
   * });
   *
   * // The value is not computed until we call `evaluate`
   * console.log(deferredEval.evaluate()); // Logs "Computing value..." then 42
   */
  static defer<A>(f: () => A): Eval<A> {
    return new Deferred(f);
  }

  /**
   * Creates an immediate operation with a given value.
   * The provided value is available immediately without any deferred computation.
   *
   * This method is useful for wrapping a value in an `Eval` instance when the value is already
   * computed, and the evaluation does not need to be deferred.
   *
   * @template A The type of the value that the operation produces.
   * @param {A} value The value to wrap in an immediate operation.
   * @returns {Eval<A>} A new immediate operation.
   *
   * @example
   * // Wraps an immediate value in an Eval instance
   * const immediateEval = Eval.now(42);
   *
   * // The value is available immediately
   * console.log(immediateEval.evaluate()); // Logs 42
   */
  static now<A>(value: A): Eval<A> {
    return new Now(value);
  }

  /**
   * Creates a lazy operation that will be evaluated once when needed.
   * The provided function is evaluated the first time the value is requested, and the result is cached
   * for subsequent accesses.
   *
   * This method is useful for deferring the computation until it is needed, while ensuring that the computation
   * is performed at most once, thereby combining the benefits of deferred and memoized evaluation.
   *
   * @template A The type of the value that the operation produces.
   * @param {() => A} f The function to lazily evaluate, which produces the operation's value when called.
   * @returns {Eval<A>} A new lazy operation.
   *
   * @example
   * // Lazily computes a value
   * const lazyEval = Eval.lazy(() => {
   *   console.log("Computing value...");
   *   return 42;
   * });
   *
   * // The value is not computed until `evaluate` is called the first time
   * console.log(lazyEval.evaluate()); // Logs "Computing value..." then 42
   *
   * // Subsequent calls do not recompute the value
   * console.log(lazyEval.evaluate()); // Logs 42
   */
  static lazy<A>(f: () => A): Eval<A> {
    return new Lazy(f);
  }

  /**
   * Transforms the result of the operation using a given function.
   * The provided function is applied to the value produced by this operation, and the result is wrapped
   * in a new `Eval` instance.
   *
   * It allows for chaining operations in a functional style, enabling the transformation of values
   * as part of a sequence of computations.
   *
   * @template A The type of the result before transformation.
   * @template B The type of the result after transformation.
   * @param {(a: A) => B} f The transformation function that takes a value of type `A` and returns a value of type `B`.
   * @returns {Eval<B>} A new operation representing the transformed result.
   *
   * @example
   * // Creates an immediate operation with an initial value
   * const immediateEval = Eval.immediate(42);
   *
   * // Transforms the value by adding 1
   * const mappedEval = immediateEval.map(value => value + 1);
   *
   * // Evaluates the transformed operation
   * console.log(mappedEval.evaluate()); // Logs 43
   */
  map<B>(f: (a: A) => B): Eval<B> {
    return new FlatMap(this, (a) => Eval.now(f(a)));
  }

  /**
   * Composes this operation with another operation.
   * The provided function takes the result of this operation and returns a new `Eval` instance,
   * allowing for the creation of a sequence of dependent computations.
   *
   * This method is useful for chaining multiple computations that may have dependencies on each other,
   * enabling a monadic style of composition where each step can produce a new deferred computation.
   *
   * @template A The type of the result before composition.
   * @template B The type of the result of the composed operation.
   * @param {(a: A) => Eval<B>} f The function to compose with, which takes a value of type `A`
   * and returns a new `Eval` instance producing a value of type `B`.
   * @returns {Eval<B>} A new operation representing the composed result.
   *
   * @example
   * // Creates an immediate operation with an initial value
   * const immediateEval = Eval.immediate(42);
   *
   * // Composes the initial operation with another operation that adds 1 and wraps it in Eval
   * const flatMappedEval = immediateEval.flatMap(value => Eval.immediate(value + 1));
   *
   * // Evaluates the composed operation
   * console.log(flatMappedEval.evaluate()); // Logs 43
   */
  flatMap<B>(f: (a: A) => Eval<B>): Eval<B> {
    return new FlatMap(this, f);
  }

  /**
   * Evaluates the operation, including any composed operations.
   * It uses an iterative approach with a stack to handle nested operations, ensuring
   * that the computation is performed in the correct order and avoiding stack overflow from deep recursion.
   *
   * It is essential for obtaining the final result of an `Eval` computation, especially when
   * multiple operations are chained together.
   *
   * @template A The type of the final result of the computation.
   * @returns {A} The final result of the computation.
   * @throws {EvaluationError} If there is an unexpected issue during evaluation, such as an undefined function in the stack.
   *
   * @example
   * // Creates a deferred operation
   * const deferredEval = Eval.defer(() => 21);
   *
   * // Composes the deferred operation with another operation
   * const composedEval = deferredEval.flatMap(value => Eval.immediate(value * 2));
   *
   * // Evaluates the composed operation
   * console.log(composedEval.evaluate()); // Logs 42
   */
  /* eslint-disable @typescript-eslint/no-this-alias */
  evaluate(): A {
    let current: Eval<A> = this;
    const stack: Array<(a: any) => Eval<A>> = [];
    while (true) {
      if (current instanceof FlatMap) {
        if (current.first instanceof FlatMap) {
          stack.push(current.f);
          current = current.first;
        } else {
          const first = current.first.value();
          current = current.f(first);
        }
      } else {
        const result = current.value();
        if (stack.length === 0) {
          return result;
        } else {
          const f = stack.pop();
          if (f) {
            current = f(result);
          } else {
            throw new EvaluationError("Unexpected undefined function in stack.");
          }
        }
      }
    }
  }
}

/**
 * Represents an immediate computation. The value is precomputed and available immediately without any delay.
 *
 * The `Now` class is useful when you have a value that is already computed, and you want to wrap it
 * in an `Eval` instance to integrate with other deferred computations.
 *
 * @template A The type of the value that this computation produces.
 */
class Now<A> extends Eval<A> {
  /**
   * Creates an instance of `Now` with a given value.
   */
  constructor(private readonly _value: A) {
    super();
  }

  /**
   * Retrieves the immediate value of the computation.
   *
   * @returns {A} The precomputed value.
   *
   * @example
   * // Creates an immediate computation with the value 42
   * const immediateEval = new Now(42);
   *
   * // Retrieves the value immediately
   * console.log(immediateEval.value()); // Logs 42
   */
  value(): A {
    return this._value;
  }
}

/**
 * Represents a deferred computation. The computation is not performed until the value is explicitly requested.
 * The `Deferred` class is useful for deferring expensive or time-consuming computations until their results are needed.
 *
 * @template A The type of the value that this computation produces.
 */
class Deferred<A> extends Eval<A> {
  /**
   * Creates an instance of `Deferred` with a given f function.
   *
   * @param {() => A} f The function to defer, which produces the computation's value when called.
   */
  constructor(private readonly f: () => A) {
    super();
  }

  /**
   * Performs the deferred computation and returns the result.
   *
   * @returns {A} The value produced by the deferred computation.
   *
   * @example
   * // Creates a deferred computation
   * const deferredEval = new Deferred(() => {
   *   console.log("Computing value...");
   *   return 42;
   * });
   *
   * // The computation is not performed until `value` is called
   * console.log(deferredEval.value()); // Logs "Computing value..." then 42
   */
  value(): A {
    return this.f();
  }
}

/**
 * Represents a lazy computation that will be evaluated once.
 * The provided function is evaluated the first time the value is requested, and the result is cached
 * for subsequent accesses.
 *
 * The `Lazy` class is useful for deferring the computation until it is needed, while ensuring that the computation
 * is performed at most once. This combines the benefits of deferred and memoized evaluation.
 *
 * @template A The type of the value that this computation produces.
 */
class Lazy<A> extends Eval<A> {
  private _value?: A;
  private _evaluated = false;

  /**
   * Creates an instance of `Lazy` with a given f function.
   *
   * @param {() => A} f The function to lazily evaluate, which produces the operation's value when called.
   */
  constructor(private readonly f: () => A) {
    super();
  }

  /**
   * Performs the lazy computation if it has not been done yet, caches the result, and returns the value.
   *
   * @returns {A} The value produced by the lazy computation.
   *
   * @example
   * // Creates a lazy computation
   * const lazyEval = new Lazy(() => {
   *   console.log("Computing value...");
   *   return 42;
   * });
   *
   * // The computation is not performed until `value` is called the first time
   * console.log(lazyEval.value()); // Logs "Computing value..." then 42
   *
   * // Subsequent calls do not recompute the value
   * console.log(lazyEval.value()); // Logs 42
   */
  value(): A {
    if (!this._evaluated) {
      this._value = this.f();
      this._evaluated = true;
    }
    return this._value!;
  }
}

/**
 * Represents a computation that is the result of a flatMap operation.
 * A `FlatMap` allows for the composition of multiple computations where each computation
 * can depend on the result of the previous one.
 *
 * The `FlatMap` class is used internally to chain computations in a monadic style. It extends the `Eval`
 * abstract class and implements the `value` method to throw an error, as a `FlatMap` should not be
 * directly evaluated. Instead, its evaluation is handled by the `Eval` class's `evaluate` method.
 *
 * @template A The type of the value produced by the first computation.
 * @template B The type of the value produced by the composed computation.
 */
class FlatMap<A, B> extends Eval<B> {
  /**
   * Creates an instance of `FlatMap` with a given initial computation and a function to compose with.
   *
   * @param {Eval<A>} first The initial computation.
   * @param {(a: A) => Eval<B>} f The function to compose with, which takes a value of type `A`
   * and returns a new `Eval` instance producing a value of type `B`.
   */
  constructor(
    public readonly first: Eval<A>,
    public readonly f: (a: A) => Eval<B>
  ) {
    super();
  }

  /**
   * This method should not be called directly. It is implemented to throw an error because
   * a `FlatMap` should not be evaluated directly. Instead, its evaluation is managed by the `Eval` class's
   * `evaluate` method.
   *
   * @throws {EvaluationError} Always throws an error indicating that `FlatMap` should not be evaluated directly.
   */
  value(): B {
    throw new EvaluationError("FlatMap should not be evaluated directly");
  }
}

/**
 * Represents an error that occurs during the evaluation of a computation.
 *
 * The `EvaluationError` class extends the standard `Error` class to provide additional context
 * specific to errors encountered during the evaluation of `Eval` computations. This class includes
 * the original error that caused the evaluation to fail, allowing for more detailed error handling
 * and debugging.
 *
 * @template E The type of the error details.
 */
export class EvaluationError<E> extends Error {
  /**
   * Creates an instance of `EvaluationError` with the specified error details.
   *
   * @param {E} error The details of the error that occurred during evaluation.
   */
  constructor(readonly error: E) {
    super();
    this.name = "EvaluationError";
  }
}
