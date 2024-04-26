/**
 * Represents a type which is either a Left (failure) or a Right (success).
 * Left typically stores an error or failure state, while Right stores a success value.
 */
export interface Either<A, B> {
  /**
   * Transforms the right value of this Either by applying a function and returns a new Either.
   * @param f - A transformation function to apply to the right value.
   * @returns A new Either instance with the transformed value if this is a Right; otherwise, a Left.
   * @example
   * const result = Right.of(5).map(x => x * 2); // Returns Right(10)
   */
  map<C>(f: (right: B) => C): Either<A, C>;

  /**
   * Transforms the left value of this Either by applying a function and returns a new Either.
   * @param f - A transformation function to apply to the left value.
   * @returns A new Either instance with the transformed value if this is a Left; otherwise, a Right.
   * @example
   * const result = Left.of(5).mapLeft(x => x * 2); // Returns Left(10)
   */
  mapLeft<C>(f: (left: A) => C): Either<C, B>;

  /**
   * Applies a transformation function to the right value that returns an Either,
   * enabling chaining of operations that may fail.
   * @param f - A transformation function to apply that returns an Either.
   * @returns The result of the function if this is a Right; otherwise, a Left.
   * @example
   * const result = Right.of(5).flatMap(x => Right.of(x * 2)); // Returns Right(10)
   */
  flatMap<C>(f: (right: B) => Either<A, C>): Either<A, C>;

  /**
   * Applies one of two provided functions based on the contents of this Either.
   * @param ifLeft - A function to handle a Left value.
   * @param ifRight - A function to handle a Right value.
   * @returns The result of the applied function.
   * @example
   * const result = Right.of(5).fold(
   *   error => 'Error occurred',
   *   value => 'Success with ' + value
   * ); // Returns 'Success with 5'
   */
  fold<C>(ifLeft: (left: A) => C, ifRight: (right: B) => C): C;

  /**
   * Executes a provided function if this is a Right, used for side effects.
   * @param action - A function to execute with the right value.
   * @returns The original Either instance, facilitating method chaining.
   * @example
   * Right.of(5).onRight(value => console.log(value)); // Logs "5"
   */
  tap(action: (right: B) => void): Either<A, B>;

  /**
   * Executes a provided function if this is a Left, used for side effects.
   * @param action - A function to execute with the left value.
   * @returns The original Either instance, facilitating method chaining.
   * @example
   * Left.of('Error').onLeft(err => console.log(err)); // Logs "Error"
   */
  tapLeft(action: (left: A) => void): Either<A, B>;
}

export class Left<A> implements Either<A, never> {
  private constructor(public readonly value: A) {
  }

  static of<A>(value: A): Left<A> {
    return new Left<A>(value);
  }

  map<C>(_: (right: never) => C): Either<A, C> {
    return this;
  }

  mapLeft<C>(f: (left: A) => C): Either<C, never> {
    return new Left(f(this.value));
  }

  flatMap<C>(_: (right: never) => Either<A, C>): Either<A, C> {
    return this;
  }

  fold<C>(ifLeft: (left: A) => C, _: (right: never) => C): C {
    return ifLeft(this.value);
  }

  tap(_: (right: never) => void): Either<A, never> {
    return this;
  }

  tapLeft(action: (left: A) => void): Either<A, never> {
    action(this.value);
    return this;
  }
}

export class Right<B> implements Either<never, B> {
  private constructor(public readonly value: B) {
  }

  static of<B>(value: B): Right<B> {
    return new Right<B>(value);
  }

  map<C>(f: (right: B) => C): Either<never, C> {
    return new Right<C>(f(this.value));
  }

  mapLeft<C>(_: (left: never) => C): Either<C, B> {
    return this;
  }

  flatMap<A, C>(f: (right: B) => Either<A, C>): Either<A, C> {
    return f(this.value);
  }

  fold<C>(_: (left: never) => C, ifRight: (right: B) => C): C {
    return ifRight(this.value);
  }

  tap(action: (right: B) => void): Either<never, B> {
    action(this.value);
    return this;
  }

  tapLeft(_: (left: never) => void): Either<never, B> {
    return this;
  }
}
