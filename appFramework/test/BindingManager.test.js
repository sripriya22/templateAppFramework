import { BindingManager } from '../binding/BindingManager.js';
import { Binding } from '../binding/Binding.js';
import { ComponentBinding } from '../binding/ComponentBinding.js';
import { EventTypes } from '../controller/EventTypes.js';
import { MockApp } from './__mocks__/App.js';

describe('BindingManager', () => {
  let bindingManager;
  let mockApp;
  let mockElement;
  
  beforeEach(() => {
    // Create mock app with event manager
    mockApp = new MockApp();
    mockApp.getModel = jest.fn().mockReturnValue({
      getRootInstance: jest.fn().mockReturnValue({
        nestedProperty: {
          value: 'initial value'
        },
        items: [
          { name: 'Item 1' },
          { name: 'Item 2' }
        ]
      })
    });
    
    // Create binding manager
    bindingManager = new BindingManager({ app: mockApp });
    
    // Create a mock DOM element for testing
    mockElement = document.createElement('input');
    mockElement.type = 'text';
    mockElement.value = '';
    document.body.appendChild(mockElement);
    
    // Spy on console methods
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });
  
  afterEach(() => {
    // Clean up DOM
    if (mockElement.parentNode) {
      mockElement.parentNode.removeChild(mockElement);
    }
    
    // Reset mocks
    jest.clearAllMocks();
  });
  
  describe('createBinding', () => {
    test('should create and store a new binding', () => {
      const binding = bindingManager.createBinding({
        path: 'nestedProperty.value',
        element: mockElement,
        attribute: 'value'
      });
      
      expect(binding).toBeInstanceOf(Binding);
      expect(binding.path).toBe('nestedProperty.value');
      expect(binding.element).toBe(mockElement);
      expect(bindingManager.bindings).toContain(binding);
    });
  });
  
  describe('createComponentBinding', () => {
    test('should create and store a new component binding', () => {
      const mockComponent = {
        constructor: { name: 'TestComponent' },
        update: jest.fn()
      };
      
      const binding = bindingManager.createComponentBinding({
        path: '',
        element: mockElement,
        component: mockComponent,
        updateCallback: mockComponent.update
      });
      
      expect(binding).toBeInstanceOf(ComponentBinding);
      expect(binding.component).toBe(mockComponent);
      expect(bindingManager.bindings).toContain(binding);
    });
  });
  
  describe('removeBinding', () => {
    test('should remove and destroy a binding', () => {
      const binding = bindingManager.createBinding({
        path: 'nestedProperty.value',
        element: mockElement
      });
      
      // Spy on binding.destroy
      binding.destroy = jest.fn();
      
      bindingManager.removeBinding(binding);
      
      expect(binding.destroy).toHaveBeenCalled();
      expect(bindingManager.bindings).not.toContain(binding);
    });
  });
  
  describe('removeBindingsForElement', () => {
    test('should remove all bindings for an element', () => {
      // Create two bindings for the same element
      const binding1 = bindingManager.createBinding({
        path: 'nestedProperty.value',
        element: mockElement
      });
      const binding2 = bindingManager.createBinding({
        path: 'otherProperty',
        element: mockElement
      });
      
      // Create a binding for a different element
      const otherElement = document.createElement('div');
      const binding3 = bindingManager.createBinding({
        path: 'thirdProperty',
        element: otherElement
      });
      
      // Spy on binding.destroy
      binding1.destroy = jest.fn();
      binding2.destroy = jest.fn();
      binding3.destroy = jest.fn();
      
      bindingManager.removeBindingsForElement(mockElement);
      
      // Two bindings for mockElement should be removed
      expect(binding1.destroy).toHaveBeenCalled();
      expect(binding2.destroy).toHaveBeenCalled();
      expect(binding3.destroy).not.toHaveBeenCalled();
      
      // Only binding3 should remain
      expect(bindingManager.bindings).not.toContain(binding1);
      expect(bindingManager.bindings).not.toContain(binding2);
      expect(bindingManager.bindings).toContain(binding3);
    });
  });
  
  describe('Event handling', () => {
    describe('_handleViewToModelPropertyChanged', () => {
      test('should update model and dispatch MODEL_TO_VIEW_PROPERTY_CHANGED', () => {
        // Spy on eventManager.dispatchEvent
        const dispatchEventSpy = jest.spyOn(mockApp.eventManager, 'dispatchEvent');
        
        // Create event data
        const eventData = {
          path: 'nestedProperty.value',
          value: 'new value',
          source: 'view'
        };
        
        // Call the handler directly
        bindingManager._handleViewToModelPropertyChanged(eventData);
        
        // Verify MODEL_TO_VIEW_PROPERTY_CHANGED was dispatched
        expect(dispatchEventSpy).toHaveBeenCalledWith(
          EventTypes.MODEL_TO_VIEW_PROPERTY_CHANGED,
          expect.objectContaining({
            path: eventData.path,
            value: eventData.value,
            source: 'binding_manager' // Source should be changed to binding_manager
          })
        );
      });
      
      test('should handle missing client model gracefully', () => {
        // Make getModel return null
        mockApp.getModel.mockReturnValueOnce(null);
        
        // Spy on console.error
        const consoleErrorSpy = jest.spyOn(console, 'error');
        
        // Create event data
        const eventData = {
          path: 'nestedProperty.value',
          value: 'new value'
        };
        
        // Call the handler directly
        bindingManager._handleViewToModelPropertyChanged(eventData);
        
        // Verify error was logged
        expect(consoleErrorSpy).toHaveBeenCalledWith(
          expect.stringContaining('No client model available'),
          eventData.path
        );
      });
    });
    
    describe('_handleModelToViewPropertyChanged', () => {
      test('should update matching bindings', () => {
        // Create a binding and spy on its handleModelChange method
        const binding = bindingManager.createBinding({
          path: 'nestedProperty.value',
          element: mockElement
        });
        binding.handleModelChange = jest.fn();
        
        // Create event data
        const eventData = {
          path: 'nestedProperty.value',
          value: 'new value',
          source: 'model'
        };
        
        // Call the handler directly
        bindingManager._handleModelToViewPropertyChanged(eventData);
        
        // Verify binding.handleModelChange was called
        expect(binding.handleModelChange).toHaveBeenCalledWith(eventData);
      });
      
      test('should update component bindings with empty path', () => {
        // Create a component binding with empty path
        const mockComponent = {
          constructor: { name: 'TestComponent' },
          update: jest.fn()
        };
        
        const componentBinding = bindingManager.createComponentBinding({
          path: '',
          element: mockElement,
          component: mockComponent,
          updateCallback: mockComponent.update
        });
        componentBinding.handleModelChange = jest.fn();
        
        // Create event data for any path
        const eventData = {
          path: 'any.path',
          value: 'any value'
        };
        
        // Call the handler directly
        bindingManager._handleModelToViewPropertyChanged(eventData);
        
        // Verify component binding handleModelChange was called
        expect(componentBinding.handleModelChange).toHaveBeenCalledWith(eventData);
      });
      
      test('should update array item bindings', () => {
        // Create a binding for an array item
        const binding = bindingManager.createBinding({
          path: 'items[0].name',
          element: mockElement
        });
        binding.handleModelChange = jest.fn();
        
        // Create event data for the array
        const eventData = {
          path: 'items',
          value: [{ name: 'Updated Item 1' }]
        };
        
        // Call the handler directly
        bindingManager._handleModelToViewPropertyChanged(eventData);
        
        // Verify binding.handleModelChange was called
        expect(binding.handleModelChange).toHaveBeenCalledWith(eventData);
      });
    });
  });
  
  describe('getBindingsForPath', () => {
    test('should find exact path matches', () => {
      // Create bindings with different paths
      const binding1 = bindingManager.createBinding({
        path: 'path1',
        element: mockElement
      });
      const binding2 = bindingManager.createBinding({
        path: 'path2',
        element: mockElement
      });
      
      const matches = bindingManager.getBindingsForPath('path1');
      
      expect(matches).toContain(binding1);
      expect(matches).not.toContain(binding2);
    });
    
    test('should find array item matches', () => {
      // Create bindings for array items
      const binding1 = bindingManager.createBinding({
        path: 'items[0].name',
        element: mockElement
      });
      const binding2 = bindingManager.createBinding({
        path: 'items[1].name',
        element: mockElement
      });
      
      // Test matching for entire array
      const arrayMatches = bindingManager.getBindingsForPath('items');
      expect(arrayMatches).toContain(binding1);
      expect(arrayMatches).toContain(binding2);
      
      // Test matching for specific array item
      // When checking items[0], the binding for items[0].name should match
      const itemMatches = bindingManager.getBindingsForPath('items[0].name');
      expect(itemMatches).toContain(binding1);
      expect(itemMatches).not.toContain(binding2);
    });
  });
});
