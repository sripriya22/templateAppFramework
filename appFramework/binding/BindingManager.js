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
    
    // Subscribe only to MODEL_TO_VIEW_PROPERTY_CHANGED events
    // The ClientModel will now directly handle VIEW_TO_MODEL_PROPERTY_CHANGED events
    this.eventManager.addEventListener(
      EventTypes.MODEL_TO_VIEW_PROPERTY_CHANGED, 
      this._handleModelToViewPropertyChanged.bind(this)
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
    // Normalize the path by removing RootModel prefix if present
    const normalizedPath = this._normalizePathForBinding(path);
    
    return this.bindings.filter(binding => {
      // Normalize the binding path as well
      const normalizedBindingPath = this._normalizePathForBinding(binding.path);
      
      // Match bindings with the exact path (after normalization)
      if (normalizedBindingPath === normalizedPath) {
        return true;
      }
      
      // Match component bindings with empty path (these should be notified of all changes)
      if (binding instanceof ComponentBinding && binding.path === '') {
        return true;
      }
      
      // Handle array paths - match array items when the array itself changes
      // For example, if path is 'items', match 'items[0].name', 'items[1].age', etc.
      if (normalizedPath && normalizedBindingPath && normalizedBindingPath.startsWith(normalizedPath + '[')) {
        return true;
      }
      
      // Handle array item changes - match specific array items
      // For example, if path is 'items[0].name', match that specific binding
      if (normalizedPath && normalizedBindingPath) {
        // Extract the array path and index from the changed path
        const arrayMatch = normalizedPath.match(/^(.+?)\[(\d+)\](.*)$/);
        if (arrayMatch) {
          const [, arrayPath, index, remainder] = arrayMatch;
          // Check if the binding path matches this array path pattern
          const bindingArrayMatch = normalizedBindingPath.match(/^(.+?)\[(\d+)\](.*)$/);
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
   * Normalize a path for binding comparison by handling RootModel prefix
   * @param {string} path - The path to normalize
   * @returns {string} The normalized path
   * @private
   */
  _normalizePathForBinding(path) {
    if (!path) return path;
    
    // Remove RootModel prefix if present for binding comparison
    // This allows bindings registered without the RootModel prefix to still match
    if (path.startsWith('RootModel.')) {
      return path.substring('RootModel.'.length);
    }
    
    return path;
  }
  
  /**
   * Destroy the binding manager and all bindings
   */
  destroy() {
    this.removeAllBindings();
    this.app = null;
    this.eventManager = null;
  }
  
  // The _handleViewToModelPropertyChanged method has been removed
  // ClientModel now directly handles VIEW_TO_MODEL_PROPERTY_CHANGED events
  // This maintains clearer separation of concerns with ClientModel managing all model state
  
  /**
   * Handle model-to-view property change events
   * @param {Object} eventData - The event data
   * @private
   */
  _handleModelToViewPropertyChanged(eventData) {
    if (!eventData || !eventData.Path) {
      console.error('Invalid event data in _handleModelToViewPropertyChanged:', eventData);
      return;
    }
    
    // Extract path from eventData using PascalCase field name
    const path = eventData.Path;
    
    // Find bindings that match the changed path
    // TODO: we need to standardize the paths
    const normalizedPath = this._normalizePathForBinding(path);
    eventData.Path = normalizedPath;
    const matchingBindings = this.getBindingsForPath(normalizedPath);    
    
    // Update regular bindings
    if (matchingBindings.length > 0) {
      console.log(`Updating ${matchingBindings.length} bindings for path ${path}`);
      matchingBindings.forEach(binding => {
        binding.handleModelChange(eventData);
      });
    } else {
      console.debug(`No bindings found for path ${path}`);
    }
  }
}

// Export as named export for consistency
// Default export maintained for backward compatibility
export default BindingManager;
