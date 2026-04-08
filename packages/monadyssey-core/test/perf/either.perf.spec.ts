import { html, perf } from "../conf/simulation";
import { Either, Left, Right } from "../../src";

describe("Either simulation", () => {
  afterAll(() => {
    html("Either");
  });

  it("Right.pure", () => {
    perf("Right.pure", () => Right.pure(42));
  });

  it("Right.map", () => {
    perf("map", () => Right.pure(41).map((num) => num + 1));
  });

  it("Right.mapLeft", () => {
    perf("mapLeft", () => Right.pure(41).mapLeft((num) => num * 2));
  });

  it("Right.flatMap with Right", () => {
    perf("flatMap with Right", () => Right.pure(50).flatMap((n) => Right.pure(n + 50)));
  });

  it("Right.flatMap with Left", () => {
    perf("flatMap with Left", () => Right.pure(50).flatMap((n) => Left.pure(n + 50)));
  });

  it("Right.tap", () => {
    perf("tap", () => Right.pure(41).tap((num) => num + 1));
  });

  it("Right.tapLeft", () => {
    perf("tapLeft", () => Right.pure(41).tapLeft((num) => num * 2));
  });

  it("Left.pure", () => {
    perf("Left.pure", () => Left.pure(42));
  });

  it("Left.map", () => {
    perf("map", () => Left.pure(41).map((num) => num + 1));
  });

  it("Left.mapLeft", () => {
    perf("mapLeft", () => (Left.pure(41) as Either<number, string>).mapLeft((num) => num * 2));
  });

  it("Left.flatMap with Right", () => {
    perf("flatMap with Right", () => Left.pure(50).flatMap((n) => Right.pure(n + 50)));
  });

  it("Left.flatMap with Left", () => {
    perf("flatMap with Left", () => Left.pure(50).flatMap((n) => Left.pure(n + 50)));
  });

  it("Left.tap", () => {
    perf("tap", () => Left.pure(41).tap((num) => num + 1));
  });

  it("Left.tapLeft", () => {
    perf("tapLeft", () => Left.pure(41).tapLeft((num) => num * 2));
  });
});
