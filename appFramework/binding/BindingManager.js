/**
 * BindingManager - Class to manage bindings between model properties and view elements
 */
import { Binding } from './Binding.js';
import { ComponentBinding } from './ComponentBinding.js';
import { EventTypes } from '../controller/EventTypes.js';
import { ModelPathUtils } from '../utils/ModelPathUtils.js';

/**
 * BindingManager class for managing bindings between model properties and view elements
 */
export class BindingManager {
  /**
   * Create a new BindingManager instance
   * @param {Object} options - Manager options
   * @param {Object} options.app - The application instance
   */
  constructor(options) {
    this.app = options.app;
    this.eventManager = this.app.eventManager;
    this.bindings = [];
    
    // Subscribe to property change events with separate handlers for each direction
    this.eventManager.addEventListener(
      EventTypes.MODEL_TO_VIEW_PROPERTY_CHANGED, 
      this._handleModelToViewPropertyChanged.bind(this)
    );
    this.eventManager.addEventListener(
      EventTypes.VIEW_TO_MODEL_PROPERTY_CHANGED, 
      this._handleViewToModelPropertyChanged.bind(this)
    );
    this.createBinding = this.createBinding.bind(this);
    this.removeBinding = this.removeBinding.bind(this);
    this.removeAllBindings = this.removeAllBindings.bind(this);
  }
  
  /**
   * Create a new binding
   * @param {Object} options - Binding options
   * @param {string} options.path - The path to the model property
   * @param {HTMLElement} options.element - The DOM element to bind to
   * @param {string} [options.attribute='value'] - The element attribute to bind to
   * @param {Function} [options.formatter] - Optional formatter function
   * @param {Function} [options.parser] - Optional parser function
   * @param {Object} [options.events] - Custom events configuration
   * @returns {Binding} The created binding
   */
  createBinding(options) {
    // Add the event manager to the options
    const bindingOptions = {
      ...options,
      eventManager: this.eventManager
    };
    
    // Create the binding
    const binding = new Binding(bindingOptions);
    
    // Store the binding
    this.bindings.push(binding);
    
    // Log binding creation
    console.log(`Created binding for ${options.path} to element`, options.element);
    
    return binding;
  }
  
  /**
   * Create a component binding for component-wide model updates
   * @param {Object} options - Binding options
   * @param {Object} options.model - The model object to bind to
   * @param {string} options.path - The path to the model property (usually '')
   * @param {HTMLElement} options.element - The component's root element
   * @param {Function} options.updateCallback - Function to call when model changes
   * @param {Object} options.component - The component instance
   * @returns {ComponentBinding} The created component binding
   */
  createComponentBinding(options) {
    // Add the event manager to the options
    const bindingOptions = {
      ...options,
      eventManager: this.eventManager
    };
    
    // Create the component binding
    const binding = new ComponentBinding(bindingOptions);
    
    // Store the binding
    this.bindings.push(binding);
    
    // Log binding creation
    console.log(`Created component binding for ${options.component.constructor.name}`);
    
    return binding;
  }
  
  /**
   * Remove a specific binding
   * @param {Binding} binding - The binding to remove
   */
  removeBinding(binding) {
    const index = this.bindings.indexOf(binding);
    if (index !== -1) {
      // Destroy the binding
      binding.destroy();
      
      // Remove from the array
      this.bindings.splice(index, 1);
      
      console.log('Removed binding');
    }
  }
  
  /**
   * Remove all bindings for a specific element
   * @param {HTMLElement} element - The element to remove bindings for
   */
  removeBindingsForElement(element) {
    const bindingsToRemove = this.bindings.filter(binding => binding.element === element);
    
    bindingsToRemove.forEach(binding => {
      this.removeBinding(binding);
    });
    
    console.log(`Removed ${bindingsToRemove.length} bindings for element`);
  }
  
  /**
   * Remove all bindings for a specific model path
   * @param {string} path - The model path to remove bindings for
   */
  removeBindingsForPath(path) {
    const bindingsToRemove = this.bindings.filter(binding => binding.path === path);
    
    bindingsToRemove.forEach(binding => {
      this.removeBinding(binding);
    });
    
    console.log(`Removed ${bindingsToRemove.length} bindings for path ${path}`);
  }
  
  /**
   * Remove all bindings
   */
  removeAllBindings() {
    // Destroy all bindings
    this.bindings.forEach(binding => binding.destroy());
    
    // Clear the array
    const count = this.bindings.length;
    this.bindings = [];
    
    console.log(`Removed all ${count} bindings`);
  }
  
  /**
   * Get all bindings for a specific element
   * @param {HTMLElement} element - The element to get bindings for
   * @returns {Binding[]} Array of bindings for the element
   */
  getBindingsForElement(element) {
    return this.bindings.filter(binding => binding.element === element);
  }
  
  /**
   * Get all bindings for a specific model path
   * @param {string} path - The model path to get bindings for
   * @returns {Binding[]} Array of bindings for the path
   */
  getBindingsForPath(path) {
    return this.bindings.filter(binding => {
      // Match bindings with the exact path
      if (binding.path === path) {
        return true;
      }
      
      // Match component bindings with empty path (these should be notified of all changes)
      if (binding instanceof ComponentBinding && binding.path === '') {
        return true;
      }
      
      // Handle array paths - match array items when the array itself changes
      // For example, if path is 'items', match 'items[0].name', 'items[1].age', etc.
      if (path && binding.path && binding.path.startsWith(path + '[')) {
        return true;
      }
      
      // Handle array item changes - match specific array items
      // For example, if path is 'items[0].name', match that specific binding
      if (path && binding.path) {
        // Extract the array path and index from the changed path
        const arrayMatch = path.match(/^(.+?)\[(\d+)\](.*)$/);
        if (arrayMatch) {
          const [, arrayPath, index, remainder] = arrayMatch;
          // Check if the binding path matches this array path pattern
          const bindingArrayMatch = binding.path.match(/^(.+?)\[(\d+)\](.*)$/);
          if (bindingArrayMatch) {
            const [, bindingArrayPath, bindingIndex, bindingRemainder] = bindingArrayMatch;
            // If array paths match and indices match, and the remainder matches or is a prefix
            if (arrayPath === bindingArrayPath && index === bindingIndex && 
                (remainder === bindingRemainder || 
                 (remainder && bindingRemainder && bindingRemainder.startsWith(remainder)))) {
              return true;
            }
          }
        }
      }
      
      return false;
    });
  }
  
  /**
   * Destroy the binding manager and all bindings
   */
  destroy() {
    this.removeAllBindings();
    this.app = null;
    this.eventManager = null;
  }
  
  /**
   * Handle VIEW_TO_MODEL_PROPERTY_CHANGED events
   * @param {Object} eventData - The event data
   * @private
   */
  _handleViewToModelPropertyChanged(eventData) {
    // Get the path and value from the event
    const { path, value } = eventData;
    
    // Get the client model directly from the app
    const clientModel = this.app.getModel();
    
    if (clientModel) {
      // Get the root instance from the client model
      const rootInstance = clientModel.getRootInstance();
      
      // Update the model (could add validation here)
      ModelPathUtils.setValueAtPath(rootInstance, path, value);
      
      // Dispatch MODEL_TO_VIEW_PROPERTY_CHANGED to update all views
      this.eventManager.dispatchEvent(EventTypes.MODEL_TO_VIEW_PROPERTY_CHANGED, {
        path: path,
        value: value,
        source: 'binding_manager'
      });
      
      console.log(`Updated model for path ${path} and dispatched MODEL_TO_VIEW_PROPERTY_CHANGED`);
    } else {
      console.error('No client model available to update for path:', path);
    }
  }
  
  /**
   * Handle model-to-view property change events
   * @param {Object} eventData - The event data
   * @private
   */
  _handleModelToViewPropertyChanged(eventData) {
    // Find bindings that match the changed path
    const matchingBindings = this.getBindingsForPath(eventData.path);    
    
    // Update regular bindings
    if (matchingBindings.length > 0) {
      console.log(`Updating ${matchingBindings.length} regular bindings for path ${eventData.path}`);
      matchingBindings.forEach(binding => {
        binding.handleModelChange(eventData);
      });
    }
  }
}

// Export as named export for consistency
// Default export maintained for backward compatibility
export default BindingManager;
