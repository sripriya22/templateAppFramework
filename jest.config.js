module.exports = {
  testEnvironment: 'jsdom',
  testEnvironmentOptions: {
    url: 'http://localhost',
  },
  testMatch: ['**/test/**/*.test.js'],
  moduleFileExtensions: ['js', 'json', 'jsx', 'node'],
  moduleNameMapper: {
    '^@data-model-framework/core(.*)$': '<rootDir>/appFramework/$1',
    '^@data-model-framework/generator(.*)$': '<rootDir>/appGenerator/$1',
    '\\.(css|less|scss|sass)$': '<rootDir>/test/__mocks__/styleMock.js',
  },
  transform: {
    '^.+\\.js$': 'babel-jest',
  },
  transformIgnorePatterns: [
    'node_modules/(?!(node-fetch|fetch-blob|whatwg-url)/)',
  ],
  testPathIgnorePatterns: [
    '/node_modules/',
    '/dist/'
  ],
  collectCoverage: true,
  collectCoverageFrom: [
    'appFramework/**/*.js',
    'appGenerator/**/*.js',
    '!**/node_modules/**',
    '!**/test/**',
    '!**/__mocks__/**',
    '!**/dist/**',
  ],
  coverageReporters: ['text', 'lcov', 'json'],
  coverageDirectory: 'coverage',
  globals: {
    TextEncoder: 'TextEncoder',
    TextDecoder: 'TextDecoder',
  },
  setupFilesAfterEnv: ['<rootDir>/test/setupTests.js'],
  transformIgnorePatterns: [
    'node_modules/(?!(.*)/)'
  ]
};
