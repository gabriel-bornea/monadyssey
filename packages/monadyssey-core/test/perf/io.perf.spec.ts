import { html, perf } from "../conf/simulation";
import { IO } from "../../src";

const iterations = 10000;

describe("IO simulation", () => {
  afterAll(() => {
    html("IO");
  });

  it("lift", () => {
    perf("lift", () => IO.lift(() => Promise.resolve(42)), iterations);
  });

  it("ok", () => {
    perf("ok", () => IO.ok(42), iterations);
  });

  it("err", () => {
    perf("err", () => IO.err("Some unexpected error"), iterations);
  });

  it("map", () => {
    perf("map", () => IO.lift(() => 42).map((num) => num + 1), iterations);
  });

  it("flatMap", () => {
    perf("flatMap", () => IO.lift(() => 42).flatMap((num) => IO.lift(() => num + 1)), iterations);
  });

  it("parMapN", () => {
    perf("parMapN", async () => {
      const a = IO.lift(() => 42);
      const b = IO.lift(() => 20);
      const c = IO.lift(() => 12);

      const effect = IO.parMapN(a, b, c, (f, s, t) => f + s + t);

      await effect.unsafeRun();
    }, iterations);
  });

  it("unsafeRun", () => {
    perf("unsafeRun", () => {
      IO.lift(() => 42)
        .flatMap((num) => IO.lift(() => num + 1))
        .unsafeRun();
    }, iterations);
  });

  it("Do", () => {
    perf("Do", async () => {
      const effect = IO.Do(async (bind) => {
        const a = await bind(IO.lift(() => 1));
        const b = await bind(IO.lift(() => 2));
        const c = await bind(IO.lift(() => 3));

        return a + b + c;
      });

      await effect.unsafeRun();
    }, iterations);
  });
});
