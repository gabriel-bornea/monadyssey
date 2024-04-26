import { IO } from "./io.ts";
import { Either, Left, Right } from "./either.ts";

class ContinuationError<E> extends Error {
  constructor(public readonly error: E) {
    super("ContinuationException");
  }
}

class IOContext<E> {
  async bind<A>(e: Either<E, A> | IO<E, A>): Promise<A> {
    return e.fold(
      (e) => {
        throw new ContinuationError(e);
      },
      (v) => v,
    );
  }
}

function io<E, A>(block: (io: IOContext<E>) => A): IO<E, A> {
  try {
    return IO.ofSync(() => Right.of(block(new IOContext<E>())));
  } catch (error) {
    if (error instanceof ContinuationError) {
      return Left.of(error.error);
    } else {
      throw error;
    }
  }
}

const name = Right.of("John");
const age = Left.of("Error");

const result: IO<string, string> = io<string, string>((ioContext) => {
  const n = ioContext.bind(name);
  const a = ioContext.bind(age);

  return `${n}: ${a}`;
});

function rule1(): IO<string, number> {
  return io<string, number>((ioContext) => {
    return ioContext.bind(age);
  });
}

result.runAsync();
