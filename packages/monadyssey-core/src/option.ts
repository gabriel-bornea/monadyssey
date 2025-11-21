import { identity } from "./utils";

/**
 * Represents an optional value. Every `Option<A>` is either `Some<A>` containing a value or `None` representing absence of value.
 * This interface supports operations like map, flatMap, and facilitates exhaustive type-checking through type narrowing.
 * @typeParam A - The type of the element contained within a `Some`.
 */
export abstract class Option<A> {
  abstract type: "Some" | "None";

  /**
   * Creates an Option instance from a value that may be null or undefined.
   * If the value is null or undefined, Option.None is returned.
   * Otherwise, Option.Some is returned with the given value.
   *
   * @template A The type of the value used to create an Option instance.
   * @param {A | null | undefined} value - The value to create the Option instance from.
   * @returns {Option<A>} - The created Option instance.
   * @example
   * const maybeNumber = Option.ofNullable(5); // Returns Some(5)
   * const maybeNull = Option.ofNullable(null); // Returns None
   */
  static ofNullable<A>(value: A | null | undefined): Option<NonNullable<A>> {
    return value === null || value === undefined ? None.Instance : Some.of(value as NonNullable<A>);
  }

  /**
   * Property to access the actual `Option` instance, enabling exhaustive type checking and type narrowing.
   * Use this when a switch statement needs to handle each subtype distinctly.
   *
   * @example
   * function getLength(text: Option<string>): number {
   *   switch (text.self.type) {
   *     case "Some":
   *       // Type narrowing allows direct access to the `value`.
   *       return text.self.value.length;
   *     case "None":
   *       return 0;
   *   }
   * }
   */
  abstract self: None | Some<A>;

  /**
   * Transforms the `Option`'s value using a provided function, returning a new `Option` with the result.
   * If the `Option` is `None`, it returns `None`.
   * @example
   * const numberOption = Option.Some(5);
   * const incrementedOption = numberOption.map(x => x + 1); // Returns Some(6)
   */
  map<B>(f: (value: A) => B): Option<B> {
    return this.flatMap((value) => {
      const result = f(value);
      return result === null || result === undefined ? None.Instance : Some.of(result as NonNullable<B>);
    });
  }

  /**
   * Applies a function that returns an `Option` to the `Option`'s value, if it exists, and flattens the result.
   * If the `Option` is `None`, it returns `None`.
   * @example
   * const numberOption = Option.Some(5);
   * const nestedOption = numberOption.flatMap(x => Option.Some(x + 1)); // Returns Some(6)
   */
  abstract flatMap<B>(f: (value: A) => Option<B>): Option<B>;

  /**
   * Returns this `Option` if it is a `Some` and the predicate returns `true`, otherwise returns `None`.
   * @param predicate - The predicate to test the value against.
   * @example
   * Option.Some(5).filter(x => x > 0); // Returns Some(5)
   * Option.Some(-5).filter(x => x > 0); // Returns None
   */
  abstract filter(predicate: (value: A) => boolean): Option<A>;

  /**
   * Executes a provided function if this `Option` is a `Some`, typically used for side effects.
   * Returns the original `Option` instance to facilitate method chaining.
   * @example
   * Option.Some(5).tap(value => console.log(value)); // Logs "5"
   * Option.None.tap(value => console.log(value)); // Does nothing
   */
  abstract tap(f: (value: A) => void): Option<A>;

  /**
   * Executes a provided function if this `Option` is a `None`, typically used for side effects.
   * Returns the original `Option` instance to facilitate method chaining.
   * @example
   * Option.Some(5).tapNone(() => console.log("No value")); // Does nothing
   * Option.None.tapNone(() => console.log("No value")); // Logs "No value"
   */
  abstract tapNone(f: () => void): Option<A>;

  /**
   * Applies one of two provided functions based on the contents of this `Option`.
   * If it is `None`, it applies `ifNone`. If it is `Some`, it applies `ifSome`.
   * @returns The result of the applied function.
   * @example
   * const result = Option.Some(5).fold(
   *   () => 'No value',
   *   value => 'Value is ' + value
   * ); // Returns 'Value is 5'
   */
  abstract fold<B>(ifNone: () => B, ifSome: (value: A) => B): B;

  /**
   * Returns the contained value if `Some`, otherwise returns `null`.
   * @example
   * const value = Option.Some(5).getOrNull(); // Returns 5
   * const empty = Option.None.getOrNull(); // Returns null
   */
  getOrNull(): A | null {
    return this.fold(() => null, identity);
  }

  /**
   * Returns the contained value if `Some`, otherwise returns the provided default value.
   * @example
   * const value = Option.Some(5).getOrElse(() => 10); // Returns 5
   * const empty = Option.None.getOrElse(() => 10); // Returns 10
   */
  getOrElse(defaultValue: () => A): A {
    return this.fold(() => defaultValue(), identity);
  }
}

/**
 * Represents an Option that contains no value.
 */
export class None extends Option<never> {
  readonly type = "None" as const;
  readonly self = this;
  private static readonly instance: None = new None();

  private constructor() {
    super();
  }

  /**
   * Returns the singleton instance of `None`.
   * @example
   * const emptyOption = None.Instance;
   */
  static get Instance() {
    return None.instance;
  }

  flatMap<B>(_: (value: never) => Option<B>): Option<B> {
    return this;
  }

  filter(_: (value: never) => boolean): Option<never> {
    return this;
  }

  fold<B>(ifNone: () => B, _: (right: never) => B): B {
    return ifNone();
  }

  getOrElse(defaultValue: () => never): never {
    return defaultValue();
  }

  getOrNull(): null {
    return null;
  }

  tap(_: (value: never) => void): Option<never> {
    return this;
  }

  tapNone(f: () => void): Option<never> {
    f();
    return this;
  }
}

/**
 * Represents an Option carrying a value.
 */
export class Some<A> extends Option<NonNullable<A>> {
  readonly type = "Some" as const;
  readonly self = this;

  private constructor(public readonly value: NonNullable<A>) {
    super();
  }

  /**
   * Creates a new `Some` instance containing the given value.
   * @param value - The value to wrap.
   * @returns A `Some` instance containing the value.
   * @example
   * const someOption = Some.of(10);
   */
  static of<A>(value: NonNullable<A>): Some<NonNullable<A>> {
    return new Some<NonNullable<A>>(value);
  }

  flatMap<B>(f: (value: NonNullable<A>) => Option<B>): Option<B> {
    return f(this.value);
  }

  filter(predicate: (value: NonNullable<A>) => boolean): Option<NonNullable<A>> {
    return predicate(this.value) ? this : None.Instance;
  }

  fold<B>(_: () => B, ifSome: (right: NonNullable<A>) => B): B {
    return ifSome(this.value);
  }

  getOrElse(_: () => NonNullable<A>): NonNullable<A> {
    return this.value;
  }

  getOrNull(): NonNullable<A> {
    return this.value;
  }

  tap(f: (value: NonNullable<A>) => void): Option<NonNullable<A>> {
    f(this.value);
    return this;
  }

  tapNone(_: () => void): Option<NonNullable<A>> {
    return this;
  }
}
