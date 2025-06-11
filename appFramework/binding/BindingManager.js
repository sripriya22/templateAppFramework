/**
 * BindingManager - Class to manage all bindings in the application
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
   * @param {string} options.path - The path to the model property (must be in standardized format or parseable by ModelPathUtils)
   * @param {string} [options.objectPath] - The path to the object containing the property
   * @param {string} [options.property] - The name of the property
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
    
    // Create the binding - Binding constructor will standardize the path
    const binding = new Binding(bindingOptions);
    
    // Store the binding
    this.bindings.push(binding);
    
    // Log binding creation
    console.log(`Created binding for ${binding.path} to element`, options.element);
    
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
   * Note: getBindingsForPath has been deprecated and removed in favor of getBindingsForObjectPathProperty
   * Direct binding matching is now done using objectPath and property fields separately
   */
  
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
   * Get bindings that match a specific objectPath and property
   * @param {string} objectPath - The path to the object (without the property)
   * @param {string} property - The property name
   * @returns {Binding[]} Array of matching bindings
   */
  getBindingsForObjectPathProperty(objectPath, property) {
    // TODO: This is a bandaid fix. The proper solution is to ensure all binding
    // objectPaths are consistently created with the RootModel prefix throughout the codebase.
    // Technical debt: We should update all binding creation to use ModelPathUtils.createObjectPath
    // with consistent RootModel prefixing.
    
    // Strip RootModel prefix for consistency with bindings that don't use it
    let normalizedPath = objectPath;
    if (normalizedPath === 'RootModel') {
      // Handle case where we're working with the root model itself
      normalizedPath = '';
    } else if (normalizedPath.startsWith('RootModel.')) {
      normalizedPath = normalizedPath.substring(10); // Remove 'RootModel.'
    }
    
    return this.bindings.filter(binding => {
      // Direct match on objectPath and property
      if (binding.objectPath === normalizedPath && binding.property === property) {
        return true;
      }
      
      // Match component bindings with empty objectPath (these should be notified of all changes)
      if (binding instanceof ComponentBinding && binding.objectPath === '') {
        return true;
      }
      
      // Handle array paths - match array items when the array itself changes
      // For example, if objectPath is 'items', match 'items[0]' properties
      if (normalizedPath && binding.objectPath && binding.objectPath.startsWith(normalizedPath + '[')) {
        return true;
      }
      
      return false;
    });
  }
  
  /**
   * Handle model-to-view property change events
   * @param {Object} eventData - The event data
   * @private
   */
  _handleModelToViewPropertyChanged(eventData) {
    if (!eventData || !eventData.ObjectPath || !eventData.Property) {
      console.error('Invalid event data in _handleModelToViewPropertyChanged:', eventData);
      return;
    }
    
    // Find bindings that match the ObjectPath and Property directly
    const matchingBindings = this.getBindingsForObjectPathProperty(eventData.ObjectPath, eventData.Property);
    
    // Update matching bindings
    if (matchingBindings.length > 0) {
      console.log(`Updating ${matchingBindings.length} bindings for ${eventData.ObjectPath}.${eventData.Property}`);
      matchingBindings.forEach(binding => {
        binding.handleModelChange(eventData);
      });
    } else {
      console.debug(`No bindings found for ${eventData.ObjectPath}.${eventData.Property}`);
    }
  }
}

// Export as named export for consistency
// Default export maintained for backward compatibility
export default BindingManager;
