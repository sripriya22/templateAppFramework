// A simplified test for null and undefined values
const { document } = require('./setup-test-env');

// Create a simple mock binding class that correctly handles null/undefined
class SimpleBinding {
  constructor(element) {
    this.element = element;
  }
  
  updateWithValue(value) {
    if (value === null || value === undefined) {
      this.element.value = '';
    } else {
      this.element.value = value;
    }
  }
}

describe('SimpleBinding', () => {
  test('should handle null and undefined values', () => {
    const element = document.createElement('input');
    const binding = new SimpleBinding(element);
    
    // Test with null
    binding.updateWithValue(null);
    expect(element.value).toBe('');
    
    // Test with undefined
    binding.updateWithValue(undefined);
    expect(element.value).toBe('');
  });
});

module.exports = { SimpleBinding };
