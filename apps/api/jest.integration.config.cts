const base = require('./jest.config.cts');

/** Testes que precisam de Chromium e do Postgres rodando: `nx run api:test-integration`. */
module.exports = {
  ...base,
  displayName: 'api-integration',
  setupFiles: ['<rootDir>/src/testing/jest.setup-integration-env.ts'],
  testMatch: ['<rootDir>/src/**/*.integration.spec.ts'],
  testPathIgnorePatterns: [],
};
