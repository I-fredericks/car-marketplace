module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/__tests__/**/*.test.js'],
  setupFiles: ['<rootDir>/__tests__/setup.js'],
  // Tests share one hosted Supabase database (carmarket_test); parallel
  // workers raced on shared rows. maxWorkers:1 = deterministic, sequential.
  maxWorkers: 1,
  testTimeout: 45000,
  verbose: true,
  forceExit: true,
  clearMocks: true
};
