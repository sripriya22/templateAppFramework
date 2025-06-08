// Mock for core-js-pure
module.exports = {
  // Mock any specific methods that are used in tests
  Array: {
    isArray: Array.isArray
  }
};
