import { BaseComponent } from './BaseComponent.js';

/**
 * Abstract base class for ModelPanel section components
 * Provides common functionality for all section types including property handling
 */
export class ModelPanelSection extends BaseComponent {
    /**
     * Create a new ModelPanelSection instance
     * @param {Object} modelPanel - The parent ModelPanel instance
     * @param {Object} sectionConfig - The section configuration
     * @param {Object} model - The model data
     */
    constructor(modelPanel, sectionConfig, model) {
        super(modelPanel._view);
        this._modelPanel = modelPanel;
        this._sectionConfig = sectionConfig;
        this._model = model;
        
        // Initialize the component element by calling the createSection method
        this.element = this._createSection();
    }
    
    /**
     * Create a section element based on configuration
     * This is an abstract method that must be implemented by derived classes
     * @returns {HTMLElement} The created section element
     * @protected
     */
    _createSection() {
        throw new Error('_createSection must be implemented by derived classes');
    }
    
    /**
     * Create section container with standard styling
     * @param {string} className - Additional class name for the section
     * @returns {HTMLElement} The created section container
     * @protected
     */
    _createSectionContainer(className = '') {
        const container = document.createElement('div');
        container.className = `model-panel-section ${className}`;
        return container;
    }
    
    /**
     * Create section header with standard styling
     * @param {string} title - The header title
     * @returns {HTMLElement} The created header element
     * @protected
     */
    _createSectionHeader(title) {
        const header = document.createElement('h3');
        header.className = 'section-header';
        header.textContent = title;
        return header;
    }
    
    /**
     * Sort configuration items by order if available
     * @param {Array} items - The items to sort
     * @returns {Array} The sorted items
     * @protected
     */
    _sortByOrder(items) {
        if (!items || !Array.isArray(items)) return [];
        return [...items].sort((a, b) => (a.Order || 0) - (b.Order || 0));
    }

    /**
     * Get property definition from model class
     * @param {string} className - The class name
     * @param {string} propPath - The property path
     * @returns {Object|null} The property definition or null if not found
     * @protected
     */
    _getPropertyDefinition(className, propPath) {
        if (!this._modelPanel || !this._modelPanel._getPropertyDefinition) {
            return null;
        }
        return this._modelPanel._getPropertyDefinition(className, propPath);
    }

    /**
     * Get property type from value and property definition
     * @param {*} value - The property value
     * @param {Object} propDef - The property definition
     * @returns {string} The property type
     * @protected
     */
    _getPropertyType(value, propDef) {
        if (propDef && propDef.Type) {
            return propDef.Type.toLowerCase();
        }
        
        if (value === null || value === undefined) {
            return 'string';
        }
        
        const type = typeof value;
        return type === 'object' ? (Array.isArray(value) ? 'array' : 'object') : type;
    }

    /**
     * Determine if a property should be editable based on config and definition
     * @param {Object} propConfig - The property configuration
     * @param {Object} propDef - The property definition
     * @returns {boolean} Whether the property should be editable
     * @protected
     */
    _isPropertyEditable(propConfig, propDef) {
        // If Editable is explicitly set in config, use that
        if (propConfig && 'Editable' in propConfig) {
            return !!propConfig.Editable;
        }
        
        // Otherwise check if property is marked as ReadOnly in definition
        return !(propDef && propDef.ReadOnly === true);
    }

    /**
     * Create an input element for a property
     * @param {string} propType - The property type
     * @param {*} propValue - The property value
     * @param {Object} options - Additional options
     * @param {boolean} [options.isEditable=true] - Whether the input should be editable
     * @returns {HTMLElement} The created input element
     * @protected
     */
    _createPropertyInput(propType, propValue, { isEditable = true } = {}) {
        let input;
        
        switch (propType) {
            case 'boolean':
                input = document.createElement('input');
                input.type = 'checkbox';
                input.checked = Boolean(propValue);
                break;
                
            case 'number':
                input = document.createElement('input');
                input.type = 'number';
                input.value = propValue !== null && propValue !== undefined ? propValue : '';
                input.step = 'any';
                break;
                
            default:
                input = document.createElement('input');
                input.type = 'text';
                input.value = propValue !== null && propValue !== undefined ? String(propValue) : '';
                break;
        }
        
        input.className = `${propType}-input`;
        
        // Apply styles and attributes based on editability
        if (!isEditable) {
            input.disabled = true;
            input.classList.add('disabled', 'non-editable-field');
        }
        
        return input;
    }

    /**
     * Create a binding for a property input
     * @param {Object} options - Binding options
     * @param {Object} options.model - The model object
     * @param {string} options.objectPath - The object path in the model
     * @param {string} options.property - The property name
     * @param {HTMLElement} options.view - The view element to bind
     * @param {string} [options.viewAttribute] - The view attribute to bind (defaults based on type)
     * @param {string} [options.viewEvent] - The view event to listen to (defaults based on type)
     * @param {Function} [options.parser] - Optional parser function for input values
     * @protected
     */
    _createBinding({ model, objectPath, property, view, viewAttribute, viewEvent, parser }) {
        if (!this._modelPanel || !this._modelPanel.createBinding) {
            console.warn('Cannot create binding: ModelPanel or createBinding not available');
            return;
        }

        // Set defaults based on input type if not provided
        const inputType = view.type || 'text';
        const defaultViewAttribute = inputType === 'checkbox' ? 'checked' : 'value';
        const defaultViewEvent = inputType === 'checkbox' ? 'change' : 'change';
        
        this._modelPanel.createBinding({
            model,
            objectPath,
            property,
            view,
            viewAttribute: viewAttribute || defaultViewAttribute,
            viewEvent: viewEvent || defaultViewEvent,
            parser
        });
    }
    
    /**
     * Create dependent bindings for a property
     * @param {Object} model - The model object
     * @param {string} objectPath - The object path in the model
     * @param {Object} propConfig - The property configuration
     * @param {HTMLElement} view - The view element to bind
     * @protected
     */
    _createDependentBindings(model, objectPath, propConfig, view) {
        if (!this._modelPanel || !this._modelPanel._createDependentBindings) {
            console.warn('Cannot create dependent bindings: ModelPanel or _createDependentBindings not available');
            return;
        }
        
        this._modelPanel._createDependentBindings(model, objectPath, propConfig, view);
    }
}
