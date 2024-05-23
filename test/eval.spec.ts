import { describe, expect, it } from "@jest/globals";
import { Eval } from "../src";

describe("Eval", () => {
  describe("defer", () => {
    it("should defer evaluating a computation until needed", async () => {
      let evaluated = false;
      const ev = Eval.defer(() => {
        evaluated = true;
        return 42;
      });

      expect(evaluated).toBe(false);

      const result = ev.evaluate();
      expect(result).toBe(42);
      expect(evaluated).toBe(true);
    });

    it("should trigger an evaluation every time it is executed", async () => {
      let times = 0;

      const ev = Eval.defer(() => {
        times++;
        return times;
      });

      ev.evaluate();
      expect(times).toBe(1);

      ev.evaluate();
      expect(times).toBe(2);
    });
  });

  describe("now", () => {
    it("should lift an already computed value inside an Eval", async () => {
      const ev = Eval.now(42);
      expect(ev.evaluate()).toBe(42);
    });
  });

  describe("lazy", () => {
    it("should defer and cache the operation", async () => {
      let times = 0;

      const ev = Eval.lazy(() => {
        times++;
        return Math.random();
      });

      const first = ev.evaluate();
      expect(times).toBe(1);

      const second = ev.evaluate();
      expect(times).toBe(1);
      expect(first).toEqual(second);
    });
  });

  describe("evaluate", () => {
    it("it should evaluate the operations in the correct order and avoiding stack overflow from deep recursion", async () => {
      const size = 100000;
      let instance = Eval.now(0);

      for (let i = 0; i < size; i++) {
        instance = instance.flatMap((num) => Eval.now(num + 1));
      }

      const result = instance.evaluate();

      expect(result).toEqual(size);
    });
  });

  describe("map", () => {
    it("should transform the result of an operation", async () => {
      const ev = Eval.now(42);
      const result = ev.map((value) => value * 2).evaluate();
      expect(result).toBe(84);
    });
  });

  describe("flatMap", () => {
    it("should compose multiple operations", async () => {
      const ev1 = Eval.now(2);
      const ev2 = Eval.now(3);
      const result = ev1.flatMap((a) => ev2.map((b) => a + b)).evaluate();
      expect(result).toBe(5);
    });
  });
});
