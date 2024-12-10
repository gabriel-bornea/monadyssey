import { describe, expect, it } from "@jest/globals";
import { identity, TODO } from "../src";

describe("utility functions", () => {
  it("identity returns given argument", () => {
    const argument = "test";
    expect(identity(argument)).toBe(argument);
  });

  it("TODO throws an error", () => {
    expect(TODO).toThrow("Not implemented yet");
  });
});
