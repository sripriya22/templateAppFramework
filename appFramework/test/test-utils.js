/**
 * Test utilities for the appFramework tests
 */

/**
 * Helper to create a mock event object
 * @param {string} type - Event type
 * @param {Object} [data] - Event data
 * @returns {CustomEvent}
 */
/**
 * Test utilities for the appFramework tests
 */

/**
 * Helper to create a mock event object
 * @param {string} type - Event type
 * @param {Object} [data] - Event data
 * @returns {CustomEvent}
 */
export function createEvent(type, data = {}) {
  return new CustomEvent(type, {
    detail: data,
    bubbles: true,
    cancelable: true,
  });
}

/**
 * Creates a mock DOM event for testing
 * @param {string} type - Event type (e.g., 'click', 'input', 'change')
 * @param {Object} [options] - Event options
 * @returns {Object} Mock event object
 */
export function createMockEvent(type, options = {}) {
  // Create a plain object instead of a real Event
  const event = {
    type,
    bubbles: true,
    cancelable: true,
    target: options.target || null,
    currentTarget: options.currentTarget || null,
    preventDefault: options.preventDefault || jest.fn(),
    stopPropagation: options.stopPropagation || jest.fn(),
    stopImmediatePropagation: options.stopImmediatePropagation || jest.fn(),
    ...options
  };
  
  // For input/change events, add value/checked properties
  if (event.target) {
    event.target.value = event.target.value || '';
    event.target.checked = event.target.checked || false;
  }
  
  return event;
}

/**
 * Waits for all promises to resolve
 * @returns {Promise<void>}
 */
export function flushPromises() {
  return new Promise(setImmediate);
}

/**
 * Creates a mock implementation of a class with spies on all methods
 * @param {Function} Class - The class to mock
 * @param {Object} [overrides] - Method overrides
 * @returns {Object} Mocked class instance with spies
 */
export function createMockInstance(Class, overrides = {}) {
  const mock = {};
  const prototype = Class.prototype;

  // Get all property names including getters/setters
  const propertyNames = [
    ...Object.getOwnPropertyNames(prototype),
    ...Object.getOwnPropertyNames(Class)
  ];

  // Create spies for all methods
  propertyNames.forEach(prop => {
    if (typeof prototype[prop] === 'function' && prop !== 'constructor') {
      mock[prop] = jest.fn(overrides[prop] || (() => {}));
    }
  });

  // Apply any overrides
  Object.assign(mock, overrides);

  return mock;
}

/**
 * Creates a test DOM element with the given HTML
 * @param {string} html - HTML string
 * @returns {HTMLElement}
 */
export function createTestElement(html) {
  const container = document.createElement('div');
  container.innerHTML = html;
  return container.firstElementChild || container;
}
