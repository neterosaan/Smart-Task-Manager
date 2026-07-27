const { defineConfig } = require('vitest/config');

module.exports = defineConfig({
  test: {
    environment: 'node',
    globals: false,
    testTimeout: 10000,
    fileParallelism: false,
  },
});
