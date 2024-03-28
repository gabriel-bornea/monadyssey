/* eslint-disable @typescript-eslint/no-explicit-any */

import { NonEmptyList } from "./non-empty-list.ts";

export interface Ok<A> {
  type: "Ok";
  value: A;
}

export interface Err<E> {
  type: "Err";
  error: E;
}

export const ok = <A>(value: A): Ok<A> => ({ type: "Ok", value });
export const err = <E>(error: E): Err<E> => ({ type: "Err", error: error });

export class IO<E, A> {
  private constructor(private effect: () => Promise<Err<E> | Ok<A>>) {}

  static of = <E, A>(a: () => Promise<A>): IO<E, A> =>
    new IO(async () => {
      try {
        const value = await a();
        return ok(value);
      } catch (error: unknown) {
        return err(error as E);
      }
    });

  static ofSync = <E, A>(f: () => A): IO<E, A> =>
    new IO(() => {
      try {
        const value = f();
        return Promise.resolve(ok(value));
      } catch (error: unknown) {
        return Promise.resolve(err(error as E));
      }
    });

  static empty = <A>(): IO<unknown, A> => new IO(async () => ok(undefined as any as A));

  static identity = <A>(a: A): IO<unknown, A> => new IO(async () => ok(a));

  static failed = <E, A>(error: E): IO<E, A> => new IO(() => Promise.resolve(err(error)));

  refine = (predicate: (a: A) => boolean, handle: (a: A) => E): IO<E, A> =>
    new IO(async () => {
      const result = await this.effect();
      if (this._ok(result) && predicate(result.value)) {
        return ok(result.value);
      } else if (this._ok(result)) {
        return err(handle(result.value));
      }
      return result;
    });

  map = <B>(f: (a: A) => B): IO<E, B> =>
    new IO(async () => {
      const result = await this.effect();
      return this._ok(result) ? (ok(f(result.value)) as Ok<B>) : result;
    });

  mapError = <F extends E>(f: (e: E) => F): IO<F, A> =>
    new IO(async () => {
      const result = await this.effect();

      if (this._ok(result)) {
        return result;
      } else {
        return err(f(result.error));
      }
    });

  mapNotNull = <B>(f: (a: NonNullable<A>) => B): IO<E, B> =>
    new IO(async () => {
      const result = await this.effect();
      return this._ok(result) && result.value
        ? (ok(f(result.value as NonNullable<A>)) as Ok<B>)
        : (result as unknown as Ok<B>);
    });

  flatMap = <B>(f: (a: A) => IO<E, B>): IO<E, B> =>
    new IO(async () => {
      const result = await this.effect();
      return this._ok(result) ? await f(result.value).runAsync() : result;
    });

  flatMapNotNull = <B>(f: (a: NonNullable<A>) => IO<E, B>) =>
    new IO(async () => {
      const result = await this.effect();
      return this._ok(result) && result.value
        ? await f(result.value as NonNullable<A>).runAsync()
        : (result as unknown as Ok<B>);
    });

  static zip2 = <E, A, B>(f1: IO<E, A>, f2: IO<E, B>): IO<NonEmptyList<E>, [A, B]> =>
    new IO(async () => {
      const results = await Promise.all([f1.runAsync(), f2.runAsync()]);
      if (results.every((result) => result.type === "Ok")) {
        const res = results as [Ok<A>, Ok<B>];
        return ok([res[0].value, res[1].value]);
      } else {
        const errors = results.flatMap((result) => (result.type === "Ok" ? [] : result.error));
        return err(NonEmptyList.fromArray(errors));
      }
    });

  static zip3 = <E, A, B, C>(f1: IO<E, A>, f2: IO<E, B>, f3: IO<E, C>): IO<NonEmptyList<E>, [A, B, C]> =>
    new IO(async () => {
      const results = await Promise.all([f1.runAsync(), f2.runAsync(), f3.runAsync()]);
      if (results.every((result) => result.type === "Ok")) {
        const res = results as [Ok<A>, Ok<B>, Ok<C>];
        return ok([res[0].value, res[1].value, res[2].value]);
      } else {
        const errors = results.flatMap((result) => (result.type === "Ok" ? [] : result.error));
        return err(NonEmptyList.fromArray(errors));
      }
    });

  recover = <B extends A>(f: (error: E) => IO<E, B>): IO<E, A> =>
    new IO(async () => {
      const result = await this.effect();
      switch (result.type) {
        case "Ok":
          return result;
        case "Err":
          return f(result.error).runAsync();
        default:
          throw new Error("Unexpected result type");
      }
    });

  tap = (f: (a: A) => void): IO<E, A> =>
    new IO(async () => {
      const result = await this.effect();
      if (this._ok(result)) {
        f(result.value);
      }
      return result;
    });

  tapError = (f: (error: E) => void): IO<E, A> =>
    new IO(async () => {
      const result = await this.effect();
      if (this._err(result)) {
        f(result.error);
      }
      return result;
    });

  handleErrorWith = (handle: (error: E) => E): IO<E, A> =>
    new IO(async () => {
      try {
        const result = await this.effect();
        if (this._err(result)) {
          return err(handle(result.error));
        }
        return result;
      } catch (error: any) {
        return err(handle(error));
      }
    });

  /**
   * Executes a function depending on the result of a Promise.
   *
   * @param {function(e: E): B} onFailure - The function to execute if the Promise fails.
   * @param {function(a: A): B} onSuccess - The function to execute if the Promise succeeds.
   * @returns {Promise<B>} The Promise that will resolve with the value returned by the executed function.
   */
  fold = <B>(onFailure: (e: E) => B, onSuccess: (a: A) => B): Promise<B> =>
    this.effect().then((result) => (this._ok(result) ? onSuccess(result.value) : onFailure(result.error)));

  /**
   * Executes the effect and returns a promise that contains either the successful value or {@code null}.
   */
  getOrNull = async (): Promise<A | null> => {
    const result = await this.effect();
    return this._ok(result) && result.value ? result.value : null;
  };

  /**
   * Asynchronously runs the effect and returns a Promise that resolves with either an Err or an Ok result.
   *
   * @returns {Promise<Err<E> | Ok<A>>} A Promise that resolves with the result of running the effect.
   */
  runAsync = (): Promise<Err<E> | Ok<A>> => this.effect();

  private _ok = <A>(effect: Err<E> | Ok<A>): effect is Ok<A> => effect.type === "Ok";
  private _err = <A>(effect: Err<E> | Ok<A>): effect is Err<E> => effect.type === "Err";
}
