/**
 * Represents the result of comparing two values, encapsulating the possible outcomes of an ordering comparison.
 * The `Ordering` class provides a type-safe and expressive way to handle comparison results,
 * offering methods and static properties to facilitate common operations in sorting and comparison logic.
 *
 * **Possible Values of `Ordering`**:
 *
 * - `Ordering.LessThan` (alias `LT`): Indicates that the first value is less than the second.
 * - `Ordering.Equal` (alias `EQ`): Indicates that the first value is equal to the second.
 * - `Ordering.GreaterThan` (alias `GT`): Indicates that the first value is greater than the second.
 *
 * **Key Features**:
 *
 * - **Type Safety**: Encapsulates comparison results, reducing errors associated with using raw numeric values.
 * - **Functional Methods**: Provides methods like `match`, `flatMap`, `concat`, and `reverse` to work with ordering values in a functional style.
 * - **Comparator Utilities**: Includes static methods `from`, `comparing`, and `compareBy` to create and combine comparator functions.
 *
 * **Usage Examples**:
 *
 * **Basic Comparison**:
 *
 * ```typescript
 * const a = 5;
 * const b = 10;
 * const ordering = Ordering.from(a - b);
 *
 * ordering.match(
 *   () => console.log('a is less than b'),
 *   () => console.log('a is equal to b'),
 *   () => console.log('a is greater than b')
 * );
 * // Output: 'a is less than b'
 * ```
 *
 * **Sorting an Array**:
 *
 * ```typescript
 * const numbers = [3, 1, 4, 1, 5];
 * numbers.sort((a, b) => Ordering.from(a - b).value);
 * console.log(numbers);
 * // Output: [1, 1, 3, 4, 5]
 * ```
 *
 * **Using Comparators with Complex Types**:
 *
 * ```typescript
 * interface User {
 *   age: number;
 *   name: string;
 * }
 *
 * const users: User[] = [
 *   { age: 30, name: 'Charlie' },
 *   { age: 25, name: 'Alice' },
 *   { age: 30, name: 'Bob' },
 * ];
 *
 * const compareByAge = Ordering.comparing<User, number>(
 *   (u) => u.age,
 *   (a, b) => a - b
 * );
 *
 * const compareByName = Ordering.comparing<User, string>(
 *   (u) => u.name,
 *   (a, b) => a.localeCompare(b)
 * );
 *
 * const userComparator = Ordering.compareBy(compareByAge, compareByName);
 *
 * users.sort((a, b) => userComparator(a, b).value);
 * console.log(users);
 * // Output:
 * // [
 * //   { age: 25, name: 'Alice' },
 * //   { age: 30, name: 'Bob' },
 * //   { age: 30, name: 'Charlie' }
 * // ]
 * ```
 *
 * **Chaining Comparisons**:
 *
 * ```typescript
 * interface User {
 *   name: string;
 *   age: number;
 * }
 *
 * const user1: User = { name: 'Alice', age: 30 };
 * const user2: User = { name: 'Alice', age: 25 };
 *
 * const ordering = Ordering.from(user1.name.localeCompare(user2.name)).flatMap(() =>
 *   Ordering.from(user1.age - user2.age)
 * );
 *
 * ordering.match(
 *   () => console.log('user1 comes before user2'),
 *   () => console.log('user1 and user2 are equal'),
 *   () => console.log('user1 comes after user2')
 * );
 * // Output: 'user1 comes after user2' (because 30 > 25)
 * ```
 *
 * **Reversing an Ordering**:
 *
 * ```typescript
 * const a = 5;
 * const b = 10;
 * const ordering = Ordering.from(a - b).reverse();
 * console.log(ordering.type); // Output: 'GreaterThan'
 * ```
 *
 * **Design Considerations**:
 *
 * - **Immutability**: The `Ordering` instances are immutable and can be safely reused.
 * - **Singleton Instances**: Uses static instances for `LessThan`, `Equal`, and `GreaterThan` to prevent unnecessary object creation.
 *
 * **Aliases**:
 *
 * - `LT`: Alias for `Ordering.LessThan`
 * - `EQ`: Alias for `Ordering.Equal`
 * - `GT`: Alias for `Ordering.GreaterThan`
 *
 * **Common Use Cases**:
 *
 * - Implementing custom sorting logic for arrays and collections.
 * - Comparing optional values or complex data structures.
 * - Building composite comparators for multi-level sorting criteria.
 *
 * @export
 * @class Ordering
 */
export class Ordering {
  private constructor(
    public readonly value: -1 | 0 | 1,
    public readonly type: "LessThan" | "Equal" | "GreaterThan"
  ) {}

  /**
   * Indicates that the first value is less than the second.
   * @static
   * @type {Ordering}
   */
  static readonly LessThan: Ordering = new Ordering(-1, "LessThan");

  /**
   * Indicates that the first value is equal to the second.
   * @static
   * @type {Ordering}
   */
  static readonly Equal: Ordering = new Ordering(0, "Equal");

  /**
   * Indicates that the first value is greater than the second.
   * @static
   * @type {Ordering}
   */
  static readonly GreaterThan: Ordering = new Ordering(1, "GreaterThan");

  /**
   * Chains multiple `Ordering` computations, allowing for sequential comparisons based on multiple criteria.
   *
   * - If the current `Ordering` is `Equal`, it invokes the provided function `f` to obtain the next `Ordering`.
   * - If the current `Ordering` is `LessThan` or `GreaterThan`, it returns the current `Ordering` without invoking `f`.
   *
   * This method is useful when you have multiple comparison criteria and want to proceed to the next
   * comparison only if previous ones are equal. It enables the construction of composite comparisons in a functional and readable manner.
   *
   * @param {() => Ordering} f - A function that returns the next `Ordering` to consider if the current `Ordering` is `Equal`.
   * @returns {Ordering} The current `Ordering` if it is `LessThan` or `GreaterThan`; otherwise, the result of invoking `f`.
   *
   * @example
   * // Example: Comparing users by name, then by age if names are equal
   * interface User {
   *   name: string;
   *   age: number;
   * }
   *
   * const user1: User = { name: 'Alice', age: 30 };
   * const user2: User = { name: 'Alice', age: 25 };
   *
   * const ordering = Ordering.from(user1.name.localeCompare(user2.name)).flatMap(() =>
   *   Ordering.from(user1.age - user2.age)
   * );
   *
   * ordering.match(
   *   () => console.log('user1 comes before user2'),
   *   () => console.log('user1 and user2 are equal'),
   *   () => console.log('user1 comes after user2')
   * );
   * // Output: 'user1 comes after user2' (because 30 > 25)
   */
  flatMap(f: () => Ordering): Ordering {
    return this.type === "Equal" ? f() : this;
  }

  /**
   * Executes one of the provided functions based on the current `Ordering`, effectively performing pattern matching.
   *
   * - If the `Ordering` is `LessThan`, it invokes `onLessThan`.
   * - If the `Ordering` is `Equal`, it invokes `onEqual`.
   * - If the `Ordering` is `GreaterThan`, it invokes `onGreaterThan`.
   *
   * This method allows you to handle each possible outcome of an `Ordering` explicitly, similar to pattern matching in functional programming languages.
   *
   * @template B The return type of the provided functions and the `match` method.
   * @param {() => B} onLessThan - Function to execute if the `Ordering` is `LessThan`.
   * @param {() => B} onEqual - Function to execute if the `Ordering` is `Equal`.
   * @param {() => B} onGreaterThan - Function to execute if the `Ordering` is `GreaterThan`.
   * @returns {B} The result of the function corresponding to the current `Ordering`.
   *
   * @example
   * const a = 5;
   * const b = 10;
   * const ordering = Ordering.from(a - b);
   * const message = ordering.match(
   *   () => 'a is less than b',
   *   () => 'a is equal to b',
   *   () => 'a is greater than b'
   * );
   * console.log(message);
   * // Output: 'a is less than b'
   */
  match<B>(onLessThan: () => B, onEqual: () => B, onGreaterThan: () => B): B {
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
   * Reverses the current `Ordering`, effectively inverting the comparison result.
   *
   * - `LessThan` becomes `GreaterThan`
   * - `GreaterThan` becomes `LessThan`
   * - `Equal` remains `Equal`
   *
   * This method is useful when you want to invert the sorting order or reverse the result of a comparison.
   *
   * @returns {Ordering} The reversed `Ordering`.
   *
   * @example
   * // Example: Reversing the ordering to sort numbers in descending order
   * const numbers = [1, 2, 3, 4, 5];
   *
   * // Sort in ascending order
   * numbers.sort((a, b) => Ordering.from(a - b).value);
   * console.log(numbers);
   * // Output: [1, 2, 3, 4, 5]
   *
   * // Sort in descending order using reverse()
   * numbers.sort((a, b) => Ordering.from(a - b).reverse().value);
   * console.log(numbers);
   * // Output: [5, 4, 3, 2, 1]
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
   * Performs a side effect based on the current `Ordering` and returns the `Ordering` unchanged.
   *
   * This method is useful for executing side effects (such as logging, debugging, or updating external state) without interrupting the flow of method chaining. It allows you to observe or react to the current `Ordering` while continuing to work with it in a fluent interface style.
   *
   * @param {(ordering: Ordering) => void} f - A function that takes the current `Ordering` as an argument and performs a side effect.
   * @returns {Ordering} The current `Ordering`, allowing for method chaining.
   *
   * @example
   * // Example: Logging the Ordering during a comparison
   * const a = 5;
   * const b = 10;
   *
   * const ordering = Ordering.from(a - b).tap(o => console.log(`Ordering is: ${o.type}`));
   * // Output: 'Ordering is: LessThan'
   *
   * // Continue using the ordering
   * ordering.match(
   *   () => console.log('a is less than b'),
   *   () => console.log('a is equal to b'),
   *   () => console.log('a is greater than b')
   * );
   * // Output: 'a is less than b'
   */
  tap(f: (ordering: Ordering) => void): Ordering {
    f(this);
    return this;
  }

  /**
   * Combines this `Ordering` with another `Ordering`, returning the first non-`Equal` result.
   *
   * - If the current `Ordering` is not `Equal` (`LessThan` or `GreaterThan`), it returns the current `Ordering`.
   * - If the current `Ordering` is `Equal`, it returns the `other` `Ordering`.
   *
   * This method is useful when you have multiple comparison criteria and want to determine the overall `Ordering` by considering each criterion in sequence. It allows you to combine two `Ordering` instances, effectively cascading the comparison to the next criterion if the current one is inconclusive (`Equal`).
   *
   * @param {Ordering} other - The next `Ordering` to consider if the current `Ordering` is `Equal`.
   * @returns {Ordering} The first non-`Equal` `Ordering`; if both are `Equal`, returns `Equal`.
   *
   * @example
   * // Example: Combining orderings to compare strings by length and then alphabetically
   * const compareByLength = (a: string, b: string): Ordering =>
   *   Ordering.from(a.length - b.length);
   *
   * const compareAlphabetically = (a: string, b: string): Ordering =>
   *   Ordering.from(a.localeCompare(b));
   *
   * const compareStrings = (a: string, b: string): Ordering =>
   *   compareByLength(a, b).concat(compareAlphabetically(a, b));
   *
   * const result = compareStrings('apple', 'banana');
   *
   * result.match(
   *   () => console.log('"apple" comes before "banana"'),
   *   () => console.log('"apple" and "banana" are equal'),
   *   () => console.log('"apple" comes after "banana"')
   * );
   * // Output: '"apple" comes before "banana"' (because 'apple' is shorter than 'banana')
   *
   * @example
   * // Using concat in sorting an array of strings by length, then alphabetically
   * const fruits = ['kiwi', 'apple', 'banana', 'cherry', 'date'];
   *
   * const compareByLength = (a: string, b: string): Ordering =>
   *   Ordering.from(a.length - b.length);
   *
   * const compareAlphabetically = (a: string, b: string): Ordering =>
   *   Ordering.from(a.localeCompare(b));
   *
   * fruits.sort((a, b) =>
   *   compareByLength(a, b).concat(compareAlphabetically(a, b)).value
   * );
   *
   * console.log(fruits);
   * // Output: [ 'date', 'kiwi', 'apple', 'banana', 'cherry' ]
   * // Explanation:
   * // - 'date' has length 4
   * // - 'kiwi' has length 4
   * // - 'date' comes before 'kiwi' alphabetically
   * // - 'apple' has length 5
   * // - 'banana' and 'cherry' have length 6
   * // - 'banana' comes before 'cherry' alphabetically
   * // - They are sorted alphabetically among themselves
   */
  concat(other: Ordering): Ordering {
    return this.type !== "Equal" ? this : other;
  }

  /**
   * Converts a numeric comparison result into an `Ordering` instance.
   *
   * This static method interprets the sign of a number to determine the corresponding `Ordering`:
   *
   * - **`Ordering.LessThan`**: Returned if `num` is less than zero (`num < 0`).
   * - **`Ordering.Equal`**: Returned if `num` is exactly zero (`num === 0`).
   * - **`Ordering.GreaterThan`**: Returned if `num` is greater than zero (`num > 0`).
   *
   * **Important Note**: The input `num` must be a valid number and not `NaN`. If `num` is `NaN`, the method throws an error to prevent unexpected behavior.
   *
   * **Use Cases**:
   *
   * - Converting the result of numerical comparisons (e.g., `a - b`) into an `Ordering`.
   * - Integrating with APIs or functions that use the `Ordering` type for comparison logic.
   * - Enhancing type safety by avoiding the use of raw numeric comparison results.
   *
   * @static
   * @param {number} num - The number to convert into an `Ordering` (must not be `NaN`).
   * @returns {Ordering} The corresponding `Ordering` based on the sign of `num`.
   * @throws {Error} Throws an error if `num` is `NaN`.
   *
   * @example
   * // Example: Using Ordering.from with numerical comparisons
   * const result1 = Ordering.from(5 - 10); // Returns Ordering.LessThan
   * const result2 = Ordering.from(10 - 5); // Returns Ordering.GreaterThan
   * const result3 = Ordering.from(5 - 5);  // Returns Ordering.Equal
   *
   * @example
   * // Example: Handling invalid input (NaN)
   * try {
   *   const invalidResult = Ordering.from(NaN);
   * } catch (error) {
   *   console.error(error.message); // Output: 'Cannot convert NaN to Ordering.'
   * }
   *
   * @example
   * // Example: Using Ordering.from in a custom comparator function
   * const compareNumbers = (a: number, b: number): Ordering => Ordering.from(a - b);
   *
   * const ordering = compareNumbers(15, 10);
   * console.log(ordering.type); // Output: 'GreaterThan'
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
   * Creates a comparator function for items of type `A` by comparing their keys of type `B`,
   * which are obtained via a selector function. The comparison of the keys is performed using
   * a provided comparator function for type `B`.
   *
   * This static method is useful for creating comparator functions for complex data structures,
   * where you need to sort or compare items based on a specific property or derived value.
   *
   * **How It Works**:
   *
   * - The `selector` function extracts a key of type `B` from an item of type `A`.
   * - The `comparator` function compares two keys of type `B` and returns a numeric result.
   * - The returned comparator function takes two items of type `A`, extracts their keys using the `selector`,
   *   compares the keys using the `comparator`, and converts the numeric result into an `Ordering` using `Ordering.from`.
   *
   * **Important Note**:
   *
   * - The `comparator` function should return a valid number (not `NaN`). If the result is `NaN`, an error is thrown.
   *
   * **Type Parameters**:
   *
   * - `A`: The type of the items to compare.
   * - `B`: The type of the keys extracted from the items.
   *
   * @static
   * @template A The type of the items to compare.
   * @template B The type of the keys to compare.
   * @param {(item: A) => B} selector - A function that selects the comparison key from an item of type `A`.
   * @param {(a: B, b: B) => number} comparator - A comparator function for keys of type `B` (should return a valid number, not `NaN`).
   * @returns {(a: A, b: A) => Ordering} A comparator function that takes two items of type `A` and returns an `Ordering`.
   * @throws {Error} Throws an error if the `comparator` function returns `NaN`.
   *
   * @example
   * // Example: Comparing users by age
   * interface User {
   *   name: string;
   *   age: number;
   * }
   *
   * const users: User[] = [
   *   { name: 'Alice', age: 30 },
   *   { name: 'Bob', age: 25 },
   *   { name: 'Charlie', age: 35 },
   * ];
   *
   * const compareByAge = Ordering.comparing<User, number>(
   *   user => user.age,                // Selector function to extract the age
   *   (a, b) => a - b                  // Comparator function for numbers
   * );
   *
   * // Using the comparator to sort the array
   * users.sort((a, b) => compareByAge(a, b).value);
   *
   * console.log(users);
   * // Output:
   * // [
   * //   { name: 'Bob', age: 25 },
   * //   { name: 'Alice', age: 30 },
   * //   { name: 'Charlie', age: 35 },
   * // ]
   *
   * @example
   * // Example: Comparing strings by length
   * const strings = ['apple', 'banana', 'cherry', 'date'];
   *
   * const compareByLength = Ordering.comparing<string, number>(
   *   str => str.length,             // Selector function to get the length
   *   (a, b) => a - b                // Comparator function for numbers
   * );
   *
   * strings.sort((a, b) => compareByLength(a, b).value);
   *
   * console.log(strings);
   * // Output: ['date', 'apple', 'banana', 'cherry']
   *
   * @example
   * // Example: Comparing products by price, handling potential NaN values
   * interface Product {
   *   name: string;
   *   price: number;
   * }
   *
   * const products: Product[] = [
   *   { name: 'Product A', price: 10 },
   *   { name: 'Product B', price: NaN }, // Invalid price
   *   { name: 'Product C', price: 5 },
   * ];
   *
   * const compareByPrice = Ordering.comparing<Product, number>(
   *   product => product.price,
   *   (a, b) => a - b
   * );
   *
   * try {
   *   products.sort((a, b) => compareByPrice(a, b).value);
   * } catch (error) {
   *   console.error(error.message); // Output: 'Comparator function returned NaN.'
   * }
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
   * Creates a composite comparator function by combining multiple comparator functions.
   *
   * This static method allows you to chain multiple comparator functions, applying them sequentially to compare two items of type `A`. It returns the result of the first comparator that does not return `Equal`. If all comparators return `Equal`, the combined comparator returns `Equal`.
   *
   * **How It Works**:
   *
   * - The method accepts a variable number of comparator functions (`comparators`), each of which compares two items of type `A` and returns an `Ordering`.
   * - The returned comparator function takes two items `a` and `b`, and applies each comparator in the provided order.
   * - For each comparator, if the result is not `Equal`, it returns that `Ordering` immediately.
   * - If all comparators return `Equal`, it returns `Ordering.Equal`.
   *
   * **Use Cases**:
   *
   * - Useful when you need to compare items based on multiple criteria, proceeding to the next criterion only if previous comparisons are inconclusive (`Equal`).
   * - Helps in building complex sorting logic in a clean and readable manner.
   *
   * **Type Parameters**:
   *
   * - `A`: The type of the items to compare.
   *
   * @static
   * @template A The type of the items to compare.
   * @param {...Array<(a: A, b: A) => Ordering>} comparators - A variable number of comparator functions to be combined.
   * @returns {(a: A, b: A) => Ordering} A composite comparator function that applies each comparator in order.
   *
   * @example
   * // Example: Comparing users by last name, then first name
   * interface User {
   *   firstName: string;
   *   lastName: string;
   *   age: number;
   * }
   *
   * const users: User[] = [
   *   { firstName: 'John', lastName: 'Doe', age: 30 },
   *   { firstName: 'Jane', lastName: 'Doe', age: 25 },
   *   { firstName: 'Alice', lastName: 'Smith', age: 28 },
   *   { firstName: 'Bob', lastName: 'Brown', age: 35 },
   * ];
   *
   * const compareByLastName = Ordering.comparing<User, string>(
   *   user => user.lastName,
   *   (a, b) => a.localeCompare(b)
   * );
   *
   * const compareByFirstName = Ordering.comparing<User, string>(
   *   user => user.firstName,
   *   (a, b) => a.localeCompare(b)
   * );
   *
   * const userComparator = Ordering.compareBy<User>(
   *   compareByLastName,
   *   compareByFirstName
   * );
   *
   * // Using the comparator to sort the array
   * users.sort((a, b) => userComparator(a, b).value);
   *
   * console.log(users);
   * // Output:
   * // [
   * //   { firstName: 'Bob', lastName: 'Brown', age: 35 },
   * //   { firstName: 'Jane', lastName: 'Doe', age: 25 },
   * //   { firstName: 'John', lastName: 'Doe', age: 30 },
   * //   { firstName: 'Alice', lastName: 'Smith', age: 28 },
   * // ]
   *
   * @example
   * // Example: Comparing products by category, then price
   * interface Product {
   *   name: string;
   *   category: string;
   *   price: number;
   * }
   *
   * const products: Product[] = [
   *   { name: 'Product A', category: 'Electronics', price: 99 },
   *   { name: 'Product B', category: 'Clothing', price: 49 },
   *   { name: 'Product C', category: 'Electronics', price: 199 },
   *   { name: 'Product D', category: 'Clothing', price: 29 },
   * ];
   *
   * const compareByCategory = Ordering.comparing<Product, string>(
   *   product => product.category,
   *   (a, b) => a.localeCompare(b)
   * );
   *
   * const compareByPrice = Ordering.comparing<Product, number>(
   *   product => product.price,
   *   (a, b) => a - b
   * );
   *
   * const productComparator = Ordering.compareBy<Product>(
   *   compareByCategory,
   *   compareByPrice
   * );
   *
   * // Using the comparator to sort the array
   * products.sort((a, b) => productComparator(a, b).value);
   *
   * console.log(products);
   * // Output:
   * // [
   * //   { name: 'Product D', category: 'Clothing', price: 29 },
   * //   { name: 'Product B', category: 'Clothing', price: 49 },
   * //   { name: 'Product A', category: 'Electronics', price: 99 },
   * //   { name: 'Product C', category: 'Electronics', price: 199 },
   * // ]
   *
   * @example
   * // Example: Using compareBy with different types of comparators
   * const compareByLength = Ordering.comparing<string, number>(
   *   str => str.length,
   *   (a, b) => a - b
   * );
   *
   * const compareAlphabetically = Ordering.comparing<string, string>(
   *   str => str,
   *   (a, b) => a.localeCompare(b)
   * );
   *
   * const stringComparator = Ordering.compareBy<string>(
   *   compareByLength,
   *   compareAlphabetically
   * );
   *
   * const strings = ['apple', 'banana', 'cherry', 'date', 'fig'];
   *
   * strings.sort((a, b) => stringComparator(a, b).value);
   *
   * console.log(strings);
   * // Output: ['fig', 'date', 'apple', 'banana', 'cherry']
   *
   * // Explanation:
   * // - 'fig' has length 3
   * // - 'date' has length 4
   * // - 'apple', 'banana', and 'cherry' have length 5, sorted alphabetically
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

/**
 * Alias for `Ordering.LessThan`.
 *
 * Represents the `Ordering` where the first value is less than the second.
 *
 * @example
 * if (ordering === LT) {
 *   console.log('First value is less than the second.');
 * }
 *
 * @see Ordering.LessThan
 */
export const LT = Ordering.LessThan;

/**
 * Alias for `Ordering.Equal`.
 *
 * Represents the `Ordering` where the first value is equal to the second.
 *
 * @example
 * if (ordering === EQ) {
 *   console.log('Values are equal.');
 * }
 *
 * @see Ordering.Equal
 */
export const EQ = Ordering.Equal;

/**
 * Alias for `Ordering.GreaterThan`.
 *
 * Represents the `Ordering` where the first value is greater than the second.
 *
 * @example
 * if (ordering === GT) {
 *   console.log('First value is greater than the second.');
 * }
 *
 * @see Ordering.GreaterThan
 */
export const GT = Ordering.GreaterThan;
