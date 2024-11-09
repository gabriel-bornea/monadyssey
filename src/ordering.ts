export class Ordering {
  private constructor(
    public readonly value: -1 | 0 | 1,
    public readonly type: "LessThan" | "Equal" | "GreaterThan"
  ) {}

  static readonly LessThan = new Ordering(-1, "LessThan");
  static readonly Equal = new Ordering(0, "Equal");
  static readonly GreaterThan = new Ordering(1, "GreaterThan");

  /**
   * Chains Ordering computations.
   * If the current Ordering is Equal, it applies the provided function to get the next Ordering.
   * Otherwise, it returns the current Ordering.
   * @param f - A function that returns an Ordering.
   * @returns The combined Ordering.
   */
  flatMap(f: () => Ordering): Ordering {
    return this.type === "Equal" ? f() : this;
  }

  /**
   * Folds over the Ordering to produce a value.
   * @param onLessThan - Function to call if the Ordering is LessThan.
   * @param onEqual - Function to call if the Ordering is Equal.
   * @param onGreaterThan - Function to call if the Ordering is GreaterThan.
   * @returns The result of the called function.
   */
  fold<B>(onLessThan: () => B, onEqual: () => B, onGreaterThan: () => B): B {
    switch (this.type) {
      case "LessThan":
        return onLessThan();
      case "Equal":
        return onEqual();
      case "GreaterThan":
        return onGreaterThan();
    }
  }

  /**
   * Reverses the Ordering.
   * @returns The reversed Ordering.
   */
  reverse(): Ordering {
    switch (this.type) {
      case "LessThan":
        return Ordering.GreaterThan;
      case "Equal":
        return Ordering.Equal;
      case "GreaterThan":
        return Ordering.LessThan;
    }
  }

  /**
   * Performs a side effect based on the current Ordering.
   * @param f - Function to perform the side effect.
   * @returns The current Ordering.
   */
  tap(f: (ordering: Ordering) => void): Ordering {
    f(this);
    return this;
  }

  /**
   * Combines two Ordering values.
   * If the current Ordering is not Equal, it returns the current Ordering.
   * Otherwise, it returns the other Ordering.
   * @param other - The other Ordering to combine with.
   * @returns The combined Ordering.
   */
  concat(other: Ordering): Ordering {
    return this.type !== "Equal" ? this : other;
  }

  /**
   * Converts a number to an Ordering.
   * @param num - The number to convert (must not be NaN).
   * @returns LessThan if num < 0, GreaterThan if num > 0, Equal if num === 0.
   * @throws {Error} Throws an error if num is NaN.
   */
  static from(num: number): Ordering {
    if (isNaN(num)) {
      throw new Error("Cannot convert NaN to Ordering.");
    }
    if (num < 0) return Ordering.LessThan;
    if (num > 0) return Ordering.GreaterThan;
    return Ordering.Equal;
  }

  /**
   * Creates a comparator function based on a selector and comparator.
   * @param selector - Function to select the comparison key from an item.
   * @param comparator - Comparator function for the selected keys (should return a valid number, not NaN).
   * @returns A comparator function that returns an Ordering.
   * @throws {Error} Throws an error if comparator returns NaN.
   */
  static comparing<A, B>(selector: (item: A) => B, comparator: (a: B, b: B) => number): (a: A, b: A) => Ordering {
    return (a: A, b: A) => {
      const result = comparator(selector(a), selector(b));
      if (isNaN(result)) {
        throw new Error("Comparator function returned NaN.");
      }
      return Ordering.from(result);
    };
  }

  /**
   * Combines multiple comparator functions into one.
   * @param comparators - An array of comparator functions.
   * @returns A comparator function that applies each comparator in order.
   */
  static compareBy<A>(...comparators: Array<(a: A, b: A) => Ordering>): (a: A, b: A) => Ordering {
    return (a: A, b: A) => {
      for (const comparator of comparators) {
        const result = comparator(a, b);
        if (result.type !== "Equal") {
          return result;
        }
      }
      return Ordering.Equal;
    };
  }
}

export const LT = Ordering.LessThan;
export const EQ = Ordering.Equal;
export const GT = Ordering.GreaterThan;
