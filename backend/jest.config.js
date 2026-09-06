module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/__tests__/**/*.test.js'],
  setupFiles: ['<rootDir>/__tests__/setup.js'],
  // Tests run against the hosted Supabase pooler (Frankfurt); cross-atlantic
  // latency comfortably exceeds Jest's 5s default on the heavier lifecycle suite.
  testTimeout: 30000,
  verbose: true,
  forceExit: true,
  clearMocks: true
};
