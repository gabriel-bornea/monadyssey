import { describe, expect, it } from "@jest/globals";
import { Ordering, LT, EQ, GT } from "../src";

describe("Ordering", () => {
  describe("Static Instances", () => {
    it("should have correct values for LessThan", () => {
      expect(Ordering.LessThan.value).toBe(-1);
      expect(Ordering.LessThan.type).toBe("LessThan");
    });

    it("should have correct values for Equal", () => {
      expect(Ordering.Equal.value).toBe(0);
      expect(Ordering.Equal.type).toBe("Equal");
    });

    it("should have correct values for GreaterThan", () => {
      expect(Ordering.GreaterThan.value).toBe(1);
      expect(Ordering.GreaterThan.type).toBe("GreaterThan");
    });

    it("should export constants LT, EQ, GT correctly", () => {
      expect(LT).toBe(Ordering.LessThan);
      expect(EQ).toBe(Ordering.Equal);
      expect(GT).toBe(Ordering.GreaterThan);
    });
  });

  describe("from", () => {
    it("should return LessThan for negative numbers", () => {
      expect(Ordering.from(-10)).toBe(Ordering.LessThan);
    });

    it("should return GreaterThan for positive numbers", () => {
      expect(Ordering.from(5)).toBe(Ordering.GreaterThan);
    });

    it("should return Equal for zero", () => {
      expect(Ordering.from(0)).toBe(Ordering.Equal);
    });
  });

  describe("reverse", () => {
    it("should reverse LessThan to GreaterThan", () => {
      expect(Ordering.LessThan.reverse()).toBe(Ordering.GreaterThan);
    });

    it("should reverse GreaterThan to LessThan", () => {
      expect(Ordering.GreaterThan.reverse()).toBe(Ordering.LessThan);
    });

    it("should keep Equal unchanged when reversed", () => {
      expect(Ordering.Equal.reverse()).toBe(Ordering.Equal);
    });
  });

  describe("flatMap", () => {
    it("should return current Ordering if not Equal", () => {
      const fn = jest.fn();
      expect(Ordering.LessThan.flatMap(fn)).toBe(Ordering.LessThan);
      expect(fn).not.toHaveBeenCalled();

      expect(Ordering.GreaterThan.flatMap(fn)).toBe(Ordering.GreaterThan);
      expect(fn).not.toHaveBeenCalled();
    });

    it("should apply function if Ordering is Equal", () => {
      const nextOrdering = Ordering.GreaterThan;
      const fn = jest.fn(() => nextOrdering);

      expect(Ordering.Equal.flatMap(fn)).toBe(nextOrdering);
      expect(fn).toHaveBeenCalledTimes(1);
    });
  });

  describe("match", () => {
    it("should call onLessThan for LessThan", () => {
      const onLessThan = jest.fn(() => "less");
      const onEqual = jest.fn();
      const onGreaterThan = jest.fn();

      const result = Ordering.LessThan.match(onLessThan, onEqual, onGreaterThan);

      expect(result).toBe("less");
      expect(onLessThan).toHaveBeenCalled();
      expect(onEqual).not.toHaveBeenCalled();
      expect(onGreaterThan).not.toHaveBeenCalled();
    });

    it("should call onEqual for Equal", () => {
      const onLessThan = jest.fn();
      const onEqual = jest.fn(() => "equal");
      const onGreaterThan = jest.fn();

      const result = Ordering.Equal.match(onLessThan, onEqual, onGreaterThan);

      expect(result).toBe("equal");
      expect(onEqual).toHaveBeenCalled();
      expect(onLessThan).not.toHaveBeenCalled();
      expect(onGreaterThan).not.toHaveBeenCalled();
    });

    it("should call onGreaterThan for GreaterThan", () => {
      const onLessThan = jest.fn();
      const onEqual = jest.fn();
      const onGreaterThan = jest.fn(() => "greater");

      const result = Ordering.GreaterThan.match(onLessThan, onEqual, onGreaterThan);

      expect(result).toBe("greater");
      expect(onGreaterThan).toHaveBeenCalled();
      expect(onLessThan).not.toHaveBeenCalled();
      expect(onEqual).not.toHaveBeenCalled();
    });
  });

  describe("tap", () => {
    it("should perform side effect and return the same Ordering", () => {
      const fn = jest.fn();
      const ordering = Ordering.LessThan;

      const result = ordering.tap(fn);

      expect(fn).toHaveBeenCalledWith(ordering);
      expect(result).toBe(ordering);
    });
  });

  describe("concat", () => {
    it("should return current Ordering if it is not Equal", () => {
      const other = Ordering.GreaterThan;
      expect(Ordering.LessThan.concat(other)).toBe(Ordering.LessThan);
    });

    it("should return other Ordering if current is Equal", () => {
      const other = Ordering.GreaterThan;
      expect(Ordering.Equal.concat(other)).toBe(other);
    });
  });

  describe("comparing", () => {
    it("should create a comparator function that returns Ordering", () => {
      const comparator = Ordering.comparing(
        (x: number) => x,
        (a, b) => a - b
      );

      const result1 = comparator(1, 2);
      expect(result1).toBe(Ordering.LessThan);

      const result2 = comparator(2, 1);
      expect(result2).toBe(Ordering.GreaterThan);

      const result3 = comparator(1, 1);
      expect(result3).toBe(Ordering.Equal);
    });
  });

  describe("compareBy", () => {
    interface User {
      age: number;
      name: string;
    }

    const userA: User = { age: 30, name: "Alice" };
    const userB: User = { age: 25, name: "Bob" };
    const userC: User = { age: 30, name: "Charlie" };

    const compareByAge = Ordering.comparing<User, number>(
      (u) => u.age,
      (a, b) => a - b
    );

    const compareByName = Ordering.comparing<User, string>(
      (u) => u.name,
      (a, b) => a.localeCompare(b)
    );

    const userComparator = Ordering.compareBy(compareByAge, compareByName);

    it("should compare users by age first", () => {
      const result = userComparator(userA, userB);
      expect(result).toBe(Ordering.GreaterThan);
    });

    it("should compare users by name if ages are equal", () => {
      const result = userComparator(userA, userC);
      expect(result).toBe(Ordering.LessThan);
    });

    it("should return Equal if both age and name are equal", () => {
      const userD: User = { age: 30, name: "Alice" };
      const result = userComparator(userA, userD);
      expect(result).toBe(Ordering.Equal);
    });
  });

  describe("reverse in comparator", () => {
    it("should reverse the result of a comparator", () => {
      const comparator = Ordering.comparing(
        (x: number) => x,
        (a, b) => a - b
      );

      const reversedComparator = (a: number, b: number) => comparator(a, b).reverse();

      expect(reversedComparator(1, 2)).toBe(Ordering.GreaterThan);
      expect(reversedComparator(2, 1)).toBe(Ordering.LessThan);
      expect(reversedComparator(1, 1)).toBe(Ordering.Equal);
    });
  });
});
