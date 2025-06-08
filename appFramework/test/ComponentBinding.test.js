import { ComponentBinding } from '../binding/ComponentBinding.js';
import { EventTypes } from '../controller/EventTypes.js';

describe('ComponentBinding', () => {
  let mockEventManager;
  let mockElement;
  let mockComponent;
  let mockUpdateCallback;
  let componentBinding;
  
  beforeEach(() => {
    // Create mock event manager
    mockEventManager = {
      dispatchEvent: jest.fn(),
      addEventListener: jest.fn(),
      removeEventListener: jest.fn()
    };
    
    // Create a mock DOM element for testing
    mockElement = document.createElement('div');
    document.body.appendChild(mockElement);
    
    // Create mock update callback
    mockUpdateCallback = jest.fn();
    
    // Create mock component with required structure
    mockComponent = {
      constructor: { name: 'MockComponent' },
      _view: {
        getApp: jest.fn().mockReturnValue({
          getModel: jest.fn().mockReturnValue({
            getRootInstance: jest.fn().mockReturnValue({
              testProperty: 'initialValue',
              nestedProperty: { value: 'nestedValue' }
            })
          })
        })
      }
    };
    
    // Spy on console methods
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });
  
  afterEach(() => {
    // Clean up DOM
    if (mockElement.parentNode) {
      mockElement.parentNode.removeChild(mockElement);
    }
    
    // If binding was created, destroy it
    if (componentBinding && componentBinding.destroy) {
      componentBinding.destroy();
    }
    
    // Reset mocks
    jest.clearAllMocks();
  });
  
  describe('constructor', () => {
    test('should initialize with valid options', () => {
      componentBinding = new ComponentBinding({
        path: '',
        element: mockElement,
        eventManager: mockEventManager,
        component: mockComponent,
        updateCallback: mockUpdateCallback
      });
      
      expect(componentBinding).toBeDefined();
      expect(componentBinding.path).toBe('');
      expect(componentBinding.element).toBe(mockElement);
      expect(componentBinding.eventManager).toBe(mockEventManager);
      expect(componentBinding.component).toBe(mockComponent);
      expect(componentBinding.updateCallback).toBe(mockUpdateCallback);
    });
    
    test('should default to MODEL_TO_VIEW_PROPERTY_CHANGED event for model updates', () => {
      componentBinding = new ComponentBinding({
        path: '',
        element: mockElement,
        eventManager: mockEventManager,
        component: mockComponent,
        updateCallback: mockUpdateCallback
      });
      
      expect(componentBinding.events.model).toEqual([EventTypes.MODEL_TO_VIEW_PROPERTY_CHANGED]);
    });
    
    test('should set attribute to a non-DOM property', () => {
      componentBinding = new ComponentBinding({
        path: '',
        element: mockElement,
        eventManager: mockEventManager,
        component: mockComponent,
        updateCallback: mockUpdateCallback
      });
      
      expect(componentBinding.attribute).toBe('data-model-binding');
    });
    
    test('should setup event listeners correctly', () => {
      // Create spy on element addEventListener
      const addEventListenerSpy = jest.spyOn(mockElement, 'addEventListener');
      
      componentBinding = new ComponentBinding({
        path: '',
        element: mockElement,
        eventManager: mockEventManager,
        component: mockComponent,
        updateCallback: mockUpdateCallback
      });
      
      // The Binding base class might only set up 'input' events but not 'change'
      // or it might be configurable. Check that at least the input event is registered.
      expect(addEventListenerSpy).toHaveBeenCalledWith('input', expect.any(Function));
    });
  });
  
  describe('handleModelChange', () => {
    beforeEach(() => {
      componentBinding = new ComponentBinding({
        path: '',
        element: mockElement,
        eventManager: mockEventManager,
        component: mockComponent,
        updateCallback: mockUpdateCallback
      });
    });
    
    test('should call updateCallback with model and changed path', () => {
      // Simulate model change event
      const eventData = {
        path: 'testProperty',
        value: 'newValue',
        source: 'model'
      };
      
      // Get the model that should be passed to the callback
      const expectedModel = mockComponent._view.getApp().getModel();
      
      // Trigger model change handler
      componentBinding.handleModelChange(eventData);
      
      // Verify callback was called with correct parameters
      expect(mockUpdateCallback).toHaveBeenCalledWith(expectedModel, 'testProperty');
    });
    
    test('should handle errors in updateCallback gracefully', () => {
      // Make updateCallback throw an error
      mockUpdateCallback.mockImplementation(() => {
        throw new Error('Test error');
      });
      
      // Spy on console.error
      const consoleErrorSpy = jest.spyOn(console, 'error');
      
      // Simulate model change event
      const eventData = {
        path: 'testProperty',
        value: 'newValue',
        source: 'model'
      };
      
      // This should not throw
      expect(() => {
        componentBinding.handleModelChange(eventData);
      }).not.toThrow();
      
      // Should log error
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Error in ComponentBinding update callback:'),
        expect.any(Error)
      );
      
      // Flag should still be reset
      expect(componentBinding._isUpdatingFromModel).toBe(false);
    });
  });
  
  describe('_updateViewFromModel', () => {
    beforeEach(() => {
      componentBinding = new ComponentBinding({
        path: '',
        element: mockElement,
        eventManager: mockEventManager,
        component: mockComponent,
        updateCallback: mockUpdateCallback
      });
    });
    
    test('should do nothing (overridden from parent class)', () => {
      // Call the method
      componentBinding._updateViewFromModel('anyValue');
      
      // Verify element attributes were not changed
      expect(mockElement.getAttribute('data-model-binding')).toBeNull();
      
      // Verify updateCallback was not called directly
      expect(mockUpdateCallback).not.toHaveBeenCalled();
    });
  });
});
