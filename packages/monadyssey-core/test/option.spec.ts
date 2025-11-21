import { describe, expect, it } from "@jest/globals";
import { None, Option, Some } from "../src";

describe("Option", () => {
  describe("ofNullable", () => {
    it("should be None for null", () => {
      const option: Option<string> = Option.ofNullable<string>(null);

      expect(option).toBe(None.Instance);
    });

    it("should be None for undefined", () => {
      const option = Option.ofNullable<undefined>(undefined);

      expect(option).toBe(None.Instance);
    });

    it("should be Some for actual value", () => {
      const value: string = "I'm here.";
      const option: Option<string> = Option.ofNullable(value);

      expect(option).toEqual(Some.of("I'm here."));
    });
  });

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

    it("should handle exception thrown by callback", () => {
      const option: Option<number> = Some.of(5);
      expect(() => {
        option.map((_value) => {
          throw new Error("Error in callback");
        });
      }).toThrow("Error in callback");
    });

    it("should handle null returned by callback", () => {
      const option: Option<number> = Some.of(5);
      const mapped = option.map((_) => null);
      expect(mapped.type).toEqual("None");
    });

    it("should handle undefined returned by callback", () => {
      const option: Option<number> = Some.of(5);
      const mapped = option.map((_) => undefined);
      expect(mapped.type).toEqual("None");
    });

    it("should handle '0' inside the Some instance", () => {
      const option: Option<number> = Some.of(0);
      const mapped = option.map((value) => value * 2);
      expect(mapped).toEqual(Some.of(0));
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

  describe("filter", () => {
    it("should filter out values that do not satisfy the predicate", () => {
      const option = Option.ofNullable(5);
      const filtered = option.filter((value) => value > 3);
      expect(filtered).toEqual(Some.of(5));
    });

    it("should return None for values that do not satisfy the predicate", () => {
      const option = Option.ofNullable(3);
      const filtered = option.filter((value) => value > 3);
      expect(filtered).toEqual(None.Instance);
    });
  });

  describe("fold", () => {
    it("should execute the ifSome function for a Some instance", () => {
      const option: Option<number> = Some.of(5);
      const result = option.fold(
        () => "No value",
        (value) => `Value is ${value}`
      );
      expect(result).toBe("Value is 5");
    });

    it("should execute the ifNone function for a None instance", () => {
      const option: Option<number> = None.Instance;
      const result = option.fold(
        () => "No value",
        (value) => `Value is ${value}`
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

  describe("getOrNull", () => {
    it("should return the value for a Some instance", () => {
      const option: Option<number> = Some.of(5);
      const result = option.getOrNull();
      expect(result).toBe(5);
    });

    it("should return null for a None instance", () => {
      const option: Option<number> = None.Instance;
      const result = option.getOrNull();
      expect(result).toBeNull();
    });
  });

  describe("getOrElse", () => {
    it("should return the value for a Some instance", () => {
      const option: Option<number> = Some.of(5);
      const result = option.getOrElse(() => 0);
      expect(result).toBe(5);
    });

    it("should return the default value for a None instance", () => {
      const option: Option<number> = None.Instance;
      const result = option.getOrElse(() => 0);
      expect(result).toBe(0);
    });
  });
});
