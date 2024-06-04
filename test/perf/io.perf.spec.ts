import { html, perf } from "../conf/simulation";
import { IO } from "../../src";

describe("IO simulation", () => {
  afterAll(() => {
    html("IO");
  });

  it("of", () => {
    perf("of", () => IO.of(() => Promise.resolve(42)));
  });

  it("ofSync", () => {
    perf("ofSync", () => IO.ofSync(() => 42));
  });

  it("ok", () => {
    perf("ok", () => IO.ok(42));
  });

  it("err", () => {
    perf("err", () => IO.err("Some unexpected error"));
  });

  it("map", () => {
    perf("map", () => IO.ofSync(() => 42).map((num) => num + 1));
  });

  it("flatMap", () => {
    perf("flatMap", () => IO.ofSync(() => 42).flatMap((num) => IO.ofSync(() => num + 1)));
  });

  it("parZip", () => {
    perf("parZip", async () => {
      const a = IO.ofSync(() => 42);
      const b = IO.ofSync(() => 20);
      const c = IO.ofSync(() => 12);

      const effect = IO.parZip(a, b, c, (f, s, t) => f + s + t);

      await effect.runAsync();
    });
  });

  it("runAsync", () => {
    perf("runAsync", () => {
      IO.ofSync(() => 42)
        .flatMap((num) => IO.ofSync(() => num + 1))
        .runAsync();
    });
  });

  it("forM", () => {
    perf("forM", async () => {
      const effect = IO.forM(async (bind) => {
        const a = await bind(IO.ofSync(() => 1));
        const b = await bind(IO.ofSync(() => 2));
        const c = await bind(IO.ofSync(() => 3));

        return a + b + c;
      });

      await effect.runAsync();
    });
  });
});
