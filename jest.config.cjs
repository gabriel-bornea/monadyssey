module.exports = {
  testMatch: ["**/test/**/*.(spec|test).[jt]s?(x)"],
  transform: {
    '^.+\\.tsx?$': 'ts-jest',
  },
  coveragePathIgnorePatterns: [
    "simulation.ts",
    "index.ts"
  ],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
};
