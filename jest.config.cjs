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
  modulePathIgnorePatterns: [
    "<rootDir>/package.json"
  ]
};
