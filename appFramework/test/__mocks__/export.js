// Mock for core-js internal export function
// This replaces the $ function that's causing the error
module.exports = function(obj) {
  return obj;
};
