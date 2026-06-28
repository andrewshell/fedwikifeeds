module.exports = {
  testEnvironment: 'node',
  setupFilesAfterEnv: ['<rootDir>/test/setup.js'],
  testMatch: ['<rootDir>/test/**/*.test.js'],
  // The project is plain CommonJS and runs on Node directly (no Babel). Skipping
  // transforms keeps it that way and avoids Babel parsing sloppy-mode CommonJS
  // (e.g. config.js uses `const package = ...`) as a strict ES module.
  transform: {},
  collectCoverageFrom: ['lib/**/*.js'],
  coverageProvider: 'v8',
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'text-summary', 'html', 'lcov'],
  clearMocks: true,
};
