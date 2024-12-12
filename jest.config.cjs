module.exports = {
  preset: "ts-jest",
  testMatch: ["**/test/**/*.(spec|test).[jt]s?(x)"],
  transform: {
    '^.+\\.tsx?$': 'ts-jest',
  },
  coveragePathIgnorePatterns: [
    "simulation.ts",
    "index.ts"
  ],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  moduleNameMapper: {
    "^monadyssey$": "<rootDir>/packages/monadyssey-core/src",
    "^monadyssey/package.json$": "<rootDir>/packages/monadyssey-core/package.json"
  },
  modulePathIgnorePatterns: [
    "<rootDir>/package.json"
  ]
};
