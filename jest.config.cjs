module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  testMatch: ["**/test/**/*.(spec|test).[jt]s?(x)"],
  transform: {
    "^.+\\.ts$": "ts-jest",
    "^.+\\.tsx$": "ts-jest"
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
