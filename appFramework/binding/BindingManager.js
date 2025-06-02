/**
 * BindingManager - Class to manage bindings between model properties and view elements
 */
import { Binding } from './Binding.js';
import { EventTypes } from '../controller/EventTypes.js';

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
    
    // Subscribe to property change events from both directions
    this.eventManager.addEventListener(EventTypes.MODEL_TO_VIEW_PROPERTY_CHANGED, this._handleModelPropertyChanged.bind(this));
    this.eventManager.addEventListener(EventTypes.VIEW_TO_MODEL_PROPERTY_CHANGED, this._handleModelPropertyChanged.bind(this));
    this.createBinding = this.createBinding.bind(this);
    this.removeBinding = this.removeBinding.bind(this);
    this.removeAllBindings = this.removeAllBindings.bind(this);
    this.refreshBindings = this.refreshBindings.bind(this);
  }
  
  /**
   * Create a new binding
   * @param {Object} options - Binding options
   * @param {Object} options.model - The model object to bind to
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
   * Refresh all bindings (update views from model)
   */
  refreshBindings() {
    this.bindings.forEach(binding => binding.refresh());
    console.log(`Refreshed ${this.bindings.length} bindings`);
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
    return this.bindings.filter(binding => binding.path === path);
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
   * Handle model property change events
   * @param {Object} eventData - The event data
   * @private
   */
  _handleModelPropertyChanged(eventData) {
    // Find bindings that match the changed path
    const matchingBindings = this.getBindingsForPath(eventData.path);
    
    // Update the view for each matching binding
    matchingBindings.forEach(binding => {
      // Only update if the source isn't the binding itself to avoid loops
      if (eventData.source !== 'binding') {
        binding.updateViewFromModel();
      }
    });
    
    if (matchingBindings.length > 0) {
      console.log(`Updated ${matchingBindings.length} bindings for path ${eventData.path}`);
    }
  }
}

// Export as named export for consistency
// Default export maintained for backward compatibility
export default BindingManager;
