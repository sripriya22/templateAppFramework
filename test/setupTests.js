// Global setup for tests
import '@testing-library/jest-dom';

// Add any global test setup here

// Mock any global browser APIs if needed
global.TextEncoder = require('util').TextEncoder;
global.TextDecoder = require('util').TextDecoder;
