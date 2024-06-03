/**
 * Throws a NotImplementedYet error indicating that a feature or functionality is not yet implemented.
 * This function is typically used as a placeholder for incomplete functionality.
 *
 * @throws {NotImplementedYetError} Throws a NotImplementedYet error with a message "Not implemented yet".
 * @returns {never} This function never returns as it always throws an error.
 *
 * @example
 * function someFunction() {
 *   TODO();
 * }
 */
export function TODO(): never {
  throw new NotImplementedYetError("Not implemented yet");
}

/**
 * Returns the input value without any modification. This function serves as an identity function,
 * returning the same value that is passed to it.
 *
 * @template A The type of the input value.
 * @param {A} a The input value.
 * @returns {A} The same value that was passed as input.
 *
 * @example
 * // Returns 5
 * identity(5);
 *
 * // Returns "Hello"
 * identity("Hello");
 *
 * // Returns { x: 10, y: 20 }
 * identity({ x: 10, y: 20 });
 */
export function identity<A>(a: A): A {
  return a;
}

/**
 * Represents an error indicating that a feature or functionality is not yet implemented.
 * This error is typically thrown to indicate that a particular functionality is still pending development.
 *
 * @extends Error
 * @param {string} message The error message.
 * @property {string} name The name of the error, set to "NotImplementedYetError".
 *
 * @example
 * throw new NotImplementedYetError("Functionality not yet implemented.");
 */
export class NotImplementedYetError extends Error {
  /**
   * Constructs a new NotImplementedYetError error with the provided message.
   * @param {string} message The error message.
   */
  constructor(message: string) {
    super(message);
    this.name = "NotImplementedYetError";
  }
}
