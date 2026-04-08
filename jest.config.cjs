module.exports = {
  testEnvironment: "node",
  testMatch: ["**/test/**/*.(spec|test).[jt]s?(x)"],
  transform: {
    "^.+\\.tsx?$": ["@swc/jest", {
      jsc: {
        parser: {
          syntax: "typescript",
          decorators: true,
        },
        target: "es2020",
      },
    }],
  },
  coveragePathIgnorePatterns: [
    "simulation.ts",
    "index.ts"
  ],
  moduleFileExtensions: ["ts", "tsx", "js", "jsx", "json", "node"],
  modulePathIgnorePatterns: [
    "<rootDir>/package.json"
  ],
  moduleNameMapper: {
    "^monadyssey$": "<rootDir>/packages/monadyssey-core/src"
  }
};
