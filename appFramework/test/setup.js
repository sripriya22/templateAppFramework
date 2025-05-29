// Setup file for Jest tests
// Add any global test setup here

// Mock any global objects or functions needed for testing
global.console = {
  ...console,
  // Override console methods if needed
  // error: jest.fn(),
  // warn: jest.fn(),
  // log: jest.fn(),
};

// Add any global test utilities
// For example:
// global.wait = (ms = 0) => new Promise(resolve => setTimeout(resolve, ms));
