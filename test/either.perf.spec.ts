import { perf, save } from "./perf.conf";
import { Either, Left, Right } from "../src";

describe("Either simulation", () => {
  afterAll(() => {
    save();
  });

  it("warmup", () => {
    perf("warmup", () => {});
  });

  it("Right.of", () => {
    perf("Right.of", () => Right.of(42));
  });

  it("Right.map", () => {
    perf("map", () => Right.of(41).map((num) => num + 1));
  });

  it("Right.mapLeft", () => {
    perf("mapLeft", () => Right.of(41).mapLeft((num) => num * 2));
  });

  it("Right.flatMap with Right", () => {
    perf("flatMap with Right", () => Right.of(50).flatMap((n) => Right.of(n + 50)));
  });

  it("Right.flatMap with Left", () => {
    perf("flatMap with Left", () => Right.of(50).flatMap((n) => Left.of(n + 50)));
  });

  it("Right.tap", () => {
    perf("tap", () => Right.of(41).tap((num) => num + 1));
  });

  it("Right.tapLeft", () => {
    perf("tapLeft", () => Right.of(41).tapLeft((num) => num * 2));
  });

  it("Left.of", () => {
    perf("Left.of", () => Left.of(42));
  });

  it("Left.map", () => {
    perf("map", () => Left.of(41).map((num) => num + 1));
  });

  it("Left.mapLeft", () => {
    perf("mapLeft", () => (Left.of(41) as Either<number, string>).mapLeft((num) => num * 2));
  });

  it("Left.flatMap with Right", () => {
    perf("flatMap with Right", () => Left.of(50).flatMap((n) => Right.of(n + 50)));
  });

  it("Left.flatMap with Left", () => {
    perf("flatMap with Left", () => Left.of(50).flatMap((n) => Left.of(n + 50)));
  });

  it("Left.tap", () => {
    perf("tap", () => Left.of(41).tap((num) => num + 1));
  });

  it("Left.tapLeft", () => {
    perf("tapLeft", () => Left.of(41).tapLeft((num) => num * 2));
  });
});
