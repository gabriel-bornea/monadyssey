/**
 * Represents a type which is either a Left (failure) or a Right (success).
 * Left typically stores an error or failure state, while Right stores a success value.
 */
interface Either<A, B> {
  /**
   * Transforms the right value of this Either by applying a function and returns a new Either.
   * @param f - A transformation function to apply to the right value.
   * @returns A new Either instance with the transformed value if this is a Right; otherwise, a Left.
   * @example
   * const result = new Right(5).map(x => x * 2); // Returns Right(10)
   */
  map<C>(f: (right: B) => C): Either<A, C>;

  /**
   * Applies a transformation function to the right value that returns an Either,
   * enabling chaining of operations that may fail.
   * @param f - A transformation function to apply that returns an Either.
   * @returns The result of the function if this is a Right; otherwise, a Left.
   * @example
   * const result = new Right(5).flatMap(x => new Right(x * 2)); // Returns Right(10)
   */
  flatMap<C>(f: (right: B) => Either<A, C>): Either<A, C>;

  /**
   * Applies one of two provided functions based on the contents of this Either.
   * @param ifLeft - A function to handle a Left value.
   * @param ifRight - A function to handle a Right value.
   * @returns The result of the applied function.
   * @example
   * const result = new Right(5).fold(
   *   error => 'Error occurred',
   *   value => 'Success with ' + value
   * ); // Returns 'Success with 5'
   */
  fold<C>(ifLeft: (left: A) => C, ifRight: (right: B) => C): C;

  /**
   * Executes a provided function if this is a Left, used for side effects.
   * @param action - A function to execute with the left value.
   * @returns The original Either instance, facilitating method chaining.
   * @example
   * new Left('Error').onLeft(err => console.log(err)); // Logs "Error"
   */
  onLeft(action: (left: A) => void): Either<A, B>;

  /**
   * Executes a provided function if this is a Right, used for side effects.
   * @param action - A function to execute with the right value.
   * @returns The original Either instance, facilitating method chaining.
   * @example
   * new Right(5).onRight(value => console.log(value)); // Logs "5"
   */
  onRight(action: (right: B) => void): Either<A, B>;
}

class Left<A> implements Either<A, never> {
  constructor(public readonly value: A) {
  }

  map<C>(_: (right: never) => C): Either<A, C> {
    return this;
  }

  flatMap<C>(_: (right: never) => Either<A, C>): Either<A, C> {
    return this;
  }

  fold<C>(ifLeft: (left: A) => C, _: (right: never) => C): C {
    return ifLeft(this.value);
  }

  onLeft(action: (left: A) => void): Either<A, never> {
    action(this.value);
    return this;
  }

  onRight(_: (right: never) => void): Either<A, never> {
    return this;
  }
}

class Right<B> implements Either<never, B> {
  constructor(public readonly value: B) {
  }

  map<C>(f: (right: B) => C): Either<never, C> {
    return new Right<C>(f(this.value));
  }

  flatMap<A, C>(f: (right: B) => Either<A, C>): Either<A, C> {
    return f(this.value);
  }

  fold<C>(_: (left: never) => C, ifRight: (right: B) => C): C {
    return ifRight(this.value);
  }

  onLeft(_: (left: never) => void): Either<never, B> {
    return this;
  }

  onRight(action: (right: B) => void): Either<never, B> {
    action(this.value);
    return this;
  }
}
