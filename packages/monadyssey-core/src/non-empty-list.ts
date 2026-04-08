import { Ordering } from "./ordering";
import { None, Option, Some } from "./option";

export type Nel<A> = NonEmptyList<A>;

/**
 * Represents a non-empty list, ensuring there is always at least one element.
 * @template A The type of elements in the list.
 */
export class NonEmptyList<A> {
  /**
   * Constructs a new instance of NonEmptyList with a head and a tail.
   * The head element ensures the list is non-empty, while the tail may contain zero or more additional elements.
   *
   * @param {A} head The first element of the list, ensuring the list is non-empty.
   * @param {A[]} tail An array of the remaining elements in the list, which can be empty.
   */
  constructor(
    public readonly head: A,
    public readonly tail: A[]
  ) {}

  /**
   * Creates a NonEmptyList containing a single element.
   *
   * @template A The type of the element.
   * @param {A} value The single element.
   * @returns {NonEmptyList<A>} A NonEmptyList with one element and an empty tail.
   *
   * @example
   * const list = NonEmptyList.pure(42);
   * list.head;       // 42
   * list.toArray();  // [42]
   */
  public static pure<A>(value: A): NonEmptyList<A> {
    return new NonEmptyList(value, []);
  }

  /**
   * Creates a new instance of NonEmptyList from an array.
   * The array must have at least one element; otherwise, an error is thrown to ensure the NonEmptyList's non-empty property.
   *
   * @template A The type of elements in the list.
   * @param {A[]} value The array of elements to convert into a NonEmptyList.
   * @return {NonEmptyList<A>} A new instance of NonEmptyList containing the elements from the given array.
   * @throws {Error} Throws an error if the input array is null, undefined, or empty.
   *
   * @example
   * const list = NonEmptyList.fromArray([1, 2, 3]);
   * list.head; // 1
   */
  public static fromArray<A>(value: A[]): NonEmptyList<A> {
    if (!value || value.length === 0) {
      throw new Error("Cannot construct a NonEmptyList from a null or empty array.");
    }
    const [head, ...tail] = value;
    return new NonEmptyList<A>(head, tail);
  }

  /**
   * Returns the total number of elements in the NonEmptyList.
   *
   * @return {number} The total number of elements.
   */
  public get size(): number {
    return 1 + this.tail.length;
  }

  /**
   * Returns all elements as a plain array.
   *
   * @return {A[]} An array containing all elements, starting with the head followed by the tail.
   */
  public toArray(): A[] {
    return [this.head, ...this.tail];
  }

  /**
   * Returns all elements as a plain array.
   *
   * @deprecated Use {@link toArray} instead.
   * @return {A[]} An array containing all elements.
   */
  public get all(): A[] {
    return this.toArray();
  }

  /**
   * Returns all elements except the last.
   *
   * @return {A[]} An array of all elements except the last. For a single-element list, returns an empty array.
   *
   * @example
   * NonEmptyList.fromArray([1, 2, 3]).init; // [1, 2]
   * NonEmptyList.pure(1).init;              // []
   */
  public get init(): A[] {
    if (this.tail.length === 0) return [];
    return [this.head, ...this.tail.slice(0, -1)];
  }

  /**
   * Returns the last element of the NonEmptyList.
   *
   * @returns {A} The last element.
   *
   * @example
   * NonEmptyList.fromArray([1, 2, 3]).last; // 3
   * NonEmptyList.pure(42).last;             // 42
   */
  public get last(): A {
    return this.tail.length > 0 ? this.tail[this.tail.length - 1] : this.head;
  }

  /**
   * Retrieves an element at a specific index from the NonEmptyList.
   * The index is zero-based, where 0 corresponds to the head.
   *
   * @param {number} index The zero-based index of the element to retrieve.
   * @return {A} The element at the specified index.
   * @throws {Error} If the index is negative or out of bounds.
   *
   * @example
   * NonEmptyList.fromArray([10, 20, 30]).get(1); // 20
   */
  public get(index: number): A {
    if (index < 0 || index >= this.size) {
      throw new Error(`Index ${index} is out of bounds. Must be between 0 and ${this.size - 1}`);
    }
    return index === 0 ? this.head : this.tail[index - 1];
  }

  /**
   * Applies a function to each element, producing a new NonEmptyList.
   *
   * @template B The type of elements in the resulting list.
   * @param {function(A): B} f A function applied to each element.
   * @return {NonEmptyList<B>} A new NonEmptyList with the transformed elements.
   *
   * @example
   * NonEmptyList.fromArray([1, 2, 3]).map(n => n * 2);
   * // NonEmptyList [2, 4, 6]
   */
  public map<B>(f: (value: A) => B): NonEmptyList<B> {
    return new NonEmptyList(f(this.head), this.tail.map(f));
  }

  /**
   * Applies a function that returns a NonEmptyList to each element, then flattens the results.
   *
   * @template B The type of elements in the resulting list.
   * @param {function(A): NonEmptyList<B>} f A function that maps each element to a NonEmptyList.
   * @return {NonEmptyList<B>} A flattened NonEmptyList of the results.
   *
   * @example
   * NonEmptyList.fromArray([1, 2]).flatMap(n => new NonEmptyList(n, [n * 10]));
   * // NonEmptyList [1, 10, 2, 20]
   */
  public flatMap<B>(f: (value: A) => NonEmptyList<B>): NonEmptyList<B> {
    const headResult = f(this.head);
    const tailResults = this.tail.flatMap((x) => f(x).toArray());
    return new NonEmptyList(headResult.head, [...headResult.tail, ...tailResults]);
  }

  /**
   * Applies an async function to each element, collecting results into a NonEmptyList.
   *
   * @template B The type of elements in the resulting list.
   * @param {function(A): Promise<B>} f An async function applied to each element.
   * @return {Promise<NonEmptyList<B>>} A Promise resolving to a NonEmptyList of the results.
   *
   * @example
   * const result = await NonEmptyList.fromArray([1, 2, 3])
   *   .traverse(async n => n * 2);
   * // NonEmptyList [2, 4, 6]
   */
  public async traverse<B>(f: (value: A) => Promise<B>): Promise<NonEmptyList<B>> {
    const [headResult, ...tailResults] = await Promise.all([f(this.head), ...this.tail.map(f)]);
    return new NonEmptyList(headResult, tailResults);
  }

  /**
   * Reduces the elements from left to right using an accumulator.
   *
   * @template B The type of the accumulator/result.
   * @param {B} start The initial accumulator value.
   * @param {function(B, A): B} f A function that combines the accumulator with each element.
   * @return {B} The final accumulated result.
   *
   * @example
   * NonEmptyList.fromArray([1, 2, 3]).foldLeft(0, (acc, n) => acc + n); // 6
   */
  public foldLeft<B>(start: B, f: (accumulator: B, value: A) => B): B {
    return this.tail.reduce(f, f(start, this.head));
  }

  /**
   * Reduces the elements from right to left using an accumulator.
   *
   * @template B The type of the accumulator/result.
   * @param {B} start The initial accumulator value.
   * @param {function(A, B): B} f A function that combines each element with the accumulator.
   * @return {B} The final accumulated result.
   *
   * @example
   * NonEmptyList.fromArray(["a", "b", "c"]).foldRight("", (s, acc) => acc + s); // "cba"
   */
  public foldRight<B>(start: B, f: (value: A, accumulator: B) => B): B {
    const all = this.toArray();
    return all.reduceRight((prev, curr) => f(curr, prev), start);
  }

  /**
   * Reduces the elements using a combining function, without requiring an initial value.
   * This is safe because the list is guaranteed to be non-empty.
   *
   * @param {function(A, A): A} f A function that combines two elements.
   * @return {A} The result of reducing all elements.
   *
   * @example
   * NonEmptyList.fromArray([1, 2, 3]).reduce((a, b) => a + b); // 6
   * NonEmptyList.pure(42).reduce((a, b) => a + b);             // 42
   */
  public reduce(f: (a: A, b: A) => A): A {
    return this.tail.reduce(f, this.head);
  }

  /**
   * Returns `true` if at least one element satisfies the predicate.
   *
   * @param {function(A): boolean} predicate A function to test each element.
   * @return {boolean} `true` if any element matches, `false` otherwise.
   *
   * @example
   * NonEmptyList.fromArray([1, 2, 3]).exists(n => n > 2); // true
   * NonEmptyList.fromArray([1, 2, 3]).exists(n => n > 5); // false
   */
  public exists(predicate: (value: A) => boolean): boolean {
    return predicate(this.head) || this.tail.some(predicate);
  }

  /**
   * Returns `true` if all elements satisfy the predicate.
   *
   * @param {function(A): boolean} predicate A function to test each element.
   * @return {boolean} `true` if every element matches, `false` otherwise.
   *
   * @example
   * NonEmptyList.fromArray([2, 4, 6]).forall(n => n % 2 === 0); // true
   * NonEmptyList.fromArray([2, 3, 6]).forall(n => n % 2 === 0); // false
   */
  public forall(predicate: (value: A) => boolean): boolean {
    return predicate(this.head) && this.tail.every(predicate);
  }

  /**
   * Filters elements by a predicate. Returns a plain array because filtering may remove all elements.
   *
   * @param {function(A): boolean} f A predicate function.
   * @return {A[]} An array of elements matching the predicate. May be empty.
   *
   * @example
   * NonEmptyList.fromArray([1, 2, 3, 4]).filter(n => n > 2); // [3, 4]
   * NonEmptyList.fromArray([1, 2]).filter(n => n > 10);       // []
   */
  public filter(f: (value: A) => boolean): A[] {
    const result: A[] = [];
    if (f(this.head)) result.push(this.head);
    for (const item of this.tail) {
      if (f(item)) result.push(item);
    }
    return result;
  }

  /**
   * Sorts the elements using a comparator that returns an Ordering.
   *
   * @param {function(A, A): Ordering} comparator A function that compares two elements.
   * @return {NonEmptyList<A>} A new sorted NonEmptyList.
   *
   * @example
   * NonEmptyList.fromArray([3, 1, 2]).sort((a, b) =>
   *   a < b ? Ordering.LT : a > b ? Ordering.GT : Ordering.EQ
   * );
   * // NonEmptyList [1, 2, 3]
   */
  public sort(comparator: (a: A, b: A) => Ordering): NonEmptyList<A> {
    const sorted = this.toArray().sort((a, b) => comparator(a, b).value);
    return new NonEmptyList(sorted[0], sorted.slice(1));
  }

  /**
   * Appends an element to the end, returning a new NonEmptyList.
   *
   * @param {A} element The element to append.
   * @returns {NonEmptyList<A>} A new list with the element at the end.
   *
   * @example
   * NonEmptyList.fromArray([1, 2]).append(3).toArray(); // [1, 2, 3]
   */
  public append(element: A): NonEmptyList<A> {
    return new NonEmptyList(this.head, [...this.tail, element]);
  }

  /**
   * Prepends an element to the beginning, returning a new NonEmptyList.
   *
   * @param {A} element The element to place at the front.
   * @returns {NonEmptyList<A>} A new list with the element at the beginning.
   *
   * @example
   * NonEmptyList.fromArray([2, 3]).prepend(1).toArray(); // [1, 2, 3]
   */
  public prepend(element: A): NonEmptyList<A> {
    return new NonEmptyList(element, [this.head, ...this.tail]);
  }

  /**
   * Concatenates this NonEmptyList with another, returning a new NonEmptyList.
   *
   * @param {NonEmptyList<A>} other The list to concatenate.
   * @returns {NonEmptyList<A>} A new list containing all elements of both lists.
   *
   * @example
   * const a = NonEmptyList.fromArray([1, 2]);
   * const b = NonEmptyList.fromArray([3, 4]);
   * a.concat(b).toArray(); // [1, 2, 3, 4]
   */
  public concat(other: NonEmptyList<A>): NonEmptyList<A> {
    return new NonEmptyList(this.head, [...this.tail, other.head, ...other.tail]);
  }

  /**
   * Reverses the order of elements, returning a new NonEmptyList.
   *
   * @returns {NonEmptyList<A>} A new list with elements in reverse order.
   *
   * @example
   * NonEmptyList.fromArray([1, 2, 3]).reverse().toArray(); // [3, 2, 1]
   */
  public reverse(): NonEmptyList<A> {
    const reversed = this.toArray().reverse();
    return new NonEmptyList(reversed[0], reversed.slice(1));
  }

  /**
   * Finds the first element that satisfies the predicate.
   *
   * @param {(value: A) => boolean} predicate A function that tests each element.
   * @returns {Option<A>} `Some(value)` if a matching element is found, `None` otherwise.
   *
   * @example
   * NonEmptyList.fromArray([1, 3, 4]).find(x => x % 2 === 0); // Some(4)
   * NonEmptyList.fromArray([1, 3, 5]).find(x => x > 10);       // None
   */
  public find(predicate: (value: A) => boolean): Option<A> {
    if (predicate(this.head)) {
      return Some.pure(this.head as NonNullable<A>);
    }
    const index = this.tail.findIndex(predicate);
    if (index !== -1) {
      return Some.pure(this.tail[index] as NonNullable<A>);
    }
    return None.Instance;
  }

  /**
   * Returns a string representation of the NonEmptyList.
   *
   * @return {string} A string showing all elements.
   *
   * @example
   * NonEmptyList.fromArray([1, 2, 3]).toString(); // "[1, 2, 3]"
   */
  public toString(): string {
    return `[${this.toArray().join(", ")}]`;
  }
}
