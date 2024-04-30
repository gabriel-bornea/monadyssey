/**
 * Represents an optional value: every Option is either Some and contains a value, or None and does not.
 * @typeParam A - The type of the element contained within a `Some`.
 */
export interface Option<A> {
  type: "Some" | "None";

  map<B>(f: (value: A) => B): Option<B>;

  flatMap<B>(f: (value: A) => Option<B>): Option<B>;
}

interface OptionContract<A> {

  /**
   * Function description for `map` that applies to both Some and None.
   * @param f - A transformation function to apply to the contained value (if any).
   * @returns An Option containing the transformed value or None if there is no value.
   * @example
   * const some = Some.of(5);
   * const mappedSome = some.map(x => x + 1);  // Returns Some(6)
   * const none = None.Instance;
   * const mappedNone = none.map(x => x + 1);  // Returns None
   */
  map<B>(f: (value: A) => B): Option<B>;
}

/**
 * Represents an Option that contains no value.
 */
export class None implements OptionContract<never> {
  readonly type: "None" = "None" as const;
  private static readonly instance: None = new None();

  /**
   * Returns the singleton instance of `None`.
   */
  static get Instance() {
    return None.instance;
  }

  /**
   * @param _
   * @type {f: (value: A) => B): Option<B>}
   */
  map<B>(_: (value: never) => B): Option<B> {
    return None.instance;
  }

  /**
   * Always returns `None` since there is no value to transform into another Option.
   * @param _ - A function that would transform a value into an Option if it existed.
   * @returns The singleton `None` instance.
   */
  flatMap<B>(_: (value: never) => Option<B>): Option<B> {
    return None.instance;
  }
}

/**
 * Represents an Option carrying a value.
 */
export class Some<A> implements OptionContract<A> {
  readonly type: "Some" = "Some" as const;

  /**
   * Constructs a new `Some` instance that includes the provided value.
   * @param value - The value to wrap.
   */
  private constructor(public readonly value: A) {
  }

  /**
   * Creates a new `Some` instance containing the given value.
   * @param value - The value to wrap.
   * @returns A `Some` instance containing the value.
   * @typeParam A - The type of the element to wrap.
   */
  static of<A>(value: A): Some<A> {
    return new Some<A>(value);
  }

  map<B>(f: (value: A) => B): Option<B> {
    return Some.of(f(this.value));
  }

  /**
   * Applies a function to the contained value and returns the result, which must be an Option.
   * @param f - A function that transforms the contained value into an Option.
   * @returns The result of applying the function.
   * @typeParam B - The type of the element inside the returned Option.
   */
  flatMap<B>(f: (value: A) => Option<B>): Option<B> {
    return f(this.value);
  }
}

/**
 * Namespace for factory functions for creating `Some` and `None` instances and for working with optional values.
 */
const Option = {
  Some<A>(value: A): Some<A> {
    return Some.of(value);
  },
  None: None.Instance,
  /**
   * Creates an Option instance from a value that may be null or undefined.
   * If the value is null or undefined, Option.None is returned.
   * Otherwise, Option.Some is returned with the given value.
   *
   * @param {A | null | undefined} value - The value to create the Option instance from.
   * @returns {Option<A>} - The created Option instance.
   */
  ofNullable<A>(value: A | null | undefined): Option<A> {
    return value === null || value === undefined ? Option.None : Option.Some(value);
  },
};

/**
 * Function to handle options and return a string based on the option type.
 * @param o - The option to handle.
 * @returns A string indicating the content of the option or "n/a" if None.
 */
function handleOption(o: Option<string>) {
  o.map(s => s.length);
  switch (o.type) {
  case "None":
    return "n/a";
  case "Some":
    return o.value;
  }
}

const a = Option.ofNullable("test").fla;

