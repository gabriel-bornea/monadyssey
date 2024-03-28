import { NonEmptyList } from "../src";
import { describe, expect, it } from "@jest/globals";

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
    expect(func).toThrowError("Index 5 is not in 0..2");
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
});
