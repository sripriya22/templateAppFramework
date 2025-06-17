import { BaseComponent } from './BaseComponent.js';
import { ModelPathUtils } from '../../utils/ModelPathUtils.js';
import { PropertyRenderUtils } from '../utils/PropertyRenderUtils.js';

/**
 * Component for displaying a vector input with three properties (start, step, end)
 * separated by colons
 */
export class VectorInputComponent extends BaseComponent {
    /**
     * Create a new VectorInputComponent
     * @param {Object} view - The view instance
     * @param {Object} options - Configuration options
     * @param {Object} options.model - The data model
     * @param {Array} options.propertyConfigs - Array of property configurations (should be 3 items)
     * @param {string} [options.label] - Optional label for the entire widget
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
        
        // Validate property configs
        if (!Array.isArray(this._propertyConfigs) || this._propertyConfigs.length !== 3) {
            console.warn('VectorInputComponent requires exactly 3 property configurations');
        }
        
        // Initialize the component
        this.element = this._createVectorWidget();
    }
    
    /**
     * Create the vector widget UI with the three inputs and colons
     * @returns {HTMLElement} The widget container element
     * @private
     */
    _createVectorWidget() {
        // Create the main container
        const container = document.createElement('div');
        container.className = 'form-group vector-input-widget';
        
        // Add the main label if provided
        if (this._label) {
            const mainLabel = document.createElement('label');
            mainLabel.textContent = this._label;
            mainLabel.className = 'vector-widget-label';
            container.appendChild(mainLabel);
        }
        
        // Create the input group container
        const inputGroup = document.createElement('div');
        inputGroup.className = 'vector-input-group';
        container.appendChild(inputGroup);
        
        // Add each input with separators
        for (let i = 0; i < this._propertyConfigs.length; i++) {
            const propConfig = this._propertyConfigs[i];
            if (!propConfig) continue;
            
            // Create the input field
            const inputContainer = this._createInputElement(propConfig);
            inputGroup.appendChild(inputContainer);
            
            // Add separator after first and second inputs
            if (i < 2) {
                const separator = document.createElement('span');
                separator.textContent = ':';
                separator.className = 'vector-input-separator';
                inputGroup.appendChild(separator);
            }
        }
        
        // Add custom styles
        const style = document.createElement('style');
        style.textContent = `
            .vector-input-group {
                display: flex;
                align-items: center;
                gap: 8px;
            }
            
            .vector-input-field {
                flex: 1;
                position: relative;
            }
            
            .vector-input-field input {
                width: 100%;
            }
            
            .vector-input-field label {
                display: block;
                font-size: 0.8em;
                margin-bottom: 2px;
                color: #555;
            }
            
            .vector-input-separator {
                font-weight: bold;
                color: #333;
                margin: 0 4px;
                align-self: center;
            }
        `;
        
        container.appendChild(style);
        return container;
    }
    
    /**
     * Create an input element for a property
     * @param {Object} propConfig - The property configuration
     * @returns {HTMLElement} The input container element
     * @private
     */
    _createInputElement(propConfig) {
        const propPath = propConfig.PropertyPath;
        if (!propPath) {
            console.warn('No property path provided for vector input field');
            return document.createElement('div');
        }
        
        // Get property value from model
        const propValue = ModelPathUtils.getValueFromObjectPath(this._model, propPath);
        
        // Get property definition
        const propDef = this._utils.getPropertyDefinition(this._model._className, propPath);
        
        // Get property type
        const propType = this._utils.getPropertyType(propValue, propDef);
        
        // Check if property is editable
        const isEditable = this._utils.isPropertyEditable(propConfig, propDef);
        
        // Create field container
        const fieldContainer = document.createElement('div');
        fieldContainer.className = 'vector-input-field';
        
        // We're removing individual labels for each input box
        // This helps align the colons properly with the input boxes
        
        // Create input element with property definition for ValidValues support
        const input = this._utils.createPropertyInput(propType, propValue, { isEditable, propDef });
        fieldContainer.appendChild(input);
        
        // Add binding
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
        
        // Create dependent bindings if needed
        this._utils.createDependentBindings(this._model, objectPath, propConfig, input, this);
        
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
        
        // Call parent class destroy method
        super.destroy();
    }
}
