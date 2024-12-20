import { Ordering } from "./ordering";

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
   * Returns the total number of elements in the NonEmptyList.
   * It is computed as one plus the length of the tail array, ensuring the count reflects the non-empty nature of the list.
   *
   * @return {number} The total number of elements in the NonEmptyList.
   */
  public get size(): number {
    return 1 + this.tail.length;
  }

  /**
   * Retrieves all elements of the NonEmptyList as an array.
   * This includes the head element followed by all elements in the tail, preserving their order.
   *
   * @return {A[]} An array containing all elements of the NonEmptyList, starting with the head and followed by the tail elements.
   */
  public get all(): A[] {
    return [this.head, ...this.tail];
  }

  /**
   * Retrieves an element at a specific index from the NonEmptyList.
   * The index is zero-based, where 0 corresponds to the head of the list.
   * If the index is out of bounds, an error is thrown.
   *
   * @param {number} index The zero-based index of the element to retrieve.
   * @return {A} The element at the specified index.
   * @throws {Error} Throws an error if the index is undefined, negative, or out of bounds.
   */
  public get(index: number): A {
    if (index < 0 || index >= this.size) {
      throw new Error(`Index ${index} is out of bounds. Must be between 0 and ${this.size - 1}`);
    }
    return this.all[index];
  }

  /**
   * Creates a new instance of NonEmptyList from an array.
   * The array must have at least one element; otherwise, an error is thrown to ensure the NonEmptyList's non-empty property.
   * If the array has exactly one element, it becomes the head of the list with an empty tail.
   * If the array has more than one element, the first element becomes the head, and the rest form the tail.
   *
   * @template A The type of elements in the list.
   * @param {A[]} value The array of elements to convert into a NonEmptyList.
   * @return {NonEmptyList<A>} A new instance of NonEmptyList containing the elements from the given array.
   * @throws {Error} Throws an error if the input array is null, undefined, or empty.
   */
  public static fromArray<A>(value: A[]): NonEmptyList<A> {
    if (!value || value.length === 0) {
      throw new Error("Cannot construct a NonEmptyList from a null or empty array.");
    }
    const [head, ...tail] = value;
    return new NonEmptyList<A>(head, tail);
  }

  /**
   * Filters the elements of the NonEmptyList based on a predicate function.
   * Returns a new NonEmptyList containing all elements that match the predicate.
   * If no elements match, an empty array is returned instead.
   * This method ensures that the returned value respects the predicate, but it may not preserve the non-empty nature of the original list if no elements match.
   *
   * @param {function(A): boolean} f A predicate function to test each element of the list.
   *                                 The function should return `true` for elements to be included in the new list.
   * @return {NonEmptyList<A> | A[]} A new NonEmptyList containing the elements that match the predicate if any;
   *                                 otherwise, an empty array is returned.
   */
  public filter(f: (value: A) => boolean): NonEmptyList<A> | A[] {
    const filtered = this.all.filter(f);
    return filtered.length > 0 ? NonEmptyList.fromArray(filtered) : [];
  }

  /**
   * Sorts the elements of the NonEmptyList based on a comparator function that returns an Ordering.
   * Returns a new NonEmptyList with the elements sorted.
   *
   * @param {function(A, A): Ordering} comparator A function that compares two elements of the list and returns an Ordering.
   * @return {NonEmptyList<A>} A new NonEmptyList with the elements sorted based on the comparator.
   */
  public sort(comparator: (a: A, b: A) => Ordering): NonEmptyList<A> {
    const sortedArray = [...this.all].sort((a, b) => comparator(a, b).value);
    return NonEmptyList.fromArray(sortedArray);
  }

  /**
   * Applies a function to each element in the NonEmptyList, creating a new NonEmptyList from the results.
   * This method is useful for transforming each element in the list from one form to another.
   * The transformation function is applied in order, from the head to the end of the tail.
   * The resulting NonEmptyList will maintain the same number of elements as the original.
   *
   * @template B The type of elements in the new NonEmptyList resulting from the transformation.
   * @param {function(A): B} f A function that transforms an element of type A into an element of type B.
   * @return {NonEmptyList<B>} A new NonEmptyList containing the elements resulting from the application of the function `f` to each element of the original list.
   */
  public map<B>(f: (value: A) => B): NonEmptyList<B> {
    return NonEmptyList.fromArray(this.all.map(f));
  }

  /**
   * Applies a function to each element in the NonEmptyList, where each function call returns a NonEmptyList.
   * The results are then flattened into a single NonEmptyList. This method is useful for when each element in the list
   * may map to multiple elements in the resulting list. It ensures that the structure of a NonEmptyList is preserved
   * even after the mapping and flattening process.
   *
   * @template B The type of elements in the resulting NonEmptyList after the flatMap operation.
   * @param {function(A): NonEmptyList<B>} f A function that takes an element of type A and returns a NonEmptyList of type B.
   * @return {NonEmptyList<B>} A new NonEmptyList resulting from the concatenation of all NonEmptyLists returned by applying `f` to each element of the original list.
   */
  public flatMap<B>(f: (value: A) => NonEmptyList<B>): NonEmptyList<B> {
    return NonEmptyList.fromArray(this.all.flatMap((x) => f(x).all));
  }

  /**
   * Asynchronously applies a function to each element in the NonEmptyList, where the function returns a Promise.
   * Waits for all promises to resolve and then constructs a new NonEmptyList from the resolved values.
   * This method is useful for performing asynchronous operations on each element of the list,
   * such as fetching data from a remote server, in a way that ensures the operation completes for all elements
   * before constructing the resulting list.
   *
   * @template B The type of elements in the resulting NonEmptyList after all promises have resolved.
   * @param {function(A): Promise<B>} f A function that takes an element of type A and returns a Promise that resolves to type B.
   * @return {Promise<NonEmptyList<B>>} A Promise that resolves to a new NonEmptyList containing the elements resulting from the resolved promises.
   */
  public async traverse<B>(f: (value: A) => Promise<B>): Promise<NonEmptyList<B>> {
    const results = await Promise.all(this.all.map(f));
    return NonEmptyList.fromArray(results);
  }

  /**
   * Reduces the elements of the NonEmptyList from left to right, using a provided accumulator function.
   * Starts with an initial value and combines it with the first element of the list, then continues to combine
   * the result with each subsequent element in order. This method is useful for aggregating list values into a single
   * result, such as summing numbers or concatenating strings.
   *
   * @template B The type of the accumulator/result.
   * @param {B} start The initial value to start the fold with. This value will be the basis for the first application
   *                  of the accumulator function alongside the first (leftmost) element of the list.
   * @param {function(B, A): B} f A function that takes an accumulator of type B and a value of type A from the list,
   *                              and returns a new accumulator of type B. This function is applied to each element
   *                              in the list in order, starting from the left.
   * @return {B} The result of folding the list from left to right using the accumulator function and starting value.
   */
  public foldLeft<B>(start: B, f: (accumulator: B, value: A) => B): B {
    return this.all.reduce(f, start);
  }

  /**
   * Reduces the elements of the NonEmptyList from right to left, using a provided accumulator function.
   * This method starts with an initial value and combines it with the last element of the list, then continues to combine
   * the result with each preceding element in reverse order. It is useful for operations where the fold direction
   * influences the result, such as in certain string manipulations or when constructing data structures that depend on
   * the order of combination.
   *
   * @template B The type of the accumulator/result.
   * @param {B} start The initial value to start the fold with. This value will be combined with the last (rightmost)
   *                  element of the list first, proceeding backwards towards the first element.
   * @param {function(A, B): B} f An accumulator function that takes a value of type A from the list and an accumulator
   *                              of type B, and returns a new accumulator of type B. This function is applied in reverse
   *                              order, starting from the right.
   * @return {B} The result of folding the list from right to left using the accumulator function and starting value.
   */
  public foldRight<B>(start: B, f: (value: A, accumulator: B) => B): B {
    return this.all.reduceRight((prev, curr) => f(curr, prev), start);
  }

  /**
   * Generates a string representation of the NonEmptyList.
   * This method provides a convenient way to visualize the contents of the list,
   * showing each element separated by commas within square brackets. It starts with the head of the list,
   * followed by the elements in the tail (if any), mimicking the conventional array notation in JavaScript.
   *
   * @return {string} A string representation of the NonEmptyList, including all of its elements.
   */
  public toString(): string {
    return `[${this.all.join(", ")}]`;
  }
}
