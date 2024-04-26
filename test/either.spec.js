"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var globals_1 = require("@jest/globals");
var src_1 = require("../src");
(0, globals_1.describe)("Either", function () {
    (0, globals_1.describe)("map", function () {
        (0, globals_1.it)("should transform the right value of a Right instance", function () {
            var either = src_1.Right.of(5);
            var mapped = either.map(function (value) { return value * 2; });
            (0, globals_1.expect)(mapped).toEqual(src_1.Right.of(10));
        });
        (0, globals_1.it)("should not affect a Left instance", function () {
            var either = src_1.Left.of("Error");
            var mapped = either.map(function (value) { return value * 2; });
            (0, globals_1.expect)(mapped).toEqual(src_1.Left.of("Error"));
        });
    });
    (0, globals_1.describe)("mapLeft", function () {
        (0, globals_1.it)("should transform the left value of a Left instance", function () {
            var either = src_1.Left.of(5);
            var mapped = either.mapLeft(function (value) { return value * 2; });
            (0, globals_1.expect)(mapped).toEqual(src_1.Left.of(10));
        });
        (0, globals_1.it)("should not affect a Right instance", function () {
            var either = src_1.Right.of("test");
            var mapped = either.mapLeft(function (value) { return value * 2; });
            (0, globals_1.expect)(mapped).toEqual(src_1.Right.of("test"));
        });
    });
    (0, globals_1.describe)("flatMap", function () {
        (0, globals_1.it)("should chain operations for a Right instance", function () {
            var either = src_1.Right.of(5);
            var result = either.flatMap(function (value) { return src_1.Right.of(value * 2); });
            (0, globals_1.expect)(result).toEqual(src_1.Right.of(10));
        });
        (0, globals_1.it)("should propagate the error for a Left instance", function () {
            var either = src_1.Left.of("Error");
            var result = either.flatMap(function (value) { return src_1.Right.of(value * 2); });
            (0, globals_1.expect)(result).toEqual(src_1.Left.of("Error"));
        });
    });
    (0, globals_1.describe)("fold", function () {
        (0, globals_1.it)("should execute the right function for a Right instance", function () {
            var either = src_1.Right.of(5);
            var result = either.fold(function (error) { return "Error occurred: ".concat(error); }, function (value) { return "Success with ".concat(value); });
            (0, globals_1.expect)(result).toBe("Success with 5");
        });
        (0, globals_1.it)("should execute the left function for a Left instance", function () {
            var either = src_1.Left.of("Error");
            var result = either.fold(function (error) { return "Error occurred: ".concat(error); }, function (value) { return "Success with ".concat(value); });
            (0, globals_1.expect)(result).toBe("Error occurred: Error");
        });
    });
    (0, globals_1.describe)("tapLeft", function () {
        (0, globals_1.it)("should execute the action for a Left instance", function () {
            var errorMessage = "";
            var either = src_1.Left.of("Error");
            var result = either.tapLeft(function (error) {
                errorMessage = error;
            });
            (0, globals_1.expect)(errorMessage).toBe("Error");
            (0, globals_1.expect)(result).toEqual(src_1.Left.of("Error"));
        });
        (0, globals_1.it)("should not execute the action for a Right instance", function () {
            var errorMessage = "";
            var either = src_1.Right.of(5);
            var result = either.tapLeft(function (error) {
                errorMessage = error;
            });
            (0, globals_1.expect)(errorMessage).toBe("");
            (0, globals_1.expect)(result).toEqual(src_1.Right.of(5));
        });
    });
    (0, globals_1.describe)("tap", function () {
        (0, globals_1.it)("should execute the action for a Right instance", function () {
            var successMessage = "";
            var either = src_1.Right.of(5);
            var result = either.tap(function (value) {
                successMessage = "Success with ".concat(value);
            });
            (0, globals_1.expect)(successMessage).toBe("Success with 5");
            (0, globals_1.expect)(result).toEqual(src_1.Right.of(5));
        });
        (0, globals_1.it)("should not execute the action for a Left instance", function () {
            var successMessage = "";
            var either = src_1.Left.of("Error");
            var result = either.tap(function (value) {
                successMessage = "Success with ".concat(value);
            });
            (0, globals_1.expect)(successMessage).toBe("");
            (0, globals_1.expect)(result).toEqual(src_1.Left.of("Error"));
        });
    });
});
