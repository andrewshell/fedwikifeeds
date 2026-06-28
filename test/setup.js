// Shared test setup, applied to every test file via jest.config.js
// (setupFilesAfterEnv). Runs in each test file's module registry *before*
// the lib modules under test are required.

// The lib modules build their cache as `new Cacheism(Cacheism.store.filesystem(config))`
// at require time. Swapping the filesystem store factory for the in-memory one
// gives every test a fast, isolated, real-behavior cache with no disk I/O.
// (This mirrors the project's historical `cache.setStore(memoryStore)` approach.)
const { Cacheism } = require('@andrewshell/cacheism');
Cacheism.store.filesystem = Cacheism.store.memory;

// Keep test output clean. npmlog is a singleton, so silencing it here silences
// the `lib/log.js` wrapper too. lib/log.js sets the level at require time, so we
// re-assert "silent" before each test rather than once up front.
const npmlog = require('npmlog');
beforeEach(() => {
  npmlog.level = 'silent';
});
