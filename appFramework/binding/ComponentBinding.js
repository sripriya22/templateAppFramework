/**
 * ComponentBinding - Special binding class for component-wide model updates
 */
import { Binding } from './Binding.js';
import { EventTypes } from '../controller/EventTypes.js';

/**
 * ComponentBinding class for handling component-wide model updates
 * This binding listens for any model property changes and calls a callback function
 * to update the entire component, rather than just a specific property
 */
export class ComponentBinding extends Binding {
  /**
   * Create a new ComponentBinding
   * @param {Object} options - The binding options
   * @param {Object} options.model - The model object
   * @param {string} options.path - The property path in the model (usually '')
   * @param {HTMLElement} options.view - The DOM element to bind to
   * @param {Function} options.updateCallback - Function to call when model changes
   * @param {Object} options.eventManager - The event manager instance
   * @param {Object} options.component - The component instance
   */
  constructor(options) {
    // Set default viewAttribute to a non-DOM property to avoid DOM updates
    const componentBindingOptions = {
      ...options,
      viewAttribute: 'data-model-binding',
      // We don't need view events since this is a one-way binding from model to view
      events: {
        view: null,
        model: [EventTypes.MODEL_TO_VIEW_PROPERTY_CHANGED]
      }
    };
    
    super(componentBindingOptions);
    
    // Store the update callback
    this.updateCallback = options.updateCallback;
    this.component = options.component;
    
    console.log(`ComponentBinding created for component ${this.component.constructor.name}`);
  }
  
  /**
   * Handle changes from the model
   * @param {Object} event - The model change event
   * @private
   */
  handleModelChange(event) {
    console.log(`ComponentBinding: Model property changed: ${event.path}`);
    
    // Call the update callback with the current model
    if (this.updateCallback && typeof this.updateCallback === 'function') {
      try {
        // Set the flag to prevent view change events from triggering model updates
        this._isUpdatingFromModel = true;
        
        // Get the current model from the app
        const app = this.component._view.getApp();
        const model = app.getModel();
        
        // Call the callback with the current model
        this.updateCallback(model, event.path);
      } catch (error) {
        console.error('Error in ComponentBinding update callback:', error);
      } finally {
        // Always reset the flag, even if an error occurs
        this._isUpdatingFromModel = false;
      }
    }
  }
  
  /**
   * Override the view update method to do nothing
   * We don't want to update any DOM properties directly
   * @private
   */
  _updateViewFromModel() {
    // Do nothing - we don't update the view directly
    // The updateCallback is responsible for updating the view
  }
}

// Export as named export for consistency
export default ComponentBinding;
