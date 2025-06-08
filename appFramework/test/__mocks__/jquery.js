// Mock jQuery
const $ = function() {
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
$.ajax = jest.fn();
$.getJSON = jest.fn();
$.fn = {
  jquery: '3.6.0',
  on: jest.fn(),
  off: jest.fn()
};

// Export for use with jest
module.exports = $;
