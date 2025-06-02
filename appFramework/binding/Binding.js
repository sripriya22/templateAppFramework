/**
 * Binding - Class to manage two-way data binding between model properties and view elements
 */
import { ModelPathUtils } from '../utils/ModelPathUtils.js';
import { EventTypes } from '../controller/EventTypes.js';

/**
 * Binding class for managing two-way data binding between model properties and view elements
 */
export class Binding {
  /**
   * Create a new Binding instance
   * @param {Object} options - Binding options
   * @param {Object} options.model - The model object to bind to
   * @param {string} options.path - The path to the model property (e.g., 'user.name')
   * @param {HTMLElement} options.element - The DOM element to bind to
   * @param {string} [options.attribute='value'] - The element attribute to bind to (e.g., 'value', 'textContent')
   * @param {Function} [options.formatter] - Optional formatter function to transform model value for display
   * @param {Function} [options.parser] - Optional parser function to transform input value before updating model
   * @param {Object} options.eventManager - The event manager instance
   * @param {Object} [options.events] - Custom events configuration
   * @param {string} [options.events.view='input'] - Event to listen for on the view element
   * @param {string|Array<string>} [options.events.model=[EventTypes.MODEL_TO_VIEW_PROPERTY_CHANGED]] - Event(s) to listen for on the model
   */
  constructor(options) {
    // Required options
    this.model = options.model;
    this.path = options.path;
    this.element = options.element;
    this.eventManager = options.eventManager;
    
    // Optional options with defaults
    this.attribute = options.attribute || 'value';
    this.formatter = options.formatter || (value => value);
    this.parser = options.parser || (value => value);
    
    // Event configuration
    this.events = {
      // DOM events to listen for on the element (e.g., 'input', 'change')
      // When these DOM events occur, we'll dispatch a VIEW_TO_MODEL_PROPERTY_CHANGED event
      view: (options.events && options.events.view) || 'input',
      
      // Custom events to listen for from the model
      // These are typically MODEL_TO_VIEW_PROPERTY_CHANGED events
      model: (options.events && options.events.model) || [EventTypes.MODEL_TO_VIEW_PROPERTY_CHANGED]
    };
    
    // Convert model events to array if it's a string
    if (typeof this.events.model === 'string') {
      this.events.model = [this.events.model];
    }
    
    // Bind event handlers to this instance
    this._handleViewChange = this._handleViewChange.bind(this);
    this._handleModelChange = this._handleModelChange.bind(this);
    
    // Initialize the binding
    this._setupBindings();
    this._updateViewFromModel(); // Initial update
  }
  
  /**
   * Set up the event listeners for the binding
   * @private
   */
  _setupBindings() {
    // Listen for changes on the view element
    this.element.addEventListener(this.events.view, this._handleViewChange);
    
    // Listen for changes on the model
    if (Array.isArray(this.events.model)) {
      // Subscribe to multiple event types
      this.events.model.forEach(eventType => {
        this.eventManager.addEventListener(eventType, this._handleModelChange);
      });
    } else {
      // Backward compatibility for string event type
      this.eventManager.addEventListener(this.events.model, this._handleModelChange);
    }
  }
  
  /**
   * Handle changes from the view element
   * @param {Event} event - The DOM event
   * @private
   */
  _handleViewChange(event) {
    // Get the value from the element
    let value;
    
    if (this.attribute === 'value') {
      value = this.element.value;
    } else if (this.attribute === 'checked') {
      value = this.element.checked;
    } else {
      value = this.element[this.attribute] || this.element.getAttribute(this.attribute);
    }
    
    // Parse the value before updating the model
    const parsedValue = this.parser(value);
    
    // Update the model
    this._updateModelValue(parsedValue);
  }
  
  /**
   * Handle changes from the model
   * @param {Object} event - The model change event
   * @private
   */
  _handleModelChange(event) {
    // Only update if the changed property matches our path
    if (event.path === this.path) {
      this._updateViewFromModel();
    }
  }
  
  /**
   * Update the view element with the current model value
   * @private
   */
  _updateViewFromModel() {
    // Get the current value from the model
    const value = ModelPathUtils.getValueFromPath(this.model, this.path);
    
    // Format the value for display
    const formattedValue = this.formatter(value);
    
    // Update the element
    if (this.attribute === 'value') {
      this.element.value = formattedValue;
    } else if (this.attribute === 'checked') {
      this.element.checked = formattedValue;
    } else if (this.attribute === 'textContent') {
      this.element.textContent = formattedValue;
    } else if (this.attribute === 'innerHTML') {
      this.element.innerHTML = formattedValue;
    } else {
      // For other attributes, try both property and attribute setting
      try {
        this.element[this.attribute] = formattedValue;
      } catch (e) {
        this.element.setAttribute(this.attribute, formattedValue);
      }
    }
  }
  
  /**
   * Update the model with a new value
   * @param {*} value - The new value
   * @private
   */
  _updateModelValue(value) {
    // Use ModelPathUtils to set the value at the specified path
    ModelPathUtils.setValueAtPath(this.model, this.path, value);
    
    // Dispatch a view-to-model change event
    this.eventManager.dispatchEvent(EventTypes.VIEW_TO_MODEL_PROPERTY_CHANGED, {
      path: this.path,
      value: value,
      source: 'binding'
    });
  }
  
  /**
   * Refresh the binding (update view from model)
   */
  refresh() {
    this._updateViewFromModel();
  }
  
  /**
   * Update the view from the model (public method)
   */
  updateViewFromModel() {
    this._updateViewFromModel();
  }
  
  /**
   * Destroy the binding and remove event listeners
   */
  destroy() {
    // Remove view event listener
    this.element.removeEventListener(this.events.view, this._handleViewChange);
    
    // Remove model event listeners
    if (Array.isArray(this.events.model)) {
      // Unsubscribe from multiple event types
      this.events.model.forEach(eventType => {
        this.eventManager.removeEventListener(eventType, this._handleModelChange);
      });
    } else {
      // Backward compatibility for string event type
      this.eventManager.removeEventListener(this.events.model, this._handleModelChange);
    }
    
    // Clear references
    this.model = null;
    this.element = null;
    this.eventManager = null;
  }
  
  _addEventListeners() {
    // Add event listeners
  }
}

// Export as named export for consistency
// Default export maintained for backward compatibility
export default Binding;
