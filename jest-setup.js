// Mock core-js-pure modules
jest.mock('core-js-pure/modules/es.array.is-array', () => {}, { virtual: true });
jest.mock('core-js-pure/internals/export', () => {
  return function mockExport(options) {
    // Simple mock implementation that just adds the properties as needed
    if (options && options.target && options.stat) {
      return options;
    }
    return function() {};
  };
}, { virtual: true });

// Set up global jQuery for tests
global.$ = function() {
  return {
    on: jest.fn(),
    off: jest.fn(),
    trigger: jest.fn(),
    addClass: jest.fn(),
    removeClass: jest.fn(),
    attr: jest.fn(),
    data: jest.fn(),
    val: jest.fn(),
    text: jest.fn(),
    html: jest.fn(),
    find: jest.fn().mockReturnValue({ length: 0 }),
    closest: jest.fn(),
    parent: jest.fn(),
    children: jest.fn(),
    each: jest.fn()
  };
};

// Static jQuery methods
global.$.ajax = jest.fn();
global.$.getJSON = jest.fn();
global.$.fn = {
  jquery: '3.5.1',
  on: jest.fn(),
  off: jest.fn()
};

// Mock other browser APIs that might be missing in the test environment
global.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};

global.matchMedia = jest.fn().mockImplementation(query => ({
  matches: false,
  media: query,
  onchange: null,
  addListener: jest.fn(),
  removeListener: jest.fn(),
  addEventListener: jest.fn(),
  removeEventListener: jest.fn(),
  dispatchEvent: jest.fn(),
}));
