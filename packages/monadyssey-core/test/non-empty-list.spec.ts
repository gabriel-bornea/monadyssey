import { NonEmptyList, Option } from "../src";
import { describe, expect, it } from "@jest/globals";
import { Ordering } from "../src";

describe("NonEmptyList", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it("should create a non-empty list from an array", () => {
    const array = [1, 2, 3];
    const nel = NonEmptyList.fromArray(array);

    expect(nel.toArray()).toEqual(array);
  });

  it("should throw an error when creating from an empty array", () => {
    const func = () => NonEmptyList.fromArray([]);
    expect(func).toThrow("Cannot construct a NonEmptyList from a null or empty array.");
  });

  it("should correctly return the size of the list", () => {
    const array = [1, 2, 3, 4, 5];
    const nel = NonEmptyList.fromArray(array);

    expect(nel.size).toBe(array.length);
  });

  it("should correctly transform to a string", () => {
    const array = [1, 2, 3];
    const nel = NonEmptyList.fromArray(array);

    expect(nel.toString()).toBe("[1, 2, 3]");
  });

  describe("pure", () => {
    it("creates a single-element list", () => {
      const nel = NonEmptyList.pure(42);
      expect(nel.head).toBe(42);
      expect(nel.tail).toEqual([]);
      expect(nel.size).toBe(1);
    });

    it("works with falsy values", () => {
      expect(NonEmptyList.pure(0).head).toBe(0);
      expect(NonEmptyList.pure("").head).toBe("");
      expect(NonEmptyList.pure(false).head).toBe(false);
      expect(NonEmptyList.pure(null).head).toBeNull();
    });

    it("toArray returns a single-element array", () => {
      expect(NonEmptyList.pure("hello").toArray()).toEqual(["hello"]);
    });
  });

  describe("toArray", () => {
    it("returns all elements as an array", () => {
      const nel = NonEmptyList.fromArray([1, 2, 3]);
      expect(nel.toArray()).toEqual([1, 2, 3]);
    });

    it("returns a single-element array for a singleton", () => {
      expect(NonEmptyList.pure(42).toArray()).toEqual([42]);
    });

    it("returns a new array each time", () => {
      const nel = NonEmptyList.fromArray([1, 2]);
      const a = nel.toArray();
      const b = nel.toArray();
      expect(a).toEqual(b);
      expect(a).not.toBe(b);
    });
  });

  describe("all (deprecated)", () => {
    it("returns all elements as an array", () => {
      const nel = NonEmptyList.fromArray([1, 2, 3]);
      expect(nel.all).toEqual([1, 2, 3]);
    });
  });

  describe("init", () => {
    it("returns all elements except the last", () => {
      const nel = NonEmptyList.fromArray([1, 2, 3]);
      expect(nel.init).toEqual([1, 2]);
    });

    it("returns empty array for a single-element list", () => {
      expect(NonEmptyList.pure(42).init).toEqual([]);
    });

    it("returns [head] for a two-element list", () => {
      const nel = NonEmptyList.fromArray([10, 20]);
      expect(nel.init).toEqual([10]);
    });

    it("does not mutate the original list", () => {
      const nel = NonEmptyList.fromArray([1, 2, 3]);
      const _ = nel.init;
      expect(_).toEqual([1, 2]);
      expect(nel.toArray()).toEqual([1, 2, 3]);
    });
  });

  describe("get", () => {
    it("returns the head at index 0", () => {
      const nel = NonEmptyList.fromArray([10, 20, 30]);
      expect(nel.get(0)).toBe(10);
    });

    it("returns tail elements at indices > 0", () => {
      const nel = NonEmptyList.fromArray([10, 20, 30]);
      expect(nel.get(1)).toBe(20);
      expect(nel.get(2)).toBe(30);
    });

    it("works with falsy values at index 0", () => {
      const nel = NonEmptyList.fromArray([0, 1, 2]);
      expect(nel.get(0)).toBe(0);
    });

    it("works with falsy values in the tail", () => {
      const nel = NonEmptyList.fromArray([1, 0, false as unknown as number]);
      expect(nel.get(1)).toBe(0);
    });

    it("throws on negative index", () => {
      const nel = NonEmptyList.fromArray([1, 2, 3]);
      expect(() => nel.get(-1)).toThrow("Index -1 is out of bounds. Must be between 0 and 2");
    });

    it("throws on index >= size", () => {
      const nel = NonEmptyList.fromArray([1, 2, 3]);
      expect(() => nel.get(3)).toThrow("Index 3 is out of bounds. Must be between 0 and 2");
      expect(() => nel.get(5)).toThrow("Index 5 is out of bounds. Must be between 0 and 2");
    });

    it("does not allocate an intermediate array", () => {
      const nel = new NonEmptyList(10, [20, 30]);
      // Accessing .get should not call toArray
      const spy = jest.spyOn(nel, "toArray");
      nel.get(0);
      nel.get(1);
      nel.get(2);
      expect(spy).not.toHaveBeenCalled();
    });
  });

  describe("foldLeft", () => {
    it("should fold the list from the left with the provided function", () => {
      const nel = NonEmptyList.fromArray([1, 2, 3, 4, 5]);

      const start = 0;
      const foldingFunction = (acc: number, value: number) => acc + value;
      const expected = 15; // 1 + 2 + 3 + 4 + 5

      const result = nel.foldLeft(start, foldingFunction);
      expect(result).toBe(expected);
    });

    it("should return the result of start value and head when list has one element", () => {
      const emptyNel = NonEmptyList.fromArray([1]);
      const start = 100;
      const foldingFunction = (acc: number, value: number) => acc - value;
      const expected = 99;

      const result = emptyNel.foldLeft(start, foldingFunction);
      expect(result).toBe(expected);
    });
  });

  describe("foldRight", () => {
    test("should correctly fold a non-empty list from the right with the given binary function", (): void => {
      const nel = NonEmptyList.fromArray([1, 2, 3, 4]);
      const add = (a: number, b: number): number => a + b;

      const result = nel.foldRight(0, add);

      expect(result).toBe(10);
    });

    test("should correctly fold a single-item non-empty list from the right", (): void => {
      const nel = NonEmptyList.fromArray([1]);
      const add = (a: number, b: number): number => a + b;

      const result = nel.foldRight(0, add);

      expect(result).toBe(1);
    });

    test("should use the provided start value correctly", (): void => {
      const nel = NonEmptyList.fromArray([1, 2, 3]);
      const add = (a: number, b: number): number => a + b;

      const result = nel.foldRight(10, add);

      expect(result).toBe(16);
    });

    test("should handle non-number types correctly", (): void => {
      const nel = NonEmptyList.fromArray(["a", "b", "c"]);
      const concat = (a: string, b: string): string => a + b;

      const result = nel.foldRight("", concat);

      expect(result).toBe("abc");
    });

    test("should not mutate the original non-empty list", (): void => {
      const nel = NonEmptyList.fromArray([1, 2, 3]);
      const prevAll = nel.toArray();

      nel.foldRight(0, (a, b) => a + b);

      expect(nel.toArray()).toEqual(prevAll);
    });
  });

  describe("reduce", () => {
    it("sums all elements", () => {
      const nel = NonEmptyList.fromArray([1, 2, 3, 4, 5]);
      expect(nel.reduce((a, b) => a + b)).toBe(15);
    });

    it("returns the single element for a singleton list", () => {
      expect(NonEmptyList.pure(42).reduce((a, b) => a + b)).toBe(42);
    });

    it("concatenates strings", () => {
      const nel = NonEmptyList.fromArray(["a", "b", "c"]);
      expect(nel.reduce((a, b) => a + b)).toBe("abc");
    });

    it("finds the minimum", () => {
      const nel = NonEmptyList.fromArray([3, 1, 4, 1, 5]);
      expect(nel.reduce((a, b) => (a < b ? a : b))).toBe(1);
    });

    it("finds the maximum", () => {
      const nel = NonEmptyList.fromArray([3, 1, 4, 1, 5]);
      expect(nel.reduce((a, b) => (a > b ? a : b))).toBe(5);
    });

    it("applies left-to-right for non-commutative operations", () => {
      const nel = NonEmptyList.fromArray([10, 3, 2]);
      const subtract = (a: number, b: number) => a - b;

      // (10 - 3) - 2 = 5
      expect(nel.reduce(subtract)).toBe(5);
    });

    it("works with falsy head value", () => {
      const nel = NonEmptyList.fromArray([0, 1, 2]);
      expect(nel.reduce((a, b) => a + b)).toBe(3);
    });
  });

  describe("exists", () => {
    it("returns true when head matches", () => {
      const nel = NonEmptyList.fromArray([2, 3, 4]);
      expect(nel.exists((n) => n === 2)).toBe(true);
    });

    it("returns true when a tail element matches", () => {
      const nel = NonEmptyList.fromArray([1, 3, 4]);
      expect(nel.exists((n) => n % 2 === 0)).toBe(true);
    });

    it("returns false when no element matches", () => {
      const nel = NonEmptyList.fromArray([1, 3, 5]);
      expect(nel.exists((n) => n > 10)).toBe(false);
    });

    it("short-circuits on head match", () => {
      const nel = NonEmptyList.fromArray([1, 2, 3]);
      let callCount = 0;
      nel.exists((n) => {
        callCount++;
        return n === 1;
      });
      expect(callCount).toBe(1);
    });

    it("works with falsy head value", () => {
      const nel = NonEmptyList.fromArray([0, 1, 2]);
      expect(nel.exists((n) => n === 0)).toBe(true);
    });

    it("works on a singleton list", () => {
      expect(NonEmptyList.pure(42).exists((n) => n === 42)).toBe(true);
      expect(NonEmptyList.pure(42).exists((n) => n === 0)).toBe(false);
    });
  });

  describe("forall", () => {
    it("returns true when all elements match", () => {
      const nel = NonEmptyList.fromArray([2, 4, 6]);
      expect(nel.forall((n) => n % 2 === 0)).toBe(true);
    });

    it("returns false when head does not match", () => {
      const nel = NonEmptyList.fromArray([1, 4, 6]);
      expect(nel.forall((n) => n % 2 === 0)).toBe(false);
    });

    it("returns false when a tail element does not match", () => {
      const nel = NonEmptyList.fromArray([2, 3, 6]);
      expect(nel.forall((n) => n % 2 === 0)).toBe(false);
    });

    it("short-circuits on head mismatch", () => {
      const nel = NonEmptyList.fromArray([1, 2, 3]);
      let callCount = 0;
      nel.forall((n) => {
        callCount++;
        return n > 5;
      });
      expect(callCount).toBe(1);
    });

    it("works on a singleton list", () => {
      expect(NonEmptyList.pure(42).forall((n) => n > 0)).toBe(true);
      expect(NonEmptyList.pure(42).forall((n) => n < 0)).toBe(false);
    });

    it("works with falsy values", () => {
      const nel = NonEmptyList.fromArray([0, 0, 0]);
      expect(nel.forall((n) => n === 0)).toBe(true);
    });
  });

  describe("map", () => {
    it("should return a new NonEmptyList with each value multiplied by 2", () => {
      const nel = NonEmptyList.fromArray([1, 2, 3]);
      const result = nel.map((num) => num * 2);
      expect(result.toArray()).toEqual([2, 4, 6]);
    });

    it("should throw an error if the NonEmptyList is empty", () => {
      expect(() => {
        const nel = NonEmptyList.fromArray([]);
        nel.map((num) => num * 2);
      }).toThrow("Cannot construct a NonEmptyList from a null or empty array.");
    });

    it("should not mutate the original NonEmptyList", () => {
      const nel = NonEmptyList.fromArray([1, 2, 3]);
      nel.map((num) => num * 2);
      expect(nel.toArray()).toEqual([1, 2, 3]);
    });

    it("works with a singleton list", () => {
      const result = NonEmptyList.pure(5).map((n) => n * 3);
      expect(result.toArray()).toEqual([15]);
    });

    it("preserves the correct head and tail structure", () => {
      const result = NonEmptyList.fromArray([1, 2, 3]).map((n) => n + 10);
      expect(result.head).toBe(11);
      expect(result.tail).toEqual([12, 13]);
    });
  });

  describe("flatMap", () => {
    it("should return a new NonEmptyList by applying a function to each element and concatenating the results", () => {
      const nel = NonEmptyList.fromArray([1, 2, 3, 4]);
      const f = (value: number) => NonEmptyList.fromArray([value, value * 10]);
      const flatMappedNel = nel.flatMap(f);
      expect(flatMappedNel.toArray()).toEqual([1, 10, 2, 20, 3, 30, 4, 40]);
    });

    it("should have the new NonEmptyList size corresponds to the mapped elements count", () => {
      const nel = NonEmptyList.fromArray(["a", "b", "c"]);
      const f = (value: string) => NonEmptyList.fromArray([value, value + value]);
      const flatMappedNel = nel.flatMap(f);
      expect(flatMappedNel.size).toEqual(6);
    });

    it("works with a singleton list", () => {
      const result = NonEmptyList.pure(5).flatMap((n) => new NonEmptyList(n, [n * 2]));
      expect(result.toArray()).toEqual([5, 10]);
    });

    it("preserves the correct head and tail structure", () => {
      const result = NonEmptyList.fromArray([1, 2]).flatMap((n) => NonEmptyList.pure(n * 10));
      expect(result.head).toBe(10);
      expect(result.tail).toEqual([20]);
    });
  });

  describe("traverse", () => {
    it("should traverse over the NonEmptyList and apply async function to each element", async () => {
      const sideEffectingOperation = async (value: number) => value + 1;

      const nel = NonEmptyList.fromArray([1, 2, 3]);

      const result = await nel.traverse(sideEffectingOperation);
      expect(result.toArray()).toEqual([2, 3, 4]);
    });

    it("should throw an error if async function throws an error", async () => {
      const nel = NonEmptyList.fromArray([1, 2, 3]);
      const func = async () => {
        throw new Error("This is an expected error");
      };

      await expect(nel.traverse(func)).rejects.toThrow("This is an expected error");
    });

    it("works with a singleton list", async () => {
      const result = await NonEmptyList.pure(5).traverse(async (n) => n * 2);
      expect(result.toArray()).toEqual([10]);
    });

    it("preserves head/tail structure", async () => {
      const result = await NonEmptyList.fromArray([1, 2, 3]).traverse(async (n) => n + 10);
      expect(result.head).toBe(11);
      expect(result.tail).toEqual([12, 13]);
    });
  });

  describe("filter", () => {
    it("returns an array of matching elements", () => {
      const nel = NonEmptyList.fromArray([1, 2, 3, 4]);
      const filtered = nel.filter((value) => value > 3);
      expect(filtered).toEqual([4]);
    });

    it("returns an empty array when no elements match", () => {
      const nel = NonEmptyList.fromArray([1, 2, 3, 4]);
      const filtered = nel.filter((value) => value > 4);
      expect(filtered).toEqual([]);
    });

    it("returns all elements when all match", () => {
      const nel = NonEmptyList.fromArray([2, 4, 6]);
      expect(nel.filter((n) => n % 2 === 0)).toEqual([2, 4, 6]);
    });

    it("handles falsy values correctly", () => {
      const nel = NonEmptyList.fromArray([0, 1, 2, 0, 3]);
      expect(nel.filter((n) => n === 0)).toEqual([0, 0]);
    });

    it("always returns a plain array", () => {
      const nel = NonEmptyList.fromArray([1, 2, 3]);
      const result = nel.filter(() => true);
      expect(Array.isArray(result)).toBe(true);
      expect(result).not.toBeInstanceOf(NonEmptyList);
    });
  });

  describe("sort", () => {
    it("should sort numbers in ascending order", () => {
      const nel = NonEmptyList.fromArray([3, 1, 4, 1, 5]);
      const sortedNel = nel.sort(
        Ordering.comparing(
          (x) => x,
          (a, b) => a - b
        )
      );
      expect(sortedNel.toArray()).toEqual([1, 1, 3, 4, 5]);
    });

    it("should sort numbers in descending order", () => {
      const nel = NonEmptyList.fromArray([3, 1, 4, 1, 5]);
      const sortedNel = nel.sort(
        Ordering.comparing(
          (x) => x,
          (a, b) => b - a
        )
      );
      expect(sortedNel.toArray()).toEqual([5, 4, 3, 1, 1]);
    });

    it("should sort strings alphabetically", () => {
      const nel = NonEmptyList.fromArray(["banana", "apple", "cherry"]);
      const sortedNel = nel.sort(
        Ordering.comparing(
          (x) => x,
          (a, b) => a.localeCompare(b)
        )
      );
      expect(sortedNel.toArray()).toEqual(["apple", "banana", "cherry"]);
    });

    it("should sort complex objects based on a key", () => {
      interface User {
        id: number;
        name: string;
      }
      const users = NonEmptyList.fromArray<User>([
        { id: 3, name: "Charlie" },
        { id: 1, name: "Alice" },
        { id: 2, name: "Bob" },
      ]);
      const sortedUsers = users.sort(
        Ordering.comparing(
          (u) => u.id,
          (a, b) => a - b
        )
      );
      expect(sortedUsers.toArray()).toEqual([
        { id: 1, name: "Alice" },
        { id: 2, name: "Bob" },
        { id: 3, name: "Charlie" },
      ]);
    });

    it("should maintain the original list unmodified", () => {
      const nel = NonEmptyList.fromArray([3, 1, 4, 1, 5]);
      const sortedNel = nel.sort(
        Ordering.comparing(
          (x) => x,
          (a, b) => a - b
        )
      );
      expect(nel.toArray()).toEqual([3, 1, 4, 1, 5]);
      expect(sortedNel.toArray()).toEqual([1, 1, 3, 4, 5]);
    });

    it("should sort using a custom comparator with multiple criteria", () => {
      interface Person {
        age: number;
        name: string;
      }
      const people = NonEmptyList.fromArray<Person>([
        { age: 30, name: "Charlie" },
        { age: 25, name: "Alice" },
        { age: 30, name: "Bob" },
      ]);
      const compareByAgeThenName = Ordering.compareBy<Person>(
        Ordering.comparing(
          (p) => p.age,
          (a, b) => a - b
        ),
        Ordering.comparing(
          (p) => p.name,
          (a, b) => a.localeCompare(b)
        )
      );
      const sortedPeople = people.sort(compareByAgeThenName);
      expect(sortedPeople.toArray()).toEqual([
        { age: 25, name: "Alice" },
        { age: 30, name: "Bob" },
        { age: 30, name: "Charlie" },
      ]);
    });

    it("should handle sorting when all elements are equal", () => {
      const nel = NonEmptyList.fromArray([1, 1, 1]);
      const sortedNel = nel.sort(
        Ordering.comparing(
          (x) => x,
          (a, b) => a - b
        )
      );
      expect(sortedNel.toArray()).toEqual([1, 1, 1]);
    });

    it("should handle sorting when the list has a single element", () => {
      const nel = NonEmptyList.fromArray([42]);
      const sortedNel = nel.sort(
        Ordering.comparing(
          (x) => x,
          (a, b) => a - b
        )
      );
      expect(sortedNel.toArray()).toEqual([42]);
    });

    it("should sort using reverse ordering", () => {
      const nel = NonEmptyList.fromArray([1, 2, 3, 4, 5]);
      const descendingOrder = Ordering.comparing(
        (x: number) => x,
        (a, b) => b - a
      );
      const sortedNel = nel.sort(descendingOrder);
      expect(sortedNel.toArray()).toEqual([5, 4, 3, 2, 1]);
    });

    it("should sort complex objects with null or undefined values", () => {
      interface Item {
        value?: number;
      }
      const items = NonEmptyList.fromArray<Item>([
        { value: 10 },
        {},
        { value: 5 },
        { value: undefined },
        { value: 20 },
      ]);
      const compareByValue = Ordering.comparing(
        (item: Item) => item.value ?? 0,
        (a, b) => a - b
      );
      const sortedItems = items.sort(compareByValue);
      expect(sortedItems.toArray()).toEqual([{}, { value: undefined }, { value: 5 }, { value: 10 }, { value: 20 }]);
    });

    it("should sort using a comparator that returns Equal for all elements", () => {
      const nel = NonEmptyList.fromArray([3, 1, 4, 1, 5]);
      const alwaysEqualComparator = (_a: number, _b: number) => Ordering.Equal;
      const sortedNel = nel.sort(alwaysEqualComparator);
      expect(sortedNel.toArray()).toEqual([3, 1, 4, 1, 5]);
    });
  });

  describe("last", () => {
    it("returns the last element when tail exists", () => {
      const nel = NonEmptyList.fromArray([1, 2, 3]);
      expect(nel.last).toBe(3);
    });

    it("returns the head when there is only one element", () => {
      const nel = NonEmptyList.fromArray([42]);
      expect(nel.last).toBe(42);
    });
  });

  describe("append", () => {
    it("appends element to the end and returns a new list", () => {
      const nel = NonEmptyList.fromArray([1, 2]);
      const appended = nel.append(3);

      expect(appended.toArray()).toEqual([1, 2, 3]);
      expect(nel.toArray()).toEqual([1, 2]); // immutability
    });

    it("works with a single-element list", () => {
      const nel = NonEmptyList.fromArray([1]);
      const appended = nel.append(2);

      expect(appended.toArray()).toEqual([1, 2]);
    });
  });

  describe("prepend", () => {
    it("prepends element to the beginning and returns a new list", () => {
      const nel = NonEmptyList.fromArray([2, 3]);
      const prepended = nel.prepend(1);

      expect(prepended.toArray()).toEqual([1, 2, 3]);
      expect(nel.toArray()).toEqual([2, 3]); // immutability
    });

    it("works with a single-element list", () => {
      const nel = NonEmptyList.fromArray([2]);
      const prepended = nel.prepend(1);

      expect(prepended.toArray()).toEqual([1, 2]);
    });
  });

  describe("concat", () => {
    it("concatenates two non-empty lists preserving order", () => {
      const a = NonEmptyList.fromArray([1, 2]);
      const b = NonEmptyList.fromArray([3, 4]);
      const both = a.concat(b);

      expect(both.toArray()).toEqual([1, 2, 3, 4]);
      expect(a.toArray()).toEqual([1, 2]); // immutability
      expect(b.toArray()).toEqual([3, 4]); // immutability
    });

    it("handles concatenation when either side has a single element", () => {
      const a = NonEmptyList.fromArray([1]);
      const b = NonEmptyList.fromArray([2, 3]);
      const c = a.concat(b);
      const d = b.concat(a);

      expect(c.toArray()).toEqual([1, 2, 3]);
      expect(d.toArray()).toEqual([2, 3, 1]);
    });
  });

  describe("reverse", () => {
    it("reverses a list with multiple elements", () => {
      const nel = NonEmptyList.fromArray([1, 2, 3]);
      const reversed = nel.reverse();

      expect(reversed.toArray()).toEqual([3, 2, 1]);
      expect(nel.toArray()).toEqual([1, 2, 3]); // immutability
    });

    it("keeps a single-element list unchanged", () => {
      const nel = NonEmptyList.fromArray([1]);
      const reversed = nel.reverse();

      expect(reversed.toArray()).toEqual([1]);
    });
  });

  describe("find", () => {
    it("returns Some(head) when head matches", () => {
      const nel = NonEmptyList.fromArray([2, 3, 4]);
      const result = nel.find((x) => x % 2 === 0);

      expect(result.type).toBe("Some");
      expect((result as any).value).toBe(2);
    });

    it("returns Some(firstMatchInTail) when match is in tail", () => {
      const nel = NonEmptyList.fromArray([1, 3, 4, 6]);
      const result = nel.find((x) => x % 2 === 0);

      expect(result.type).toBe("Some");
      expect((result as any).value).toBe(4);
    });

    it("returns None when no element matches", () => {
      const nel = NonEmptyList.fromArray([1, 3, 5]);
      const result: Option<number> = nel.find((x) => x % 2 === 0);

      expect(result.type).toBe("None");
      expect(result.getOrNull()).toBeNull();
    });

    it("finds head when head is 0 (falsy)", () => {
      const nel = NonEmptyList.fromArray([0, 1, 2]);
      const result = nel.find((x) => x === 0);

      expect(result.type).toBe("Some");
      expect(result.getOrElse(() => -1)).toBe(0);
    });

    it("finds head when head is empty string (falsy)", () => {
      const nel = NonEmptyList.fromArray(["", "a", "b"]);
      const result = nel.find((x) => x === "");

      expect(result.type).toBe("Some");
      expect(result.getOrElse(() => "fallback")).toBe("");
    });

    it("finds head when head is false (falsy)", () => {
      const nel = NonEmptyList.fromArray([false, true, true]);
      const result = nel.find((x) => x === false);

      expect(result.type).toBe("Some");
      expect(result.getOrElse(() => true)).toBe(false);
    });

    it("finds 0 in the tail", () => {
      const nel = NonEmptyList.fromArray([1, 0, 2]);
      const result = nel.find((x) => x === 0);

      expect(result.type).toBe("Some");
      expect(result.getOrElse(() => -1)).toBe(0);
    });

    it("finds empty string in the tail", () => {
      const nel = NonEmptyList.fromArray(["a", "", "b"]);
      const result = nel.find((x) => x === "");

      expect(result.type).toBe("Some");
      expect(result.getOrElse(() => "fallback")).toBe("");
    });
  });
});
