import { Deprecated, Experimental } from "../src/decorators";
import { expect, it } from "@jest/globals";

describe("decorators", () => {
  describe("experimental", () => {
    it("should log the warning message and return correct result", () => {
      console.warn = jest.fn();

      class ClassUnderTest {
        @Experimental()
        methodUnderTest(num: number): number {
          return num * 2;
        }
      }

      const instance = new ClassUnderTest();
      const result = instance.methodUnderTest(2);

      expect(console.warn).toHaveBeenCalledWith(
        "methodUnderTest is marked as experimental. It is subject to change and should be used with caution."
      );
      expect(result).toEqual(4);
    });
  });

  describe("deprecated", () => {
    it("should log the deprecation warning message", () => {
      console.warn = jest.fn();

      class ClassUnderTest {
        @Deprecated("newMethod")
        methodUnderTest(num: number): number {
          return num * 2;
        }
      }

      const instance = new ClassUnderTest();
      instance.methodUnderTest(2);

      expect(console.warn).toHaveBeenCalledWith(
        "methodUnderTest is deprecated and will be removed in future versions. Use newMethod instead."
      );
    });
  });
});
