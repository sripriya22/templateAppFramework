/** @type {import('jest').Config} */
module.exports = {
  // Test environment
  testEnvironment: 'jsdom',
  testEnvironmentOptions: {
    url: 'http://localhost',
  },
  
  // Setup files - Use setupFiles to run before the test framework is installed
  setupFiles: ['<rootDir>/appFramework/test/setup-globals.cjs'],
  // Use setupFilesAfterEnv to run after the test framework is installed
  setupFilesAfterEnv: ['<rootDir>/appFramework/test/setup.cjs'],
  
  // Test matching
  testMatch: ['**/appFramework/test/**/*.test.js'],
  testPathIgnorePatterns: [
    '/node_modules/'
  ],
  
  // Module resolution
  moduleFileExtensions: ['js', 'json', 'jsx', 'node'],
  moduleNameMapper: {
    '^@data-model-framework/core(.*)$': '<rootDir>/appFramework/$1',
    '^core-js-pure/(.*)$': '<rootDir>/node_modules/core-js-pure/$1',
    '^core-js-pure$': '<rootDir>/appFramework/test/__mocks__/core-js-pure.js',
    '\\.(css|less|scss|sass)$': '<rootDir>/appFramework/test/__mocks__/styleMock.js',
    '^jquery$': '<rootDir>/appFramework/test/__mocks__/jquery.js',
  },
  
  // Transform
  transform: {
    '^.+\\.js$': ['babel-jest', { rootMode: 'upward' }],
  },
  transformIgnorePatterns: [
    'node_modules/(?!(node-fetch|fetch-blob|whatwg-url)/)',
  ],
  
  // Coverage
  collectCoverage: true,
  collectCoverageFrom: [
    'appFramework/**/*.js',
    '!**/node_modules/**',
    '!**/test/**',
    '!**/__mocks__/**',
    '!**/dist/**',
  ],
  coverageReporters: ['text', 'lcov', 'json'],
  coverageDirectory: 'coverage',
  coveragePathIgnorePatterns: [
    '/node_modules/'
  ],
  
  // Global variables
  globals: {
    'ts-jest': {
      isolatedModules: true
    },
    // TextEncoder and TextDecoder are now handled in setup-globals.js
  },
  
  // Test configuration
  resetMocks: true,
  clearMocks: true,
  watchman: true,
  
  // Test timeout
  testTimeout: 10000,
  
  // Enable ES modules support
  extensionsToTreatAsEsm: ['.js'],
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
    ...module.exports.moduleNameMapper
  }
};
