import { describe, expect, it } from "@jest/globals";
import { Either, Left, Right } from "../src/either";

describe("Either", () => {
  describe("map", () => {
    it("should transform the right value of a Right instance", () => {
      const either: Either<string, number> = Right.of(5);
      const mapped = either.map((value) => value * 2);
      expect(mapped).toEqual(Right.of(10));
    });

    it("should not affect a Left instance", () => {
      const either: Either<string, number> = Left.of("Error");
      const mapped = either.map((value) => value * 2);
      expect(mapped).toEqual(Left.of("Error"));
    });
  });

  describe("flatMap", () => {
    it("should chain operations for a Right instance", () => {
      const either: Either<string, number> = Right.of(5);
      const result = either.flatMap((value) => Right.of(value * 2));
      expect(result).toEqual(Right.of(10));
    });

    it("should propagate the error for a Left instance", () => {
      const either: Either<string, number> = Left.of("Error");
      const result = either.flatMap((value) => Right.of(value * 2));
      expect(result).toEqual(Left.of("Error"));
    });
  });

  describe("fold", () => {
    it("should execute the right function for a Right instance", () => {
      const either: Either<string, number> = Right.of(5);
      const result = either.fold(
        (error) => `Error occurred: ${error}`,
        (value) => `Success with ${value}`
      );
      expect(result).toBe("Success with 5");
    });

    it("should execute the left function for a Left instance", () => {
      const either: Either<string, number> = Left.of("Error");
      const result = either.fold(
        (error) => `Error occurred: ${error}`,
        (value) => `Success with ${value}`
      );
      expect(result).toBe("Error occurred: Error");
    });
  });

  describe("onLeft", () => {
    it("should execute the action for a Left instance", () => {
      let errorMessage = "";
      const either: Either<string, number> = Left.of("Error");
      const result = either.onLeft((error) => {
        errorMessage = error;
      });
      expect(errorMessage).toBe("Error");
      expect(result).toEqual(Left.of("Error"));
    });

    it("should not execute the action for a Right instance", () => {
      let errorMessage = "";
      const either: Either<string, number> = Right.of(5);
      const result = either.onLeft((error) => {
        errorMessage = error;
      });
      expect(errorMessage).toBe("");
      expect(result).toEqual(Right.of(5));
    });
  });

  describe("onRight", () => {
    it("should execute the action for a Right instance", () => {
      let successMessage = "";
      const either: Either<string, number> = Right.of(5);
      const result = either.onRight((value) => {
        successMessage = `Success with ${value}`;
      });
      expect(successMessage).toBe("Success with 5");
      expect(result).toEqual(Right.of(5));
    });

    it("should not execute the action for a Left instance", () => {
      let successMessage = "";
      const either: Either<string, number> = Left.of("Error");
      const result = either.onRight((value) => {
        successMessage = `Success with ${value}`;
      });
      expect(successMessage).toBe("");
      expect(result).toEqual(Left.of("Error"));
    });
  });
});
