/**
 * The `Reader` type is a construct that allows for
 * dependency injection without side effects, promoting cleaner and more
 * maintainable code. It encapsulates an environment and provides it implicitly
 * to functions that require it, avoiding the need to pass dependencies
 * explicitly through every layer of an application.
 *
 * The `Reader` type supports various operations, including mapping,
 * flatMapping, lifting functions into the Reader context, and combining
 * multiple Reader instances. It is particularly useful in scenarios where
 * managing dependencies such as configurations or shared resources can become
 * cumbersome and error-prone.
 *
 * Type Parameters:
 * - `R`: The type of the environment that the Reader depends on.
 * - `A`: The type of the value produced by the Reader computation.
 *
 * Usage Example:
 * ```typescript
 * // Define an environment type
 * type Env = { apiEndpoint: string };
 *
 * // Define a Reader that fetches data using the environment's API endpoint
 * const fetchData = Reader.ask<Env>().flatMap(env =>
 *   Reader.of(fetch(`${env.apiEndpoint}/data`).then(response => response.json()))
 * );
 *
 * // Define a function to run the Reader with a specific environment
 * const runFetchData = async (env: Env) => {
 *   const data = await fetchData.run(env);
 *   console.log(data); // Handle fetched data
 * };
 *
 * // Example environment
 * const env: Env = { apiEndpoint: 'https://api.example.com' };
 *
 * // Execute the function
 * runFetchData(env);
 * ```
 */
export class Reader<R, A> {
  /**
   * Initializes a new `Reader` instance.
   *
   * A `Reader` represents a computation that needs an environment `R` to produce
   * a value of type `A`. This makes it easier to manage dependencies and side effects
   * in a functional programming style, promoting cleaner and more maintainable code.
   *
   * @param {function(R): A} f - A function that takes an environment of type `R`
   *  and returns a value of type `A`.
   *
   * @example
   * // Define an environment type
   * type Env = { apiEndpoint: string };
   *
   * // Define a function that uses the environment to fetch data
   * const fetchData = (env: Env) => fetch(`${env.apiEndpoint}/data`).then(response => response.json());
   *
   * // Create a Reader instance with the function
   * const reader = new Reader(fetchData);
   *
   * // Define an environment
   * const env: Env = { apiEndpoint: 'https://api.example.com' };
   *
   * // Run the Reader with the provided environment
   * reader.run(env).then(data => console.log(data));
   */
  public constructor(private f: (env: R) => A) {}

  /**
   * Creates a new `Reader` instance that ignores the environment and always returns
   * the provided value.
   *
   * This is useful for lifting a value into the `Reader` context, allowing
   * you to work with the value in a way that is consistent with other `Reader` computations
   * without requiring any environment.
   *
   * @param value - The value to be returned by the `Reader`.
   * @returns A new `Reader` instance that always returns the provided value.
   *
   * @example
   * // Creating a Reader that always returns the value 42
   * const reader = Reader.of<number, number>(42);
   *
   * // Running the Reader with any environment will always return 42
   * console.log(reader.run(10)); // 42
   * console.log(reader.run({})); // 42
   */
  static of<R, A>(value: A): Reader<R, A> {
    return new Reader(() => value);
  }

  /**
   * Transforms the result of the `Reader` computation by applying the provided
   * function to its value.
   *
   * This allows you to change the value produced by the `Reader` without
   * altering the environment. It is useful for chaining operations in a functional
   * style, where each step can modify the result of the previous computation.
   *
   * @param f - A function that takes the result of the `Reader` and returns a new value.
   * @returns A new `Reader` instance that applies the transformation function to the result.
   *
   * @example
   * // Creating a Reader that returns the length of a string from the environment
   * const reader = Reader.ask<string>().map(env => env.length);
   *
   * // Running the Reader with an environment string will return its length
   * console.log(reader.run("Hello, world!")); // 13
   * console.log(reader.run("TypeScript"));    // 10
   */
  map<B>(f: (a: A) => B): Reader<R, B> {
    return new Reader((env: R) => f(this.run(env)));
  }

  /**
   * Chains a new `Reader` computation to the result of the current `Reader`.
   *
   * This method allows you to sequence `Reader` operations, where the result of one
   * computation can determine the next computation. It is useful for creating complex
   * workflows that depend on the environment and previous results.
   *
   * @param f - A function that takes the result of the current `Reader` and returns a new `Reader`.
   * @returns A new `Reader` instance that represents the chained computation.
   *
   * @example
   * // Creating a Reader that fetches data and then processes it
   * const fetchData = Reader.ask<{ apiEndpoint: string }>().flatMap(env =>
   *   Reader.of(fetch(`${env.apiEndpoint}/data`).then(response => response.json()))
   * );
   *
   * const processData = fetchData.flatMap(data =>
   *   Reader.of(data.map(item => item.value))
   * );
   *
   * // Running the Reader with an environment will fetch and process the data
   * processData.run({ apiEndpoint: 'https://api.example.com' }).then(console.log);
   */
  flatMap<B>(f: (a: A) => Reader<R, B>): Reader<R, B> {
    return new Reader((env: R) => f(this.run(env)).run(env));
  }

  /**
   * Creates a `Reader` instance that provides access to the environment.
   *
   * This is useful when you need to obtain the environment itself
   * within a `Reader` computation. It returns a `Reader` that, when run, simply
   * returns the environment.
   *
   * @returns A new `Reader` instance that returns the environment.
   *
   * @example
   * // Creating a Reader that returns the environment
   * const reader = Reader.ask<{ apiEndpoint: string }>();
   *
   * // Running the Reader will return the provided environment
   * const env = { apiEndpoint: 'https://api.example.com' };
   * console.log(reader.run(env)); // { apiEndpoint: 'https://api.example.com' }
   *
   * // Combining with map to access a specific part of the environment
   * const apiEndpointReader = reader.map(env => env.apiEndpoint);
   * console.log(apiEndpointReader.run(env)); // 'https://api.example.com'
   */
  static ask<R>(): Reader<R, R> {
    return new Reader((env: R) => env);
  }

  /**
   * Lifts a function into the `Reader` context, allowing it to be applied
   * to the result of a `Reader` computation.
   *
   * This static method is useful for transforming the result of a `Reader`
   * using a regular function. It takes a function that operates on a value
   * and returns a new function that operates on a `Reader`.
   *
   * @param f - A function that takes a value and returns a new value.
   * @returns A function that takes a `Reader` and returns a new `Reader` with the transformed result.
   *
   * @example
   * // Define a function to be lifted
   * const toUpperCase = (s: string) => s.toUpperCase();
   *
   * // Create a Reader that reads a string from the environment
   * const reader = Reader.ask<string>();
   *
   * // Lift the function into the Reader context
   * const upperCaseReader = Reader.lift(toUpperCase)(reader);
   *
   * // Running the Reader will apply the function to the environment value
   * console.log(upperCaseReader.run("hello")); // "HELLO"
   * console.log(upperCaseReader.run("world")); // "WORLD"
   */
  static lift<R, A, B>(f: (a: A) => B): (ra: Reader<R, A>) => Reader<R, B> {
    return (ra: Reader<R, A>) => ra.map(f);
  }

  /**
   * Combines multiple `Reader` instances into a single `Reader` that produces a tuple
   * of their results when run with the same environment.
   *
   * This is useful for executing multiple `Reader` computations
   * in parallel and collecting their results into a single value.
   *
   * @param readers - An array of `Reader` instances to be combined.
   * @returns A new `Reader` instance that returns a tuple of the results of the given `Reader` instances.
   *
   * @example
   * // Create multiple Readers that read different values from the environment
   * const readerA = Reader.ask<{ valueA: number, valueB: string, valueC: boolean }>().map(env => env.valueA);
   * const readerB = Reader.ask<{ valueA: number, valueB: string, valueC: boolean }>().map(env => env.valueB);
   * const readerC = Reader.ask<{ valueA: number, valueB: string, valueC: boolean }>().map(env => env.valueC);
   *
   * // Combine the Readers
   * const combinedReader = Reader.parZip(readerA, readerB, readerC);
   *
   * // Running the combined Reader will return a tuple of the results
   * const env = { valueA: 42, valueB: "hello", valueC: true };
   * console.log(combinedReader.run(env)); // [42, "hello", true]
   */
  static parZip<R, A extends any[]>(...readers: { [K in keyof A]: Reader<R, A[K]> }): Reader<R, A> {
    return new Reader((env: R) => readers.map((reader) => reader.run(env)) as A);
  }

  /**
   * Creates a new `Reader` that applies a transformation to the environment before
   * running the provided `Reader` computation.
   *
   * This static method is useful for temporarily modifying the environment for a specific
   * computation, allowing you to adjust the context in which the `Reader` runs without
   * affecting the broader environment.
   *
   * @param f - A function that takes the current environment and returns a modified environment.
   * @param reader - The `Reader` instance to run with the modified environment.
   * @returns A new `Reader` instance that runs the provided `Reader` with the transformed environment.
   *
   * @example
   * // Define an environment type
   * type Env = { apiEndpoint: string, version: string };
   *
   * // Create a Reader that reads the API endpoint from the environment
   * const reader = Reader.ask<Env>().map(env => env.apiEndpoint);
   *
   * // Define a function to modify the environment
   * const upgradeApi = (env: Env) => ({ ...env, version: 'v2' });
   *
   * // Create a new Reader that uses the modified environment
   * const modifiedReader = Reader.local(upgradeApi, reader);
   *
   * // Define an example environment
   * const env: Env = { apiEndpoint: 'https://api.example.com', version: 'v1' };
   *
   * // Run the original Reader with the example environment
   * console.log(reader.run(env)); // 'https://api.example.com'
   *
   * // Run the modified Reader with the example environment
   * console.log(modifiedReader.run(env)); // 'https://api.example.com'
   */
  static local<R, A>(f: (env: R) => R, reader: Reader<R, A>): Reader<R, A> {
    return new Reader((env: R) => reader.run(f(env)));
  }

  /**
   * Executes the `Reader` computation with the given environment.
   *
   * This method is used to run the `Reader` and obtain its result by providing
   * the necessary environment. It applies the environment to the encapsulated
   * function and returns the computed value.
   *
   * @param env - The environment to be provided to the `Reader` computation.
   * @returns The result of the `Reader` computation.
   *
   * @example
   * // Define an environment type
   * type Env = { apiEndpoint: string };
   *
   * // Create a Reader that reads the API endpoint from the environment
   * const reader = Reader.ask<Env>().map(env => env.apiEndpoint);
   *
   * // Define an example environment
   * const env: Env = { apiEndpoint: 'https://api.example.com' };
   *
   * // Run the Reader with the example environment
   * console.log(reader.run(env)); // 'https://api.example.com'
   */
  run(env: R): A {
    return this.f(env);
  }
}
