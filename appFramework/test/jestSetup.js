// Global test setup for Jest
import '@testing-library/jest-dom';

// Mock jQuery globally
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
    empty: jest.fn(),
    append: jest.fn(),
    css: jest.fn(),
    hide: jest.fn(),
    show: jest.fn(),
    find: jest.fn().mockReturnValue({ length: 0 }),
    closest: jest.fn(),
    parent: jest.fn(),
    children: jest.fn(),
    each: jest.fn(),
    length: 0
  };
};

// Static jQuery methods
global.$.ajax = jest.fn();
global.$.getJSON = jest.fn();
global.$.fn = {
  jquery: '3.6.0',
  on: jest.fn(),
  off: jest.fn()
};

// Mock window.matchMedia which is not implemented in JSDOM
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(),
    removeListener: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
});

// Mock ResizeObserver which is not available in JSDOM
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
window.ResizeObserver = ResizeObserverStub;
