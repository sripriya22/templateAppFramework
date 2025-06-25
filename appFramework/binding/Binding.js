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
   * @param {HTMLElement} options.view - The DOM element to bind to (view element)
   * @param {string} [options.viewAttribute='value'] - The attribute to bind to
   * @param {Function} [options.parser=identity] - Function to parse value from string
   * @param {Function} [options.formatter=identity] - Function to format value to string
   * @param {Object} options.eventManager - The event manager instance
   * @param {Object} [options.events] - Custom event types
   */
  constructor(options) {
    // Validate required options
    if (!options || !options.view || !options.eventManager) {
      throw new Error('Missing required binding options');
    }
    
    this.view = options.view;
    
    // Require either (objectPath + property) or path
    const hasObjectPathAndProperty = options.objectPath !== undefined && options.property !== undefined;
    const hasPath = options.path !== undefined;
    
    if (!hasObjectPathAndProperty && !hasPath) {
      throw new Error('Binding must have either (objectPath + property) or path');
    }
    
    // If explicit objectPath and property are provided, use those directly
    if (hasObjectPathAndProperty) {
      this.objectPath = options.objectPath;
      this.property = options.property;
      console.debug(`Binding created with explicit objectPath: ${this.objectPath}, property: ${this.property}`);
    } else {
      // Otherwise parse the path to separate object path from property
      console.debug(`Parsing binding path: ${options.path}`);
      const { segments, indices } = ModelPathUtils.parseObjectPath(options.path);
      
      if (segments.length === 0) {
        throw new Error(`Invalid path: ${options.path} - no segments found`);
      }
      
      // The last segment is the property name
      this.property = segments[segments.length - 1];
      
      if (segments.length === 1) {
        // If there's only one segment, objectPath is empty
        this.objectPath = '';
      } else {
        // Build the object path from all segments except the last one
        const segmentsExceptLast = segments.slice(0, -1);
        const relevantIndices = [];
        
        // Find all indices that apply to the segments we're keeping
        for (const idx of indices) {
          if (idx.segmentIndex < segmentsExceptLast.length) {
            relevantIndices.push(idx);
          }
        }
        
        this.objectPath = ModelPathUtils.createObjectPath(segmentsExceptLast, relevantIndices);
      }
      
      console.debug(`Binding path parsed to objectPath: ${this.objectPath}, property: ${this.property}`);
    }
    
    this.viewAttribute = options.viewAttribute || 'value';
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
    
  }
  
  /**
   * Set up event listeners for view and model events
   * @private
   */
  _setupBindings() {
    // Bind the event handlers to this instance and store references for cleanup
    // This ensures 'this' refers to the Binding instance inside the handler
    this._boundHandleViewChange = this._handleViewChange.bind(this);
    
    // Listen for changes on the view element
    try {
      // For text and number inputs, ensure we're only listening for 'change' events (blur/enter)
      // This prevents validation from running on every keystroke
      if (this.view.tagName === 'INPUT' && 
          (this.view.type === 'text' || this.view.type === 'number')) {
        // Force 'change' event instead of whatever might be in this.events.view
        // This ensures validation only runs when the user completes their input
        console.debug(`Binding for ${this.objectPath}.${this.property}: Using 'change' event for text/number input`);
        this.view.addEventListener('change', this._boundHandleViewChange);
      } else {
        // For all other elements, use the configured event
        console.debug(`Binding for ${this.objectPath}.${this.property}: Using '${this.events.view}' event`);
        this.view.addEventListener(this.events.view, this._boundHandleViewChange);
      }
      
      // Store a reference to the binding on the element for debugging
      this.view.__binding = this;
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
      return;
    }
    
    // Get the value from the element based on the attribute
    let value;
    if (this.viewAttribute === 'value') {
      value = this.view.value;
    } else if (this.viewAttribute === 'checked') {
      value = this.view.checked;
    } else {
      value = this.view[this.viewAttribute] || this.view.getAttribute(this.viewAttribute);
    }
    
    // Parse the value using the provided parser
    const parsedValue = this.parser(value);
    
    // Update the model by dispatching VIEW_TO_MODEL_PROPERTY_CHANGED event
    this._updateModelValue(parsedValue);
  }
  
  /**
   * Handle model property changed events
   * @param {Object} event - The model change event
   * @private
   */
  handleModelChange(event) {
    // TODO: This is a bandaid fix. The proper solution is to ensure all binding
    // objectPaths are consistently created with the RootModel prefix throughout the codebase.
    
    // Normalize paths by removing RootModel prefix for comparison
    let eventPath = event.ObjectPath;
    let bindingPath = this.objectPath;
    
    // Strip RootModel prefix from event path if present
    if (eventPath) {
      if (eventPath === 'RootModel') {
        // Handle case where we're working with the root model itself
        eventPath = '';
      } else if (eventPath.startsWith('RootModel.')) {
        eventPath = eventPath.substring(10); // Remove 'RootModel.'
      }
    }
    
    // Strip RootModel prefix from binding path if present
    if (bindingPath) {
      if (bindingPath === 'RootModel') {
        // Handle case where we're working with the root model itself
        bindingPath = '';
      } else if (bindingPath.startsWith('RootModel.')) {
        bindingPath = bindingPath.substring(10); // Remove 'RootModel.'
      }
    }
    
    // Check if the changed property matches our binding using objectPath+property
    if (eventPath === bindingPath && event.Property === this.property) {
      try {
        // Set the flag to prevent view change events from triggering model updates
        this._isUpdatingFromModel = true;
        
        // Update the view with the new model value from the event
        this._updateViewFromModel(event.Value);
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
      value = valueFromEvent;
    } else {
      // Get the model from the event manager
      const model = this.eventManager.getModel();
      if (!model) {
        console.warn('No model available for binding update');
        return;
      }
      
      // Get the value from the model
      value = this.getValueFromModel(model);
    }
    
    // Format the value for display
    const formattedValue = this.formatter(value);
    
    // Update the element
    if (this.viewAttribute === 'value') {
      this.view.value = formattedValue;
    } else if (this.viewAttribute === 'checked') {
      this.view.checked = formattedValue;
    } else if (this.viewAttribute === 'textContent') {
      this.view.textContent = formattedValue;
    } else if (this.viewAttribute === 'innerHTML') {
      this.view.innerHTML = formattedValue;
    } else {
      // For other attributes, try both property and attribute setting
      try {
        this.view[this.viewAttribute] = formattedValue;
      } catch (e) {
        this.view.setAttribute(this.viewAttribute, formattedValue);
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
    // If explicitly specified in options, use that
    if (options.viewEvent) {
      return options.viewEvent;
    }
    
    // If specified in events object, use that
    if (options.events && options.events.view) {
      return options.events.view;
    }
    
    const view = options.view;
    
    // For checkboxes, use 'change' event instead of 'input'
    if (view.tagName === 'INPUT' && view.type === 'checkbox') {
      return 'change';
    }
    
    // For select elements, use 'change' event
    if (view.tagName === 'SELECT') {
      return 'change';
    }
    
    // For radio buttons, use 'change' event
    if (view.tagName === 'INPUT' && view.type === 'radio') {
      return 'change';
    }
    
    // For numeric fields and text inputs, use 'change' event to validate on blur or enter
    if (view.tagName === 'INPUT' && (view.type === 'number' || view.type === 'text')) {
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
      console.log(`Skipping model update for ${this.objectPath}.${this.property} during view update`);
      return;
    }
    
    console.log(`Binding requesting model update for ${this.objectPath}.${this.property} with value:`, value);
    
    // Dispatch a view-to-model change event using PascalCase property names as defined in EventTypes.js
    this.eventManager.dispatchEvent(EventTypes.VIEW_TO_MODEL_PROPERTY_CHANGED, {
      ObjectPath: this.objectPath,
      Property: this.property,
      Path: `${this.objectPath}.${this.property}`,
      Value: value,
      Source: 'binding',
      SourceView: this.view
    });
  }
  
  /**
   * Update the view from the model (public method)
   */
  updateViewFromModel() {
    this._updateViewFromModel();
  }
  
  /**
   * Handle validation errors from the model by showing error state and tooltip
   * Allow user to see invalid value for 2 seconds, then auto-revert
   * @param {Object} eventData - The validation error event data
   */
  handleValidationError(eventData) {
    // Apply validation error styling
    if (eventData.ValidationErrors && eventData.ValidationErrors.length > 0) {
      const errorMessage = eventData.ValidationErrors.join('\n');
      
      // Add visual styling
      this.view.classList.add('validation-error');
      
      // Wrap view in tooltip container if needed
      let container = this.view.parentElement;
      if (!container.classList.contains('validation-tooltip-container')) {
        // Create tooltip container
        container = document.createElement('div');
        container.classList.add('validation-tooltip-container');
        
        // Insert container in the DOM
        const parent = this.view.parentElement;
        parent.insertBefore(container, this.view);
        container.appendChild(this.view);
      }
      
      // Remove any existing tooltips
      const existingTooltip = container.querySelector('.validation-tooltip');
      if (existingTooltip) {
        container.removeChild(existingTooltip);
      }
      
      // Create and add tooltip
      const tooltip = document.createElement('div');
      tooltip.classList.add('validation-tooltip');
      tooltip.textContent = errorMessage;
      container.appendChild(tooltip);
      
      // Make tooltip visible (triggers CSS transition)
      setTimeout(() => {
        tooltip.classList.add('visible');
      }, 10);
      
      // Store the current valid value from the model for later use
      this._lastValidValue = eventData.CurrentValue;
      
      // Add temporary escape key handler for immediate revert if desired
      this._boundHandleEscapeKey = this._handleEscapeKey.bind(this);
      this.view.addEventListener('keydown', this._boundHandleEscapeKey);
      
      // Start a timer to automatically revert after 2 seconds
      this._validationRevertTimer = setTimeout(() => {
        console.log('Validation error timeout reached, reverting to last valid value');
        this._clearValidationErrorAndRevert();
      }, 2000); // 2000ms = 2 seconds
    }
  }
  
  /**
   * Shows validation error message below the input field
   * @param {HTMLElement} inputElement - The input element
   * @param {string} errorMessage - Error message to display
   * @private
   */
  _showValidationErrorMessage(inputElement, errorMessage) {
    // Check if there's already an error message element
    let errorElement = inputElement.nextElementSibling;
    if (!errorElement || !errorElement.classList.contains('validation-error-message')) {
      // Create a new error message element
      errorElement = document.createElement('div');
      errorElement.classList.add('validation-error-message');
      
      // Insert it after the input element
      if (inputElement.parentNode) {
        inputElement.parentNode.insertBefore(errorElement, inputElement.nextSibling);
      }
    }
    
    // Update the error message text
    errorElement.textContent = errorMessage;
  }
  
  /**
   * Handle Escape key press - revert to the last valid value
   * @param {KeyboardEvent} event - The keyboard event
   * @private
   */
  _handleEscapeKey(event) {
    if (event.key === 'Escape') {
      console.log('Escape pressed, reverting to last valid value');
      
      // Stop the event from propagating
      event.preventDefault();
      event.stopPropagation();
      
      this._clearValidationErrorAndRevert();
    }
  }
  
  /**
   * Handle blur event - revert to last valid value if still in error state
   * @private
   */
  _handleBlur() {
    if (this.view.classList.contains('validation-error')) {
      console.log('Blur event on field with validation error, reverting to last valid value');
      this._clearValidationErrorAndRevert();
    }
  }
  
  /**
   * Clear validation error styling and revert to the last valid value
   * @private
   */
  _clearValidationErrorAndRevert() {
    // Cancel any pending validation revert timer
    if (this._validationRevertTimer) {
      clearTimeout(this._validationRevertTimer);
      this._validationRevertTimer = null;
    }
    
    // Remove validation error styling
    this.view.classList.remove('validation-error');
    
    // Clean up tooltip container and tooltip
    const container = this.view.parentElement;
    if (container && container.classList.contains('validation-tooltip-container')) {
      // First remove the tooltip
      const tooltip = container.querySelector('.validation-tooltip');
      if (tooltip) {
        container.removeChild(tooltip);
      }
      
      // Then unwrap the view from the container
      if (container.parentElement) {
        const parent = container.parentElement;
        parent.insertBefore(this.view, container);
        parent.removeChild(container);
      }
    }
    
    // Remove temporary event listeners
    if (this._boundHandleEscapeKey) {
      this.view.removeEventListener('keydown', this._boundHandleEscapeKey);
      this._boundHandleEscapeKey = null;
    }
    
    if (this._boundHandleBlur) {
      this.view.removeEventListener('blur', this._boundHandleBlur);
      this._boundHandleBlur = null;
    }
    
    // Update the view with the last valid value (if available)
    if (this._lastValidValue !== undefined) {
      // Programmatically update UI without triggering validation
      if (this.viewAttribute === 'value') {
        this.view.value = this.formatter(this._lastValidValue);
      } else if (this.viewAttribute === 'checked') {
        this.view.checked = Boolean(this._lastValidValue);
      } else if (this.viewAttribute === 'innerHTML') {
        this.view.innerHTML = this._lastValidValue;
      } else {
        this.view[this.viewAttribute] = this._lastValidValue;
      }
    }
  }
  
  /**
   * Clean up the binding and remove event listeners
   */
  destroy() {
    console.log(`Destroying binding for ${this.objectPath}.${this.property}`);
    
    try {
      // Remove view event listener
      if (this.view && this._boundHandleViewChange) {
        this.view.removeEventListener(this.events.view, this._boundHandleViewChange);
        console.log(`Removed view event listener for ${this.events.view}`);
      }
      
      // Remove binding reference from element
      if (this.view && this.view.__binding) {
        delete this.view.__binding;
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
      this.view = null;
      this.eventManager = null;
    } catch (error) {
      console.error('Error destroying binding:', error);
    }
  }
}

// Export as named export for consistency
export { Binding as default };
