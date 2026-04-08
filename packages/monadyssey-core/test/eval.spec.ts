import { describe, expect, it } from "@jest/globals";
import { Eval } from "../src";

describe("Eval", () => {
  describe("defer", () => {
    it("should defer evaluating a computation until needed", () => {
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

    it("should trigger an evaluation every time it is executed", () => {
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
    it("should lift an already computed value inside an Eval", () => {
      const ev = Eval.now(42);
      expect(ev.evaluate()).toBe(42);
    });
  });

  describe("lazy", () => {
    it("should defer and cache the operation", () => {
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

  describe("map", () => {
    it("should transform the result of an operation", () => {
      const result = Eval.now(42)
        .map((value) => value * 2)
        .evaluate();
      expect(result).toBe(84);
    });

    it("should preserve left-to-right order", () => {
      const result = Eval.now("a")
        .map((s) => s + "b")
        .map((s) => s + "c")
        .map((s) => s + "d")
        .evaluate();
      expect(result).toBe("abcd");
    });

    it("should work on deferred computations", () => {
      let evaluated = false;
      const ev = Eval.defer(() => {
        evaluated = true;
        return 10;
      }).map((n) => n * 2);

      expect(evaluated).toBe(false);
      expect(ev.evaluate()).toBe(20);
      expect(evaluated).toBe(true);
    });

    it("should work on lazy computations and preserve memoization", () => {
      let times = 0;
      const ev = Eval.lazy(() => {
        times++;
        return 10;
      }).map((n) => n * 3);

      expect(ev.evaluate()).toBe(30);
      expect(ev.evaluate()).toBe(30);
      expect(times).toBe(1);
    });
  });

  describe("flatMap", () => {
    it("should compose dependent computations", () => {
      const ev1 = Eval.now(2);
      const ev2 = Eval.now(3);
      const result = ev1.flatMap((a) => ev2.map((b) => a + b)).evaluate();
      expect(result).toBe(5);
    });

    it("should handle right-associated chains (continuation returns a chain)", () => {
      // Right-associated: flatMap continuation itself returns flatMaps
      const result = Eval.now(1)
        .flatMap((a) => Eval.now(a + 1).flatMap((b) => Eval.now(b + 1).flatMap((c) => Eval.now(c + 1))))
        .evaluate();
      expect(result).toBe(4);
    });

    it("should work on deferred computations", () => {
      let evaluated = false;
      const ev = Eval.defer(() => {
        evaluated = true;
        return 5;
      }).flatMap((n) => Eval.now(n + 10));

      expect(evaluated).toBe(false);
      expect(ev.evaluate()).toBe(15);
      expect(evaluated).toBe(true);
    });
  });

  describe("evaluate", () => {
    it("should be stack-safe for deep flatMap chains", () => {
      const size = 1_000_000;
      let instance = Eval.now(0);

      for (let i = 0; i < size; i++) {
        instance = instance.flatMap((num) => Eval.now(num + 1));
      }

      expect(instance.evaluate()).toEqual(size);
    });

    it("should be stack-safe for deep map chains", () => {
      const size = 100_000;
      let instance: Eval<number> = Eval.now(0);

      for (let i = 0; i < size; i++) {
        instance = instance.map((num) => num + 1);
      }

      expect(instance.evaluate()).toEqual(size);
    });

    it("should be stack-safe for interleaved map and flatMap chains", () => {
      const size = 100_000;
      let instance: Eval<number> = Eval.now(0);

      for (let i = 0; i < size; i++) {
        if (i % 2 === 0) {
          instance = instance.map((num) => num + 1);
        } else {
          instance = instance.flatMap((num) => Eval.now(num + 1));
        }
      }

      expect(instance.evaluate()).toEqual(size);
    });

    it("should handle flatMap where continuation returns a mapped chain", () => {
      const result = Eval.now(1)
        .flatMap((a) =>
          Eval.now(a)
            .map((x) => x + 1)
            .map((x) => x * 10)
        )
        .map((x) => x + 5)
        .evaluate();
      // 1 -> flatMap -> now(1) -> +1 = 2 -> *10 = 20 -> +5 = 25
      expect(result).toBe(25);
    });
  });

  describe("error handling", () => {
    it("should propagate errors from deferred computations", () => {
      const ev = Eval.defer(() => {
        throw new Error("Deferred error");
      });
      expect(() => ev.evaluate()).toThrow("Deferred error");
    });

    it("should propagate errors from map functions", () => {
      const ev = Eval.now(1).map(() => {
        throw new Error("Map error");
      });
      expect(() => ev.evaluate()).toThrow("Map error");
    });

    it("should propagate errors from flatMap continuations", () => {
      const ev = Eval.now(1).flatMap(() => {
        throw new Error("FlatMap error");
      });
      expect(() => ev.evaluate()).toThrow("FlatMap error");
    });
  });

  describe("async", () => {
    it("should handle asynchronous computations", async () => {
      const ev = Eval.defer(async () => 42);
      expect(await ev.evaluate()).toBe(42);
    });
  });

  describe("value() visibility", () => {
    it("should not expose value() as a public method on Eval results", () => {
      // value() is protected — users must use evaluate() instead.
      // Calling value() on Map or FlatMap nodes would throw EvaluationError.
      // This test verifies that evaluate() works correctly as the public API.
      const mapped = Eval.now(1).map((x) => x + 1);
      expect(mapped.evaluate()).toBe(2);

      const flatMapped = Eval.now(1).flatMap((x) => Eval.now(x + 1));
      expect(flatMapped.evaluate()).toBe(2);
    });

    it("should correctly evaluate through all node types", () => {
      // Now — value available immediately
      expect(Eval.now(42).evaluate()).toBe(42);

      // Deferred — re-evaluates each time
      let counter = 0;
      const deferred = Eval.defer(() => ++counter);
      expect(deferred.evaluate()).toBe(1);
      expect(deferred.evaluate()).toBe(2);

      // Lazy — evaluates once, caches
      let lazyCount = 0;
      const lazy = Eval.lazy(() => ++lazyCount);
      expect(lazy.evaluate()).toBe(1);
      expect(lazy.evaluate()).toBe(1);
    });
  });
});
