import { perf, save } from "./perf.conf";
import { IO } from "../src";

describe("IO simulation", () => {
  afterAll(() => {
    save();
  });

  it("warmup", () => {
    perf("warmup", () => {});
  });

  it("without wrapping", () => {
    perf("without wrapping", () => Promise.resolve(42));
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

  it("runAsync", () => {
    perf("runAsync", () => {
      IO.ofSync(() => 42)
        .flatMap((num) => IO.ofSync(() => num + 1))
        .runAsync();
    });
  });
});
