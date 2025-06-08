// Import test environment setup
require('./setup-test-env');

const { Binding } = require('./__mocks__/Binding.js');
const EventTypes = {
  MODEL_TO_VIEW_PROPERTY_CHANGED: 'MODEL_TO_VIEW_PROPERTY_CHANGED',
  VIEW_TO_MODEL_PROPERTY_CHANGED: 'VIEW_TO_MODEL_PROPERTY_CHANGED',
  CLIENT_ERROR: 'CLIENT_ERROR'
};

const createMockEvent = (type, data) => {
  return {
    type,
    ...data
  };
};

// Mock the EventManager
jest.mock('../controller/EventManager.js', () => ({
  addEventListener: jest.fn(),
  removeEventListener: jest.fn(),
  dispatchEvent: jest.fn(),
}));

describe('Binding', () => {
  let mockEventManager;
  let mockElement;
  let binding;
  let defaultOptions;
  let addEventListenerSpy;
  
  beforeEach(() => {
    // Create a spy on HTMLElement.prototype.addEventListener
    addEventListenerSpy = jest.spyOn(HTMLElement.prototype, 'addEventListener');
    
    // Create mock event manager
    mockEventManager = {
      dispatchEvent: jest.fn(),
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      _owner: {
        getModel: jest.fn().mockReturnValue({
          getRootInstance: jest.fn().mockReturnValue({
            testProperty: 'initialValue',
            nestedProperty: { value: 'nestedValue' },
            items: [{ name: 'Item 1' }, { name: 'Item 2' }]
          })
        })
      }
    };
    
    // Create a mock DOM element for testing
    mockElement = document.createElement('input');
    mockElement.type = 'text';
    document.body.appendChild(mockElement);
    
    // Default binding options
    defaultOptions = {
      path: 'testProperty',
      element: mockElement,
      attribute: 'value',
      eventManager: mockEventManager
    };
    
    // Spy on element event listeners
    jest.spyOn(mockElement, 'removeEventListener');
    
    // Spy on console methods
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });
  
  afterEach(() => {
    // Clean up DOM
    if (mockElement && mockElement.parentNode) {
      mockElement.parentNode.removeChild(mockElement);
    }
    
    // Clean up the spy
    addEventListenerSpy.mockRestore();
    
    // If binding was created, destroy it
    if (binding && binding.destroy) {
      binding.destroy();
    }
    
    // Clear all mocks
    jest.clearAllMocks();
  });
  
  describe('constructor', () => {
    test('should initialize with valid options', () => {
      binding = new Binding(defaultOptions);
      
      expect(binding).toBeDefined();
      expect(binding.path).toBe(defaultOptions.path);
      expect(binding.element).toBe(defaultOptions.element);
      expect(binding.attribute).toBe(defaultOptions.attribute);
      expect(binding.eventManager).toBe(mockEventManager);
      expect(binding._isUpdatingFromModel).toBe(false);
    });
    
    test('should throw if required options are missing', () => {
      // Path is required
      expect(() => {
        new Binding({ ...defaultOptions, path: undefined });
      }).toThrow('Missing required binding options');
      
      // Element is required
      expect(() => {
        new Binding({ ...defaultOptions, element: undefined });
      }).toThrow('Missing required binding options');
      
      // Event manager is required
      expect(() => {
        new Binding({ ...defaultOptions, eventManager: undefined });
      }).toThrow('Missing required binding options');
    });
    
    test('should use default attribute value if not specified', () => {
      binding = new Binding({
        path: defaultOptions.path,
        element: defaultOptions.element,
        eventManager: defaultOptions.eventManager
      });
      
      expect(binding.attribute).toBe('value');
    });
    
    test('should set up view event listeners', () => {
      // Since the mock implementation calls element.addEventListener directly
      // we need to spy on the specific element's method, not the prototype
      const elementAddEventSpy = jest.spyOn(mockElement, 'addEventListener');
      
      binding = new Binding(defaultOptions);
      
      expect(elementAddEventSpy).toHaveBeenCalledWith(
        'input', // Default event for input elements
        expect.any(Function)
      );
      
      // Should store binding reference on element
      expect(mockElement.__binding).toBe(binding);
      
      // Clean up the new spy
      elementAddEventSpy.mockRestore();
    });
    
    test('should determine appropriate view event based on element type', () => {
      // Test select element
      const selectElement = document.createElement('select');
      const selectAddEventSpy = jest.spyOn(selectElement, 'addEventListener');
      
      binding = new Binding({
        ...defaultOptions,
        element: selectElement
      });
      
      expect(selectAddEventSpy).toHaveBeenCalledWith(
        'change',
        expect.any(Function)
      );
      selectAddEventSpy.mockRestore();
      
      // Test checkbox input
      const checkboxElement = document.createElement('input');
      checkboxElement.type = 'checkbox';
      const checkboxAddEventSpy = jest.spyOn(checkboxElement, 'addEventListener');
      
      binding = new Binding({
        ...defaultOptions, 
        element: checkboxElement
      });
      
      expect(checkboxAddEventSpy).toHaveBeenCalledWith(
        'change',
        expect.any(Function)
      );
      checkboxAddEventSpy.mockRestore();
      
      // Test button element
      const buttonElement = document.createElement('button');
      binding = new Binding({
        ...defaultOptions,
        element: buttonElement
      });
      expect(binding._viewEvent).toBe('click');
    });
    
    test('should use custom view event if specified', () => {
      // Create a spy on this specific element's addEventListener method
      const customEventElementSpy = jest.spyOn(mockElement, 'addEventListener');
      
      binding = new Binding({
        ...defaultOptions,
        events: { view: 'custom-event' }
      });
      
      expect(customEventElementSpy).toHaveBeenCalledWith(
        'custom-event',
        expect.any(Function)
      );
      
      // Clean up the spy
      customEventElementSpy.mockRestore();
    });
  });
  
  describe('_handleViewChange', () => {
    let mockModel;
    
    beforeEach(() => {
      // Create a mock model
      mockModel = {
        getRootInstance: jest.fn().mockReturnValue({
          testProperty: 'oldValue',
          count: 0,
          isChecked: false
        }),
        setProperty: jest.fn(),
        getProperty: jest.fn().mockImplementation((path) => {
          const parts = path.split('.');
          let value = mockModel.getRootInstance();
          for (const part of parts) {
            if (value && typeof value === 'object' && part in value) {
              value = value[part];
            } else {
              return undefined;
            }
          }
          return value;
        })
      };
      
      // Set up the mock model in the event manager
      mockEventManager._owner.getModel.mockReturnValue(mockModel);
      
      // Create a new binding for each test
      binding = new Binding({
        ...defaultOptions,
        path: 'testProperty'
      });
      
      // Reset all mocks before each test
      jest.clearAllMocks();
    });
    
    test('should update model when view changes', () => {
      // Simulate user input
      mockElement.value = 'newValue';
      const mockEvent = createMockEvent('input', {
        target: { value: 'newValue' }
      });
      
      // Trigger the view change handler
      binding._boundHandleViewChange(mockEvent);
      
      // Verify the event was dispatched with the correct data
      expect(mockEventManager.dispatchEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          type: EventTypes.VIEW_TO_MODEL_PROPERTY_CHANGED,
          detail: expect.objectContaining({
            path: 'testProperty',
            value: 'newValue'
          })
        })
      );
    });
    
    test('should not update model during model update', () => {
      // Simulate a model update in progress
      binding._isUpdatingFromModel = true;
      
      // Simulate user input
      mockElement.value = 'ignoredValue';
      const mockEvent = createMockEvent('input', {
        target: { value: 'ignoredValue' }
      });
      
      // Trigger the view change handler
      binding._boundHandleViewChange(mockEvent);
      
      // Verify no event was dispatched
      expect(mockEventManager.dispatchEvent).not.toHaveBeenCalled();
    });
    
    test('should handle checked attribute correctly', () => {
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      document.body.appendChild(checkbox);
      
      // Create a new binding for the checkbox
      const checkboxBinding = new Binding({
        ...defaultOptions,
        element: checkbox,
        attribute: 'checked',
        path: 'isChecked'
      });
      
      try {
        // Simulate checkbox check
        checkbox.checked = true;
        const mockEvent = createMockEvent('change', {
          target: checkbox
        });
        
        // Trigger the view change handler
        checkboxBinding._boundHandleViewChange(mockEvent);
        
        // Verify the event was dispatched with the correct checked value
        expect(mockEventManager.dispatchEvent).toHaveBeenCalledWith(
          expect.objectContaining({
            type: EventTypes.VIEW_TO_MODEL_PROPERTY_CHANGED,
            detail: expect.objectContaining({
              path: 'isChecked',
              value: true
            })
          })
        );
      } finally {
        // Clean up
        document.body.removeChild(checkbox);
        checkboxBinding.destroy();
      }
    });
    
    test('should use custom parser if provided', () => {
      const customParser = jest.fn().mockReturnValue(42);
      
      // Create a new binding with custom parser
      const parserBinding = new Binding({
        ...defaultOptions,
        path: 'count',
        parser: customParser
      });
      
      try {
        // Simulate numeric input
        mockElement.value = '42';
        const mockEvent = createMockEvent('input', {
          target: { value: '42' }
        });
        
        // Trigger the view change handler
        parserBinding._boundHandleViewChange(mockEvent);
        
        // Verify the parser was called with the input value and path
        expect(customParser).toHaveBeenCalledWith('42', 'count');
        
        // Verify the event was dispatched with the parsed value
        expect(mockEventManager.dispatchEvent).toHaveBeenCalledWith(
          expect.objectContaining({
            type: EventTypes.VIEW_TO_MODEL_PROPERTY_CHANGED,
            detail: expect.objectContaining({
              path: 'count',
              value: 42
            })
          })
        );
      } finally {
        // Clean up
        parserBinding.destroy();
      }
    });
    
    test('should update view when model changes for matching path', () => {
      // Create a spy on the _updateViewFromModel method
      const updateSpy = jest.spyOn(binding, '_updateViewFromModel');
      
      // Simulate a model change event
      binding.handleModelChange({
        type: EventTypes.MODEL_TO_VIEW_PROPERTY_CHANGED,
        detail: {
          path: 'testProperty',
          value: 'newValue'
        }
      });
      
      // Verify the view was updated with the new value
      expect(updateSpy).toHaveBeenCalledWith('newValue');
      
      // Verify the flag was set and reset
      expect(binding._isUpdatingFromModel).toBe(false);
    });
    
    test('should not update view for non-matching path', () => {
      // Create a spy on _updateViewFromModel
      const updateSpy = jest.spyOn(binding, '_updateViewFromModel');
      
      // Simulate model change event with non-matching path
      binding.handleModelChange({
        type: EventTypes.MODEL_TO_VIEW_PROPERTY_CHANGED,
        detail: {
          path: 'nonExistentPath',
          value: 'differentValue'
        }
      });
      
      // Verify view was not updated
      expect(updateSpy).not.toHaveBeenCalled();
    });
    
    test('should handle nested property paths', () => {
      // Create a binding with a nested path
      const nestedBinding = new Binding({
        ...defaultOptions,
        path: 'nested.property'
      });
      
      // Create a spy on _updateViewFromModel
      const updateSpy = jest.spyOn(nestedBinding, '_updateViewFromModel');
      
      // Simulate model change event for the nested property
      nestedBinding.handleModelChange({
        type: EventTypes.MODEL_TO_VIEW_PROPERTY_CHANGED,
        detail: {
          path: 'nested.property',
          value: 'updatedNestedValue'
        }
      });
      
      // Verify the view was updated with the nested value
      expect(updateSpy).toHaveBeenCalledWith('updatedNestedValue');
    });
    
    test('should reset isUpdatingFromModel flag even if error occurs', () => {
      // Make _updateViewFromModel throw an error
      jest.spyOn(binding, '_updateViewFromModel').mockImplementation(() => {
        throw new Error('Test error');
      });
      
      // Verify the error is caught and flag is still reset
      expect(() => {
        binding.handleModelChange({
          type: EventTypes.MODEL_TO_VIEW_PROPERTY_CHANGED,
          detail: {
            path: 'testProperty',
            value: 'errorValue'
          }
        });
      }).not.toThrow();
      
      // Verify flag was reset even after error
      expect(binding._isUpdatingFromModel).toBe(false);
    });
  });
  
  describe('_updateViewFromModel', () => {
    let mockModel;
    
    beforeEach(() => {
      // Create a mock model
      mockModel = {
        getRootInstance: jest.fn().mockReturnValue({
          testProperty: 'testValue',
          isActive: true,
          count: 42,
          nested: { value: 'nestedValue' },
          items: ['item1', 'item2']
        }),
        getProperty: jest.fn().mockImplementation((path) => {
          const parts = path.split('.');
          let value = mockModel.getRootInstance();
          for (const part of parts) {
            if (value && typeof value === 'object' && part in value) {
              value = value[part];
            } else {
              return undefined;
            }
          }
          return value;
        })
      };
      
      // Set up the mock model in the event manager
      mockEventManager._owner.getModel.mockReturnValue(mockModel);
      
      // Create a new binding for each test
      binding = new Binding({
        ...defaultOptions,
        path: 'testProperty'
      });
      
      // Reset all mocks before each test
      jest.clearAllMocks();
    });
    
    test('should update element value when model changes', () => {
      // Simulate a model change
      binding._updateViewFromModel('newValue');
      
      // Verify the element was updated
      expect(mockElement.value).toBe('newValue');
    });
    
    test('should handle boolean values for checkboxes', () => {
      // Create a checkbox element
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      
      // Create a binding for the checkbox
      const checkboxBinding = new Binding({
        ...defaultOptions,
        element: checkbox,
        attribute: 'checked',
        path: 'isActive'
      });
      
      try {
        // Simulate a model change with boolean value
        checkboxBinding._updateViewFromModel(true);
        
        // Verify the checkbox was checked
        expect(checkbox.checked).toBe(true);
        
        // Simulate another change
        checkboxBinding._updateViewFromModel(false);
        
        // Verify the checkbox was unchecked
        expect(checkbox.checked).toBe(false);
      } finally {
        // Clean up
        checkboxBinding.destroy();
      }
    });
    
    test('should use custom formatter if provided', () => {
      const customFormatter = jest.fn().mockReturnValue('formatted:testValue');
      
      // Create a binding with custom formatter
      const formattedBinding = new Binding({
        ...defaultOptions,
        formatter: customFormatter
      });
      
      try {
        // Simulate a model change
        formattedBinding._updateViewFromModel('testValue');
        
        // Verify the formatter was called with the correct value
        expect(customFormatter).toHaveBeenCalledWith('testValue');
        
        // Verify the element was updated with the formatted value
        expect(mockElement.value).toBe('formatted:testValue');
      } finally {
        // Clean up
        formattedBinding.destroy();
      }
    });
    
    // TODO: Fix this test to properly handle null/undefined values
    test.skip('should handle null or undefined values', () => {
      // Create a new element and binding specifically for this test
      const testElement = document.createElement('input');
      testElement.type = 'text';
      document.body.appendChild(testElement);
      
      const nullBinding = new Binding({
        path: 'testProperty',
        element: testElement,
        attribute: 'value',
        eventManager: mockEventManager
      });
      
      try {
        // Test with null
        nullBinding._updateViewFromModel(null);
        expect(testElement.value).toBe('');
        
        // Test with undefined
        nullBinding._updateViewFromModel(undefined);
        expect(testElement.value).toBe('');
      } finally {
        // Clean up
        if (testElement.parentNode) {
          testElement.parentNode.removeChild(testElement);
        }
        nullBinding.destroy();
      }
    });
    
    test('should handle different attribute types', () => {
      // Test with textContent attribute
      const div = document.createElement('div');
      const textBinding = new Binding({
        ...defaultOptions,
        element: div,
        attribute: 'textContent',
        path: 'testProperty'
      });
      
      try {
        textBinding._updateViewFromModel('some text');
        expect(div.textContent).toBe('some text');
      } finally {
        textBinding.destroy();
      }
      
      // Test with innerHTML attribute
      const span = document.createElement('span');
      const htmlBinding = new Binding({
        ...defaultOptions,
        element: span,
        attribute: 'innerHTML',
        path: 'testProperty'
      });
      
      try {
        htmlBinding._updateViewFromModel('<strong>HTML</strong>');
        expect(span.innerHTML).toBe('<strong>HTML</strong>');
      } finally {
        htmlBinding.destroy();
      }
    });
    
    test('should update element with formatted value', () => {
      // Simulate a model change with explicit value
      binding._updateViewFromModel('explicitValue');
      
      // Verify element was updated
      expect(mockElement.value).toBe('explicitValue');
    });
    
    test('should use custom formatter if provided', () => {
      const customFormatter = jest.fn().mockReturnValue('formatted:testValue');
      
      // Create a new binding with custom formatter
      const formattedBinding = new Binding({
        ...defaultOptions,
        formatter: customFormatter
      });
      
      try {
        // Simulate a model change
        formattedBinding._updateViewFromModel('testValue');
        
        // Verify the formatter was called with the correct value
        expect(customFormatter).toHaveBeenCalledWith('testValue');
        
        // Verify the element was updated with the formatted value
        expect(mockElement.value).toBe('formatted:testValue');
      } finally {
        // Clean up
        formattedBinding.destroy();
      }
    });
    
    test('should handle different attribute types', () => {
      // Test with textContent attribute
      const div = document.createElement('div');
      const textBinding = new Binding({
        ...defaultOptions,
        element: div,
        attribute: 'textContent',
        path: 'testProperty'
      });
      
      try {
        textBinding._updateViewFromModel('some text');
        expect(div.textContent).toBe('some text');
      } finally {
        textBinding.destroy();
      }
      
      // Test with innerHTML attribute
      const span = document.createElement('span');
      const htmlBinding = new Binding({
        ...defaultOptions,
        element: span,
        attribute: 'innerHTML',
        path: 'testProperty'
      });
      
      try {
        htmlBinding._updateViewFromModel('<strong>HTML</strong>');
        expect(span.innerHTML).toBe('<strong>HTML</strong>');
      } finally {
        htmlBinding.destroy();
      }
    });
    
    test('should get value from model if no explicit value provided', () => {
      // Mock the model's getProperty method to return a test value
      mockEventManager._owner.getModel.mockReturnValueOnce({
        getRootInstance: jest.fn().mockReturnValue({
          testProperty: 'modelValue'
        }),
        getProperty: jest.fn().mockReturnValue('modelValue')
      });
      
      // Update without explicit value - should get from model
      binding._updateViewFromModel();
      
      // Verify element was updated with model value
      expect(mockElement.value).toBe('modelValue');
    });
  });
  
  describe('destroy', () => {
    beforeEach(() => {
      binding = new Binding(defaultOptions);
    });
    
    test('should remove event listeners and clean up references', () => {
      // Store references before destroying
      const handler = binding._boundHandleViewChange;
      
      binding.destroy();
      
      // Verify view event listener was removed
      expect(mockElement.removeEventListener).toHaveBeenCalledWith('input', handler);
      
      // Verify binding reference was removed from element
      expect(mockElement.__binding).toBeUndefined();
      
      // Verify instance references were cleared
      expect(binding.element).toBeNull();
      expect(binding.eventManager).toBeNull();
      expect(binding._boundHandleViewChange).toBeNull();
    });
  });
});
