const ESM_ONLY = [
  'htmlparser2',
  'domhandler',
  'domutils',
  'dom-serializer',
  'domelementtype',
  'entities',
];

module.exports = {
  testEnvironment: 'node',
  setupFilesAfterEnv: ['<rootDir>/test/setup.js'],
  testMatch: ['<rootDir>/test/**/*.test.js'],
  // The project is plain CommonJS and runs on Node directly (no Babel). Skipping
  // transforms keeps it that way and avoids Babel parsing sloppy-mode CommonJS
  // (e.g. config.js uses `const package = ...`) as a strict ES module.
  // The exception is sanitize-html's ESM-only parser stack, which Node loads
  // via require(esm) but Jest's CommonJS runtime cannot.
  transform: {
    [`/node_modules/(${ESM_ONLY.join('|')})/.+\\.js$`]: [
      'babel-jest',
      {
        plugins: [
          '@babel/plugin-transform-export-namespace-from',
          '@babel/plugin-transform-modules-commonjs',
        ],
      },
    ],
  },
  transformIgnorePatterns: [`/node_modules/(?!(${ESM_ONLY.join('|')})/)`],
  collectCoverageFrom: ['lib/**/*.js'],
  coverageProvider: 'v8',
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'text-summary', 'html', 'lcov'],
  clearMocks: true,
};
