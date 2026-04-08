import { html, perf } from "../conf/simulation";
import { None, Some } from "../../src";

describe("Option simulation", () => {
  afterAll(() => {
    html("Option");
  });

  it("Some.pure", () => {
    perf("Some.pure", () => Some.pure(42));
  });

  it("Some.map", () => {
    perf("map", () => Some.pure(41).map((num) => num + 1));
  });

  it("Some.flatMap with Some", () => {
    perf("flatMap with Some", () => Some.pure(50).flatMap((n) => Some.pure(n + 50)));
  });

  it("Some.flatMap with None", () => {
    perf("flatMap with None", () => Some.pure(50).flatMap((_) => None.Instance));
  });

  it("Some.tap", () => {
    perf("tap", () => Some.pure(41).tap((num) => num + 1));
  });

  it("None.of", () => {
    perf("None.of", () => None.Instance);
  });

  it("None.map", () => {
    perf("map", () => None.Instance.map((num) => num + 1));
  });

  it("None.flatMap with Some", () => {
    perf("flatMap with Some", () => None.Instance.flatMap((n) => Some.pure(n + 50)));
  });

  it("None.flatMap with None", () => {
    perf("flatMap with None", () => None.Instance.flatMap((_) => None.Instance));
  });

  it("None.tap", () => {
    perf("tap", () => None.Instance.tap((num) => num + 1));
  });

  it("None.tapNone", () => {
    perf("tapNone", () => None.Instance.tapNone(() => {}));
  });
});
