import { BaseComponent } from './BaseComponent.js';
import { ModelPathUtils } from '../../utils/ModelPathUtils.js';
import { DependentBinding } from '../../binding/DependentBinding.js';

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
        // Use section config's ModelClass if className isn't provided
        if (!className && this._sectionConfig && this._sectionConfig.ModelClass) {
            className = this._sectionConfig.ModelClass;
        }

        if (!className) {
            console.warn('No class name provided for property definition lookup');
            return null;
        }
        
        // Get model manager from app
        const app = this._view?.getApp();
        if (!app) {
            console.warn('App not available');
            return null;
        }
        
        const clientModel = app.getModel();
        if (!clientModel) {
            console.warn('ClientModel not available');
            return null;
        }
        
        const modelManager = clientModel.modelManager;
        if (!modelManager) {
            console.warn('ModelManager not available');
            return null;
        }
        
        // Handle nested properties
        const parts = propPath.split('.');
        const propName = parts[parts.length - 1];
        
        // Get property info from model manager
        try {
            return modelManager.getPropertyInfo(className, propName);
        } catch (error) {
            console.warn(`Error getting property info for ${className}.${propName}:`, error.message);
            return null;
        }
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
        const app = this._view?.getApp();
        if (!app) {
            console.warn('Cannot create binding: App not available');
            return null;
        }
        
        // Access bindingManager through app's method
        if (!app.getBindingManager) {
            console.warn('App getBindingManager method not available');
            return null;
        }
        
        const bindingManager = app.getBindingManager();
        if (!bindingManager) {
            console.warn('Cannot create binding: BindingManager not available');
            return null;
        }

        // Set defaults based on input type if not provided
        const inputType = view.type || 'text';
        const defaultViewAttribute = inputType === 'checkbox' ? 'checked' : 'value';
        const defaultViewEvent = inputType === 'checkbox' ? 'change' : 'change';
        
        return bindingManager.createBinding({
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
     * Parse a dependency expression from the config
     * @param {string|boolean} expression - The expression (e.g. "${Use}" or true/false)
     * @param {string} objectPath - The current object path for context
     * @returns {Object|null} Parsed dependency or null if not a dependency
     * @protected
     */
    _parseDependencyExpression(expression, objectPath) {
        // If it's a boolean or not a string, it's not a dependency expression
        if (typeof expression === 'boolean' || typeof expression !== 'string') {
            return null;
        }
        
        // Check if this is a property reference expression ${PropName}
        const match = expression.match(/^\$\{(.+)\}$/);        
        if (!match) {
            return null;
        }
        
        const propName = match[1];
        
        // Calculate the dependentObjectPath based on relative position in model hierarchy
        let dependentObjectPath;
        if (objectPath.includes('.')) {
            // Get the parent path (up to the last dot)
            dependentObjectPath = objectPath.substring(0, objectPath.lastIndexOf('.'));
        } else {
            // If no dots, use the current object path
            dependentObjectPath = objectPath;
        }
        
        return {
            propName,
            dependentObjectPath
        };
    }
    
    /**
     * Create editability binding if the Editable property is a reference
     * @param {Object} model - The model object
     * @param {string} objectPath - The path to the object
     * @param {Object} propConfig - The property configuration
     * @param {HTMLElement} element - The element to apply effects to
     * @protected
     */
    _createEditabilityBinding(model, objectPath, propConfig, element) {
        const app = this._view?.getApp();
        if (!app) {
            console.warn('Cannot create editability binding: App not available');
            return;
        }
        
        if (!app.getBindingManager) {
            console.warn('Cannot create editability binding: getBindingManager method not available');
            return;
        }
        
        // Check if Editable property is a dependency reference
        if (!propConfig || !('Editable' in propConfig)) {
            return; // No Editable property specified
        }
        
        // Parse the Editable property to see if it's a dependency expression
        const dependency = this._parseDependencyExpression(propConfig.Editable, objectPath);
        if (!dependency) {
            return; // Not a dependency expression
        }
        
        console.log('Creating editability binding:', dependency);
        
        // Create a dependent binding for editability
        try {
            const bindingManager = app.getBindingManager();
            if (!bindingManager) {
                console.warn('Cannot create editability binding: BindingManager not available');
                return;
            }
            
            const binding = bindingManager.createDependentBinding({
                type: 'editable',
                model: model,
                objectPath: dependency.dependentObjectPath,
                property: dependency.propName,
                view: element,
                effect: (value, el) => {
                    const isEditable = Boolean(value);
                    el.disabled = !isEditable;
                    el.classList.toggle('non-editable-field', !isEditable);
                    el.classList.toggle('disabled', !isEditable);
                }
            });
            
            // Store a reference to the binding
            this._bindings = this._bindings || [];
            this._bindings.push(binding);
        } catch (error) {
            console.error('Error creating editability binding:', error);
        }
    }
    
    /**
     * Create visibility binding if the Visible property is a reference
     * @param {Object} model - The model object
     * @param {string} objectPath - The path to the object
     * @param {Object} propConfig - The property configuration
     * @param {HTMLElement} element - The element to apply effects to
     * @protected
     */
    _createVisibilityBinding(model, objectPath, propConfig, element) {
        const app = this._view?.getApp();
        if (!app) {
            console.warn('Cannot create visibility binding: App not available');
            return;
        }
        
        if (!app.getBindingManager) {
            console.warn('Cannot create visibility binding: getBindingManager method not available');
            return;
        }
        
        // Check if Visible property is a dependency reference
        if (!propConfig || !('Visible' in propConfig)) {
            return; // No Visible property specified
        }
        
        // Parse the Visible property to see if it's a dependency expression
        const dependency = this._parseDependencyExpression(propConfig.Visible, objectPath);
        if (!dependency) {
            return; // Not a dependency expression
        }
        
        console.log('Creating visibility binding:', dependency);
        
        // Create a dependent binding for visibility
        try {
            const bindingManager = app.getBindingManager();
            if (!bindingManager) {
                console.warn('Cannot create visibility binding: BindingManager not available');
                return;
            }
            
            const binding = bindingManager.createDependentBinding({
                type: 'visibility',
                model: model,
                objectPath: dependency.dependentObjectPath,
                property: dependency.propName,
                view: element,
                effect: (value, el) => {
                    const isVisible = Boolean(value);
                    el.style.display = isVisible ? '' : 'none';
                }
            });
            
            // Store a reference to the binding
            this._bindings = this._bindings || [];
            this._bindings.push(binding);
        } catch (error) {
            console.error('Error creating visibility binding:', error);
        }
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
        const app = this._view?.getApp();
        if (!app) {
            console.warn('Cannot create dependent bindings: App not available');
            return;
        }
        
        if (!app.getModel) {
            console.warn('Cannot create dependent bindings: getModel method not available');
            return;
        }
        
        const clientModel = app.getModel();
        if (!clientModel) {
            console.warn('Cannot create dependent bindings: ClientModel not available');
            return;
        }
        
        // Debug the incoming property config
        console.log('Creating dependent bindings for', objectPath, propConfig);
        
        // Process editability dependency
        this._createEditabilityBinding(model, objectPath, propConfig, view);
        
        // Process visibility dependency
        this._createVisibilityBinding(model, objectPath, propConfig, view);
        
        // Other dependent bindings can be added here
    }
    
    /**
     * Format a property key as a label
     * @param {string} key - The property key
     * @returns {string} - The formatted label
     * @protected
     */
    formatLabel(key) {
        // Handle null/undefined or non-string inputs
        if (key === null || key === undefined) {
            return '';
        }
        
        // Convert to string in case it's a number or other type
        const str = String(key);
        
        // Return empty string for empty input
        if (!str) {
            return '';
        }
        
        try {
            // Convert camelCase to Title Case with spaces
            return str
                // Insert a space before all uppercase letters
                .replace(/([A-Z])/g, ' $1')
                // Replace underscores with spaces
                .replace(/_/g, ' ')
                // Capitalize the first letter
                .replace(/^./, s => s.toUpperCase())
                // Trim any leading/trailing spaces
                .trim()
                // Replace multiple spaces with a single space
                .replace(/\s+/g, ' ');
        } catch (error) {
            console.warn('Error formatting label:', error);
            return str; // Return original string if formatting fails
        }
    }
    
    /**
     * Force an update on all DependentBindings in this section
     * @protected
     */
    _updateDependentBindings() {
        console.log('Forcing update on section DependentBindings');
        
        // Get the model
        const model = this._model;
        if (!model) {
            console.warn('No model available in section to update dependent bindings');
            return;
        }
        
        // Find all bindings managed by this component
        const allBindings = this._bindings || [];
        
        // For each dependent binding, manually trigger the effect
        allBindings.forEach(binding => {
            if (binding instanceof DependentBinding) {
                console.log(`Updating dependent binding for ${binding.objectPath}.${binding.property}`);
                
                // Get the current model value
                const value = binding.getValueFromModel(model);
                
                // Apply the effect directly
                binding._applyEffect(value);
            }
        });
    }
}
