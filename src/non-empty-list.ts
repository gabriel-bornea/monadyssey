export type Nel<A> = NonEmptyList<A>;

/**
 * `NonEmptyList` is a data type used in __monadyssey__ to model arrays
 * that guarantee to have at least one value.
 */
export class NonEmptyList<A> {
  constructor(
    public readonly head: A,
    public readonly tail: A[]
  ) {}

  public get size(): number {
    return 1 + this.tail.length;
  }

  public get all(): A[] {
    return [this.head, ...this.tail];
  }

  public get = (index: number): A => {
    if (index === undefined || index < 0 || index > this.size) {
      throw new Error(`Index ${index} is not in 0..${this.size - 1}`);
    } else {
      return this.all[index];
    }
  };

  public static fromArray = <A>(value: A[]): NonEmptyList<A> => {
    switch (true) {
      case value && value.length === 1:
        return new NonEmptyList<A>(value[0], []);
      case value && value.length > 1:
        return new NonEmptyList<A>(value[0], value.slice(1));
      case !value || value.length === 0:
        throw new Error("Cannot construct a NonEmptyList from a null or empty array.");
      default:
        throw new Error("Uncovered case detected.");
    }
  };

  public filter = (f: (value: A) => boolean): NonEmptyList<A> | A[] => {
    const filtered = this.all.filter(f);
    return filtered.length > 0 ? NonEmptyList.fromArray(filtered) : [];
  };

  public map = <B>(f: (value: A) => B): NonEmptyList<B> => NonEmptyList.fromArray(this.all.map(f));

  public flatMap = <B>(f: (value: A) => NonEmptyList<B>): NonEmptyList<B> =>
    NonEmptyList.fromArray(this.all.map(f).flatMap((nel) => nel.all));

  public traverse = async <B>(f: (value: A) => Promise<B>): Promise<NonEmptyList<B>> => {
    const awaited = await Promise.all(this.all.map(f));
    return NonEmptyList.fromArray(awaited);
  };

  public foldLeft = <B>(start: B, f: (accumulator: B, value: A) => B): B => this.all.reduce(f, start);

  public foldRight = <B>(start: B, f: (value: A, accumulator: B) => B): B =>
    this.all.reduceRight((prev, curr) => {
      return f(curr, prev);
    }, start);

  public toString = (): string => `[${this.head}, ${this.tail.join(", ")}]`;
}
