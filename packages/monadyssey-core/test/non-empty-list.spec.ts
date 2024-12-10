import { NonEmptyList } from "../src";
import { describe, expect, it } from "@jest/globals";
import { Ordering } from "../src";

describe("NonEmptyList", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it("should create a non-empty list from an array", () => {
    const array = [1, 2, 3];
    const nel = NonEmptyList.fromArray(array);

    expect(nel.all).toEqual(array);
  });

  it("should throw an error when creating from an empty array", () => {
    const func = () => NonEmptyList.fromArray([]);
    expect(func).toThrowError("Cannot construct a NonEmptyList from a null or empty array.");
  });

  it("should correctly return the size of the list", () => {
    const array = [1, 2, 3, 4, 5];
    const nel = NonEmptyList.fromArray(array);

    expect(nel.size).toBe(array.length);
  });

  it("should get the correct element at the specified index", () => {
    const array = [1, 2, 3];
    const nel = NonEmptyList.fromArray(array);

    expect(nel.get(2)).toBe(3);
  });

  it("should throw an error when trying to get an element at an invalid index", () => {
    const array = [1, 2, 3];
    const nel = NonEmptyList.fromArray(array);

    const func = () => nel.get(5);
    expect(func).toThrowError("Index 5 is out of bounds. Must be between 0 and 2");
  });

  it("should correctly transform to a string", () => {
    const array = [1, 2, 3];
    const nel = NonEmptyList.fromArray(array);

    expect(nel.toString()).toBe("[1, 2, 3]");
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
      const prevAll = nel.all;

      nel.foldRight(0, (a, b) => a + b);

      expect(nel.all).toEqual(prevAll);
    });
  });

  describe("map", () => {
    it("should return a new NonEmptyList with each value multiplied by 2", () => {
      const nel = NonEmptyList.fromArray([1, 2, 3]);
      const result = nel.map((num) => num * 2);
      expect(result.all).toEqual([2, 4, 6]);
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
      expect(nel.all).toEqual([1, 2, 3]);
    });
  });

  describe("flatMap", () => {
    it("should return a new NonEmptyList by applying a function to each element and concatenating the results", () => {
      const nel = NonEmptyList.fromArray([1, 2, 3, 4]);
      const f = (value: number) => NonEmptyList.fromArray([value, value * 10]);
      const flatMappedNel = nel.flatMap(f);
      expect(flatMappedNel.all).toEqual([1, 10, 2, 20, 3, 30, 4, 40]);
    });

    it("should have the new NonEmptyList size corresponds to the mapped elements count", () => {
      const nel = NonEmptyList.fromArray(["a", "b", "c"]);
      const f = (value: string) => NonEmptyList.fromArray([value, value + value]);
      const flatMappedNel = nel.flatMap(f);
      expect(flatMappedNel.size).toEqual(6);
    });
  });

  describe("traverse", () => {
    it("should traverse over the NonEmptyList and apply async function to each element", async () => {
      const sideEffectingOperation = async (value: number) => value + 1;

      const nel = NonEmptyList.fromArray([1, 2, 3]);

      const result = await nel.traverse(sideEffectingOperation);
      expect(result.all).toEqual([2, 3, 4]);
    });

    it("should throw an error if async function throws an error", async () => {
      const nel = NonEmptyList.fromArray([1, 2, 3]);
      const func = async () => {
        throw new Error("This is an expected error");
      };

      await expect(nel.traverse(func)).rejects.toThrow("This is an expected error");
    });
  });

  describe("filter", () => {
    it("should filter a NonEmptyList", async () => {
      const nel = NonEmptyList.fromArray([1, 2, 3, 4]);
      const filtered = nel.filter((value) => value > 3);

      expect(filtered instanceof NonEmptyList).toEqual(true);
      expect((filtered as NonEmptyList<number>).all).toEqual([4]);
    });

    it("should return an empty array when filtering a NonEmptyList return empty", async () => {
      const nel = NonEmptyList.fromArray([1, 2, 3, 4]);
      const filtered = nel.filter((value) => value > 4);

      expect(filtered instanceof Array).toEqual(true);
      expect(filtered as Array<number>).toEqual([]);
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
      expect(sortedNel.all).toEqual([1, 1, 3, 4, 5]);
    });

    it("should sort numbers in descending order", () => {
      const nel = NonEmptyList.fromArray([3, 1, 4, 1, 5]);
      const sortedNel = nel.sort(
        Ordering.comparing(
          (x) => x,
          (a, b) => b - a
        )
      );
      expect(sortedNel.all).toEqual([5, 4, 3, 1, 1]);
    });

    it("should sort strings alphabetically", () => {
      const nel = NonEmptyList.fromArray(["banana", "apple", "cherry"]);
      const sortedNel = nel.sort(
        Ordering.comparing(
          (x) => x,
          (a, b) => a.localeCompare(b)
        )
      );
      expect(sortedNel.all).toEqual(["apple", "banana", "cherry"]);
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
      expect(sortedUsers.all).toEqual([
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
      expect(nel.all).toEqual([3, 1, 4, 1, 5]);
      expect(sortedNel.all).toEqual([1, 1, 3, 4, 5]);
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
      expect(sortedPeople.all).toEqual([
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
      expect(sortedNel.all).toEqual([1, 1, 1]);
    });

    it("should handle sorting when the list has a single element", () => {
      const nel = NonEmptyList.fromArray([42]);
      const sortedNel = nel.sort(
        Ordering.comparing(
          (x) => x,
          (a, b) => a - b
        )
      );
      expect(sortedNel.all).toEqual([42]);
    });

    it("should sort using reverse ordering", () => {
      const nel = NonEmptyList.fromArray([1, 2, 3, 4, 5]);
      const descendingOrder = Ordering.comparing(
        (x: number) => x,
        (a, b) => b - a
      );
      const sortedNel = nel.sort(descendingOrder);
      expect(sortedNel.all).toEqual([5, 4, 3, 2, 1]);
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
      expect(sortedItems.all).toEqual([{}, { value: undefined }, { value: 5 }, { value: 10 }, { value: 20 }]);
    });

    it("should sort using a comparator that returns Equal for all elements", () => {
      const nel = NonEmptyList.fromArray([3, 1, 4, 1, 5]);
      const alwaysEqualComparator = (_a: number, _b: number) => Ordering.Equal;
      const sortedNel = nel.sort(alwaysEqualComparator);
      expect(sortedNel.all).toEqual([3, 1, 4, 1, 5]);
    });
  });
});
