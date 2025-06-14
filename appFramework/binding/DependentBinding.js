import { Binding } from './Binding.js';
import { ModelPathUtils } from '../utils/ModelPathUtils.js';

/**
 * A binding that depends on another property's value to trigger side effects
 * Rather than synchronizing values, this binding applies effects to the view
 * when a specified property changes in the model.
 */
export class DependentBinding extends Binding {
    /**
     * Create a dependent binding
     * @param {Object} config - Configuration object containing:
     * @param {Object} config.model - The model object
     * @param {string} config.objectPath - Path to the object containing the property
     * @param {string} config.property - The property in the model to observe
     * @param {HTMLElement} config.view - The view element to apply the effect to
     * @param {Function} config.effect - Effect function to apply when property changes
     *                                   Signature: function(element, newValue)
     */
    constructor(config) {
        // Pass the whole config to super, with defaults for binding-specific properties
        super({
            ...config,
            // Set defaults for these properties only if not specified
            viewAttribute: config.viewAttribute || 'data-bound',
            viewEvent: config.viewEvent || null
        });

        this._effect = config.effect;
    }
    
    /**
     * Handle model property changed events
     * @param {Object} event - The model change event
     * @override
     */
    handleModelChange(event) {
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
            // Apply the effect using the new value from the event
            this._applyEffect(event.Value);
        }
    }
    
    /**
     * Apply the configured effect to the view element
     * @param {*} value - The new value from the model
     * @private
     */
    _applyEffect(value) {
        if (this._effect && this.view) {
            this._effect(this.view, value);
        }
    }
    
    /**
     * Override handle view change to do nothing
     * Dependent bindings are one-way (model to view effects only)
     * @override
     * @private
     */
    _handleViewChange() {
        // No-op - dependent bindings don't propagate view changes back to model
    }
    
    /**
     * Get the current value from the model
     * @param {Object} model - The model instance
     * @returns {*} The current value of the bound property
     */
    getValueFromModel(model) {
        // Get the full object from the objectPath
        let targetObject = model;
        if (this.objectPath && this.objectPath !== '') {
            targetObject = ModelPathUtils.getValueFromObjectPath(model, this.objectPath);
        }
        
        // If we found the target object, return the property value
        if (targetObject) {
            return targetObject[this.property];
        }
        
        return undefined;
    }
    
    /**
     * Create a binding that controls element editability based on a property value
     * @param {Object} config - Basic binding configuration
     * @param {Function} [predicate] - Optional function to transform the value into a boolean
     * @returns {DependentBinding} The created binding
     */
    static createEditableBinding(config, predicate = Boolean) {
        
        return new DependentBinding({
            // These must match the constructor parameter names exactly
            model: config.model,
            objectPath: config.objectPath,
            property: config.property,
            view: config.view,
            eventManager: config.eventManager,
            // Effect function specific to editability
            effect: (element, value) => {
                // Apply disabled state based on the property value
                const isEditable = predicate(value);
                element.disabled = !isEditable;
                
                // Some form controls need additional classes for styling
                if (isEditable) {
                    element.classList.remove('disabled');
                } else {
                    element.classList.add('disabled');
                }
            }
        });
    }
    
    /**
     * Create a binding that controls element visibility based on a property value
     * @param {Object} config - Basic binding configuration
     * @param {Function} [predicate] - Optional function to transform the value into a boolean
     * @returns {DependentBinding} The created binding
     */
    static createVisibilityBinding(config, predicate = Boolean) {
        if (!config.eventManager) {
            throw new Error('Missing required eventManager in DependentBinding.createVisibilityBinding');
        }
        
        return new DependentBinding({
            // These must match the constructor parameter names exactly
            model: config.model,
            objectPath: config.objectPath,
            property: config.property,
            view: config.view,
            eventManager: config.eventManager,
            // Effect function specific to visibility
            effect: (element, value) => {
                // Apply visibility based on the property value
                const isVisible = predicate(value);
                element.style.display = isVisible ? '' : 'none';
            }
        });
    }
}
