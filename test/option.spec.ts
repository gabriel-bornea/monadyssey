import { describe, expect, it } from "@jest/globals";
import { Option, Some, None } from "../src";

describe("Option", () => {
  describe("map", () => {
    it("should transform the value of a Some instance", () => {
      const option: Option<number> = Some.of(5);
      const mapped = option.map((value) => value * 2);
      expect(mapped).toEqual(Some.of(10));
    });

    it("should not affect a None instance", () => {
      const option: Option<number> = None.Instance;
      const mapped = option.map((value) => value * 2);
      expect(mapped).toEqual(None.Instance);
    });
  });

  describe("flatMap", () => {
    it("should chain operations for a Some instance", () => {
      const option: Option<number> = Some.of(5);
      const result = option.flatMap((value) => Some.of(value * 2));
      expect(result).toEqual(Some.of(10));
    });

    it("should not affect a None instance", () => {
      const option: Option<number> = None.Instance;
      const result = option.flatMap((value) => Some.of(value * 2));
      expect(result).toEqual(None.Instance);
    });
  });

  describe("fold", () => {
    it("should execute the ifSome function for a Some instance", () => {
      const option: Option<number> = Some.of(5);
      const result = option.fold(
        () => "No value",
        (value) => `Value is ${value}`,
      );
      expect(result).toBe("Value is 5");
    });

    it("should execute the ifNone function for a None instance", () => {
      const option: Option<number> = None.Instance;
      const result = option.fold(
        () => "No value",
        (value) => `Value is ${value}`,
      );
      expect(result).toBe("No value");
    });
  });

  describe("tap", () => {
    it("should execute the action for a Some instance", () => {
      let successMessage = "";
      const option: Option<number> = Some.of(5);
      const result = option.tap((value) => {
        successMessage = `Value is ${value}`;
      });
      expect(successMessage).toBe("Value is 5");
      expect(result).toEqual(Some.of(5));
    });

    it("should not execute the action for a None instance", () => {
      let successMessage = "";
      const option: Option<number> = None.Instance;
      const result = option.tap((value) => {
        successMessage = `Value is ${value}`;
      });
      expect(successMessage).toBe("");
      expect(result).toEqual(None.Instance);
    });
  });

  describe("tapNone", () => {
    it("should execute the action for a None instance", () => {
      let message = "";
      const option: Option<number> = None.Instance;
      const result = option.tapNone(() => {
        message = "No value";
      });
      expect(message).toBe("No value");
      expect(result).toEqual(None.Instance);
    });

    it("should not execute the action for a Some instance", () => {
      let message = "";
      const option: Option<number> = Some.of(5);
      const result = option.tapNone(() => {
        message = "No value";
      });
      expect(message).toBe("");
      expect(result).toEqual(Some.of(5));
    });
  });
});
