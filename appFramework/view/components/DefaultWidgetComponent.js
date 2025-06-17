import { BaseComponent } from './BaseComponent.js';
import { ModelPathUtils } from '../../utils/ModelPathUtils.js';
import { PropertyRenderUtils } from '../utils/PropertyRenderUtils.js';
import { ArrayTableComponent } from './ArrayTableComponent.js';

/**
 * Component for rendering a single property widget
 * This is the default widget type for handling individual properties in ModelPanel
 */
export class DefaultWidgetComponent extends BaseComponent {
    /**
     * Create a new DefaultWidgetComponent
     * @param {Object} view - The view instance
     * @param {Object} options - Configuration options
     * @param {Object} options.model - The data model
     * @param {Array} options.propertyConfigs - Array of property configurations (should be 1 item)
     * @param {string} [options.label] - Optional label for the widget (overrides property label)
     * @param {PropertyRenderUtils} [options.utils] - Optional PropertyRenderUtils instance
     */
    constructor(view, options) {
        super(view);
        
        this._model = options.model;
        this._propertyConfigs = options.propertyConfigs || [];
        this._label = options.label || '';
        this._utils = options.utils || new PropertyRenderUtils(view);
        this._childComponents = [];
        this._bindings = [];
        
        // Validate property configs - should have exactly one
        if (!Array.isArray(this._propertyConfigs) || this._propertyConfigs.length !== 1) {
            console.warn('DefaultWidgetComponent requires exactly 1 property configuration');
        }
        
        // Initialize the component
        this.element = this._createPropertyField();
    }
    
    /**
     * Create a single property field
     * @returns {HTMLElement} The field container element
     * @private
     */
    _createPropertyField() {
        // Get the property config
        const propConfig = this._propertyConfigs[0];
        if (!propConfig) {
            console.warn('No property configuration provided');
            return document.createElement('div'); // Return empty div
        }
        
        const propPath = propConfig.PropertyPath;
        if (!propPath) {
            console.warn('No property path provided');
            return document.createElement('div'); // Return empty div
        }
        
        // Check if this is an array property
        if (propConfig.PropertyType === 'Array') {
            return this._createArrayPropertyField(propPath, propConfig);
        }
        
        // Handle regular (non-array) property
        return this._createScalarPropertyField(propPath, propConfig);
    }
    
    /**
     * Create a field for a scalar (non-array) property
     * @param {string} propPath - The property path
     * @param {Object} propConfig - The property configuration
     * @returns {HTMLElement} The field container element
     * @private
     */
    _createScalarPropertyField(propPath, propConfig) {
        // Get property value from model
        const propValue = ModelPathUtils.getValueFromObjectPath(this._model, propPath);
        
        // Get property definition from utils
        const propDef = this._utils.getPropertyDefinition(this._model._className, propPath);
        
        // Get property type from utils
        const propType = this._utils.getPropertyType(propValue, propDef);
        
        // Check if property is editable
        const isEditable = this._utils.isPropertyEditable(propConfig, propDef);
        
        // Create field container
        const fieldContainer = document.createElement('div');
        fieldContainer.className = 'form-group';
        
        // Create label - use override label if provided, otherwise use the one from propConfig
        const label = document.createElement('label');
        label.textContent = this._label || propConfig.Label || this._utils.formatLabel(propPath.split('.').pop());
        fieldContainer.appendChild(label);
        
        // Create input using utils, passing property definition for ValidValues support
        const input = this._utils.createPropertyInput(propType, propValue, { isEditable, propDef });
        fieldContainer.appendChild(input);
        
        // Add binding using utils
        const pathParts = propPath.split('.');
        const property = pathParts.pop();
        const objectPath = pathParts.join('.');
        
        this._utils.createBinding({
            model: this._model,
            objectPath: objectPath,
            property: property,
            view: input,
            parser: propType === 'number' ? val => parseFloat(val) : val => val
        }, this);
        
        // Create dependent bindings if property config exists
        if (propConfig) {
            this._utils.createDependentBindings(this._model, objectPath, propConfig, input, this);
        }
        
        return fieldContainer;
    }
    
    /**
     * Create an array property field with table component
     * @param {string} propPath - The property path
     * @param {Object} propConfig - The property configuration
     * @returns {HTMLElement} The created array table container
     * @private
     */
    _createArrayPropertyField(propPath, propConfig) {
        console.log(`Creating array property field for ${propPath}`);
        
        // Create a simple container
        const fieldContainer = document.createElement('div');
        
        // Create array table component with title
        const arrayTable = new ArrayTableComponent(this._view, {
            propertyPath: propPath,
            columns: propConfig.Columns || [],
            model: this._model,
            title: propConfig.Label,
            className: propConfig.ClassName || '',
            utils: this._utils
        });
        
        // Add the table element to the container
        fieldContainer.appendChild(arrayTable.element);
        
        // Register the component for cleanup
        this._childComponents.push(arrayTable);
        
        return fieldContainer;
    }
    
    /**
     * Clean up resources when the component is destroyed
     */
    destroy() {
        // Clean up any child components
        if (this._childComponents) {
            this._childComponents.forEach(component => {
                if (component && typeof component.destroy === 'function') {
                    component.destroy();
                }
            });
            this._childComponents = [];
        }
        
        // Clean up bindings
        if (this._bindings && this._bindings.length > 0) {
            this._bindings.forEach(binding => {
                if (binding && typeof binding.destroy === 'function') {
                    binding.destroy();
                }
            });
            this._bindings = [];
        }
        
        // Call parent class destroy method
        super.destroy();
    }
}
