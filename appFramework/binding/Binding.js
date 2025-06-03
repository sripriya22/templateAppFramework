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
   * Create a new binding
   * @param {Object} options - The binding options
   * @param {Object} options.model - The model object
   * @param {string} options.path - The property path in the model
   * @param {HTMLElement} options.element - The DOM element to bind to
   * @param {string} [options.attribute='value'] - The attribute to bind to
   * @param {Function} [options.parser=identity] - Function to parse value from string
   * @param {Function} [options.formatter=identity] - Function to format value to string
   * @param {Object} options.eventManager - The event manager instance
   * @param {Object} [options.events] - Custom event types
   */
  constructor(options) {
    if (!options || options.path === undefined || !options.element || !options.eventManager) {
      throw new Error('Missing required binding options');
    }
    
    this.path = options.path;
    this.element = options.element;
    this.attribute = options.attribute || 'value';
    this.parser = options.parser || (value => value);
    this.formatter = options.formatter || (value => value);
    this.eventManager = options.eventManager;
    
    // Flag to prevent infinite update loops
    // This is set to true when updating the view from a model change
    // and prevents view change events from triggering model updates
    this._isUpdatingFromModel = false;
    
    // Determine the appropriate events to listen for
    this.events = {
      view: options.events?.view || this._determineViewEvent(options),
      model: options.events?.model || [EventTypes.MODEL_TO_VIEW_PROPERTY_CHANGED]
    };
    
    // Ensure model events are always in array format
    if (!Array.isArray(this.events.model)) {
      this.events.model = [this.events.model];
    }
    
    // Initialize the binding
    this._setupBindings();
    
    console.log(`Binding created for ${this.path} with element ${this.element.tagName}#${this.element.id || 'no-id'}, listening for ${this.events.view} events`);
  }
  
  /**
   * Set up event listeners for view and model events
   * @private
   */
  _setupBindings() {
    console.log(`Setting up binding for ${this.path} with view event: ${this.events.view}`);
    console.log(`Element: ${this.element.tagName}, type: ${this.element.type || 'n/a'}, id: ${this.element.id || 'no-id'}`);
    
    // Bind the event handlers to this instance and store references for cleanup
    // This ensures 'this' refers to the Binding instance inside the handler
    this._boundHandleViewChange = this._handleViewChange.bind(this);
    
    // Listen for changes on the view element - simple approach with no removeEventListener
    try {
      // Add the event listener directly - no removeEventListener to avoid registration issues
      this.element.addEventListener(this.events.view, this._boundHandleViewChange);
      console.log(`Added view event listener for ${this.events.view} event`);
      
      // Store a reference to the binding on the element for debugging
      this.element.__binding = this;
    } catch (error) {
      console.error(`Error setting up view event listener for ${this.path}:`, error);
    }
  }
  
  /**
   * Handle changes from the view element
   * @param {Event} event - The DOM event
   * @private
   */
  _handleViewChange(event) {
    // If we're currently updating from a model change, don't propagate this view change
    // This prevents infinite update loops where model changes trigger view changes which trigger model changes
    if (this._isUpdatingFromModel) {
      console.log(`Ignoring view change event during model update for ${this.path}`);
      return;
    }
    
    console.log(`VIEW CHANGE EVENT: ${this.path}, event type: ${event.type}`);
    
    // Get the value from the element based on the attribute
    let value;
    if (this.attribute === 'value') {
      value = this.element.value;
    } else if (this.attribute === 'checked') {
      value = this.element.checked;
    } else {
      value = this.element[this.attribute] || this.element.getAttribute(this.attribute);
    }
    
    // Parse the value using the provided parser
    const parsedValue = this.parser(value);
    
    // Update the model by dispatching VIEW_TO_MODEL_PROPERTY_CHANGED event
    this._updateModelValue(parsedValue);
  }
  
  /**
   * Handle changes from the model
   * @param {Object} event - The model change event
   * @private
   */
  handleModelChange(event) {
    // Only update if the changed property matches our path
    if (event.path === this.path) {
      try {
        // Set the flag to prevent view change events from triggering model updates
        this._isUpdatingFromModel = true;
        
        // Update the view with the new model value from the event
        this._updateViewFromModel(event.value);
      } finally {
        // Always reset the flag, even if an error occurs
        this._isUpdatingFromModel = false;
      }
    }
  }
  
  /**
   * Update the view element with the current model value
   * @private
   */
  _updateViewFromModel(valueFromEvent) {
    // Get the current value - either from the event or from the model
    let value;
    
    if (valueFromEvent !== undefined) {
      // Use the value provided in the event
      value = valueFromEvent;
    } else {
      // Get the app from the eventManager
      const app = this.eventManager._owner;
      if (!app) {
        console.error('Cannot update view: No app available through eventManager');
        return;
      }
      
      // Get the model from the app
      const model = app.getModel();
      if (!model) {
        console.error('Cannot update view: No model available from app');
        return;
      }
      
      // Get the root instance from the model
      const rootInstance = model.getRootInstance();
      
      // Get the value from the path
      value = ModelPathUtils.getValueFromPath(rootInstance, this.path);
    }
    
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
   * Determine the appropriate view event based on element type and attribute
   * @param {Object} options - The binding options
   * @returns {string} The event name to use
   * @private
   */
  _determineViewEvent(options) {
    console.log('_determineViewEvent called for element:', options.element.tagName, options.element.type || 'n/a', 'attribute:', options.attribute || 'value');
    
    // If explicitly specified in options, use that
    if (options.events && options.events.view) {
      console.log('Using explicitly specified event:', options.events.view);
      return options.events.view;
    }
    
    const element = options.element;
    const attribute = options.attribute || 'value';
    
    // For checkboxes, use 'change' event instead of 'input'
    if (element.tagName === 'INPUT' && element.type === 'checkbox') {
      return 'change';
    }
    
    // For select elements, use 'change' event
    if (element.tagName === 'SELECT') {
      return 'change';
    }
    
    // For radio buttons, use 'change' event
    if (element.tagName === 'INPUT' && element.type === 'radio') {
      return 'change';
    }
    
    // Default to 'input' for most form elements
    return 'input';
  }
  
  /**
   * Request a model update with a new value
   * @param {*} value - The new value
   * @private
   */
  _updateModelValue(value) {
    // If we're currently updating from a model change, don't dispatch view-to-model events
    // This prevents infinite update loops
    if (this._isUpdatingFromModel) {
      console.log(`Skipping model update for path ${this.path} during view update`);
      return;
    }
    
    console.log(`Binding requesting model update for path ${this.path} with value:`, value);
    
    // Dispatch a view-to-model change event
    // The ClientModel will handle updating the model and dispatching MODEL_TO_VIEW_PROPERTY_CHANGED
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
   * Clean up the binding and remove event listeners
   */
  destroy() {
    console.log(`Destroying binding for ${this.path}`);
    
    try {
      // Remove view event listener
      if (this.element && this._boundHandleViewChange) {
        this.element.removeEventListener(this.events.view, this._boundHandleViewChange);
        console.log(`Removed view event listener for ${this.events.view}`);
      }
      
      // Remove binding reference from element
      if (this.element && this.element.__binding) {
        delete this.element.__binding;
        console.log(`Removed binding reference from element`);
      }
      
      // Remove model event listeners
      if (this.eventManager && this._boundHandleModelChange) {
        this.events.model.forEach(eventType => {
          this.eventManager.removeEventListener(eventType, this._boundHandleModelChange);
          console.log(`Removed model event listener for ${eventType}`);
        });
      }
      
      // Clear all references
      this._boundHandleViewChange = null;
      this._boundHandleModelChange = null;
      this.element = null;
      this.eventManager = null;
    } catch (error) {
      console.error('Error destroying binding:', error);
    }
  }
}

// Export as named export for consistency
export { Binding as default };
