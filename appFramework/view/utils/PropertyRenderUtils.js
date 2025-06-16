/**
 * Utility class for property rendering and bindings
 * Centralizes functionality previously duplicated across PropertyGroupSection and ArrayPropertySection
 */
export class PropertyRenderUtils {
    /**
     * Create a new PropertyRenderUtils instance
     * @param {Object} view - The view instance
     */
    constructor(view) {
        this._view = view;
    }

    /**
     * Get property definition from model class
     * @param {string} className - The class name
     * @param {string} propPath - The property path
     * @returns {Object|null} The property definition or null if not found
     */
    getPropertyDefinition(className, propPath) {
        // Return null for missing inputs
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
            console.warn(`Error getting property info for ${className}.${propName}:`, error);
            return null;
        }
    }

    /**
     * Get property type from value and property definition
     * @param {*} value - The property value
     * @param {Object} propDef - The property definition
     * @returns {string} The property type
     */
    getPropertyType(value, propDef) {
        // First check property definition
        if (propDef && propDef.Type) {
            // Known types from property definition
            return propDef.Type;
        }
        
        // Fallback to JavaScript type detection
        if (value === null || value === undefined) {
            return 'string'; // Default to string for null/undefined
        }
        
        const jsType = typeof value;
        
        // Map JavaScript types to our internal types
        switch (jsType) {
            case 'boolean': return 'boolean';
            case 'number': return 'double';
            case 'string': return 'string';
            case 'object': 
                if (Array.isArray(value)) return 'array';
                return 'object';
            default: 
                return 'string'; // Default to string for unknown types
        }
    }

    /**
     * Determine if a property should be editable based on config and definition
     * @param {Object} propConfig - The property configuration
     * @param {Object} propDef - The property definition
     * @returns {boolean} Whether the property should be editable
     */
    isPropertyEditable(propConfig, propDef) {
        // Check if explicit editable property is defined
        if (propConfig && propConfig.Editable !== undefined) {
            // If it's a string reference like "${Use}", it'll be handled by dependent bindings
            if (typeof propConfig.Editable === 'string') {
                return true; // Default to editable, dependency will update it
            }
            return Boolean(propConfig.Editable);
        }
        
        // Check property definition readOnly flag
        if (propDef && propDef.ReadOnly === true) {
            return false;
        }
        
        // Default to editable
        return true;
    }

    /**
     * Create an input element for a property
     * @param {string} propType - The property type
     * @param {*} propValue - The property value
     * @param {Object} options - Additional options
     * @param {boolean} [options.isEditable=true] - Whether the input should be editable
     * @returns {HTMLElement} The created input element
     */
    createPropertyInput(propType, propValue, { isEditable = true } = {}) {
        let input;
        
        switch (propType.toLowerCase()) {
            case 'boolean':
                input = document.createElement('input');
                input.type = 'checkbox';
                input.checked = Boolean(propValue);
                break;
                
            case 'int':
            case 'double':
                input = document.createElement('input');
                input.type = 'number';
                input.step = propType === 'int' ? '1' : 'any';
                input.value = propValue !== null && propValue !== undefined ? propValue : '';
                break;
                
            case 'string':
            default:
                input = document.createElement('input');
                input.type = 'text';
                input.value = propValue !== null && propValue !== undefined ? propValue : '';
                break;
        }
        
        // Set common attributes
        input.disabled = !isEditable;
        
        // Set appropriate class based on editability
        if (!isEditable) {
            input.className = 'non-editable-field';
        }
        
        return input;
    }

    /**
     * Create a binding for a property input
     * @param {Object} options - Binding options
     * @param {Object} options.model - The model object
     * @param {string} options.objectPath - The object path in the model
     * @param {string} options.property - The property name
     * @param {HTMLElement} options.view - The DOM element to bind to
     * @param {string} [options.viewAttribute='value'] - The element attribute to bind to
     * @param {string} [options.viewEvent='input'] - The event to listen to
     * @param {Function} [options.parser] - Optional parser function for input values
     * @param {Object} component - The component to register the binding with
     * @returns {Object|null} The created binding or null if creation fails
     */
    createBinding({ model, objectPath, property, view, viewAttribute = 'value', viewEvent = 'input', parser }, component) {
        const app = this._view?.getApp();
        if (!app) {
            console.warn('App not available for binding creation');
            return null;
        }
        
        const bindingManager = app.getBindingManager();
        if (!bindingManager) {
            console.warn('BindingManager not available for binding creation');
            return null;
        }
        
        try {
            // Create binding options
            const bindingOptions = {
                model: model,
                objectPath: objectPath,
                property: property,
                view: view,
                viewAttribute: viewAttribute,
                viewEvent: viewEvent
            };
            
            // Add parser if provided
            if (parser && typeof parser === 'function') {
                bindingOptions.parser = parser;
            }
            
            // Create the binding through the binding manager
            const bindingManager = this._view?.getApp()?.getBindingManager();
            const binding = bindingManager.createBinding(bindingOptions);
            
            // Register the binding with the component
            if (binding && component && component._bindings) {
                component._bindings.push(binding);
            }
            
            return binding;
        } catch (error) {
            console.error('Error creating binding:', error);
            return null;
        }
    }

    /**
     * Parse a dependency expression from the config
     * @param {string|boolean} expression - The expression (e.g. "${Use}" or true/false)
     * @param {string} objectPath - The current object path for context
     * @returns {Object|null} Parsed dependency or null if not a dependency
     */
    parseDependencyExpression(expression, objectPath) {
        // Handle non-string expressions (e.g., boolean values)
        if (typeof expression !== 'string') {
            return null;
        }
        
        // Match the dependency pattern ${PropertyName}
        const dependencyMatch = expression.match(/^\${([\w.]+)}$/);
        if (!dependencyMatch) {
            return null;
        }
        
        const propName = dependencyMatch[1];
        
        // Handle relative vs. absolute paths
        let dependentObjectPath = objectPath;
        let dependentPropName = propName;
        
        // If property name contains dots, it might be a relative or absolute path
        if (propName.includes('.')) {
            const parts = propName.split('.');
            dependentPropName = parts.pop(); // Last part is the property
            
            // If first part starts with $, it's an absolute path, else relative path
            if (parts[0].startsWith('$')) {
                // Absolute path (e.g., ${$root.somePath.someProperty})
                // Remove the $ prefix from the first part
                parts[0] = parts[0].substring(1);
                dependentObjectPath = parts.join('.');
            } else {
                // Relative path (e.g., ${parentObj.someProperty})
                // If objectPath is empty, use the relative path as is
                if (!objectPath) {
                    dependentObjectPath = parts.join('.');
                } else {
                    // Combine current object path with relative path
                    const objectParts = objectPath.split('.');
                    objectParts.pop(); // Remove current property
                    dependentObjectPath = [...objectParts, ...parts].join('.');
                }
            }
        } else {
            // Simple property in same object (e.g., ${Use})
            // Leave dependentObjectPath as the current object path
            // dependentPropName is already set to propName
        }
        
        return {
            dependentObjectPath,
            propName: dependentPropName
        };
    }

    /**
     * Create editability binding if the Editable property is a reference
     * @param {Object} model - The model object
     * @param {string} objectPath - The path to the object
     * @param {Object} propConfig - The property configuration
     * @param {HTMLElement} element - The element to apply effects to
     * @param {Object} component - The component to register the binding with
     */
    createEditabilityBinding(model, objectPath, propConfig, element, component) {
        if (!propConfig || !propConfig.Editable || !objectPath || !element) {
            return;
        }
        
        // For array properties like Parameters[0].Min, use just the array part (Parameters[0])
        // This ensures that array item-level dependencies work correctly
        let targetObjectPath = objectPath;
        const lastDotIndex = objectPath.lastIndexOf('.');
        if (lastDotIndex > 0 && objectPath.includes('[') && objectPath.includes(']')) {
            // Extract just the array part with index, e.g., Parameters[0] from Parameters[0].Min
            targetObjectPath = objectPath.substring(0, lastDotIndex);
            console.log(`Adjusted objectPath for array property: ${objectPath} -> ${targetObjectPath}`);
        }
        
        // Parse the dependency expression
        const dependency = this.parseDependencyExpression(propConfig.Editable, targetObjectPath);
        if (!dependency) {
            return;
        }
        
        console.log(`Creating editability binding from ${dependency.dependentObjectPath}.${dependency.propName} to ${objectPath}`);
        
        // Get needed services
        const app = this._view?.getApp();
        if (!app) {
            console.warn('Cannot create editability binding: App not available');
            return;
        }
        
        const bindingManager = app.getBindingManager();
        if (!bindingManager) {
            console.warn('Cannot create editability binding: BindingManager not available');
            return;
        }
        
        try {
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
            if (binding && component && component._bindings) {
                component._bindings.push(binding);
            }
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
     * @param {Object} component - The component to register the binding with
     */
    createVisibilityBinding(model, objectPath, propConfig, element, component) {
        if (!propConfig || !propConfig.Visible || !objectPath || !element) {
            return;
        }
        
        // For array properties like Parameters[0].Min, use just the array part (Parameters[0])
        // This ensures that array item-level dependencies work correctly
        let targetObjectPath = objectPath;
        const lastDotIndex = objectPath.lastIndexOf('.');
        if (lastDotIndex > 0 && objectPath.includes('[') && objectPath.includes(']')) {
            // Extract just the array part with index, e.g., Parameters[0] from Parameters[0].Min
            targetObjectPath = objectPath.substring(0, lastDotIndex);
            console.log(`Adjusted objectPath for array property: ${objectPath} -> ${targetObjectPath}`);
        }
        
        // Parse the dependency expression
        const dependency = this.parseDependencyExpression(propConfig.Visible, targetObjectPath);
        if (!dependency) {
            return;
        }
        
        console.log(`Creating visibility binding from ${dependency.dependentObjectPath}.${dependency.propName} to ${objectPath}`);
        
        // Get needed services
        const app = this._view?.getApp();
        if (!app) {
            console.warn('Cannot create visibility binding: App not available');
            return;
        }
        
        const bindingManager = app.getBindingManager();
        if (!bindingManager) {
            console.warn('Cannot create visibility binding: BindingManager not available');
            return;
        }
        
        try {
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
            if (binding && component && component._bindings) {
                component._bindings.push(binding);
            }
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
     * @param {Object} component - The component to register the binding with
     */
    createDependentBindings(model, objectPath, propConfig, view, component) {
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
        this.createEditabilityBinding(model, objectPath, propConfig, view, component);
        
        // Process visibility dependency
        this.createVisibilityBinding(model, objectPath, propConfig, view, component);
        
        // Other dependent bindings can be added here
    }

    /**
     * Format a property key as a label
     * @param {string} key - The property key
     * @returns {string} - The formatted label
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
     * Force an update on all DependentBindings in a component
     * @param {Object} component - The component containing the bindings
     * @param {Object} model - The model data
     */
    updateDependentBindings(component, model) {
        console.log('Forcing update on component DependentBindings');
        
        if (!model) {
            console.warn('No model available to update dependent bindings');
            return;
        }
        
        // Find all bindings managed by this component
        const allBindings = component._bindings || [];
        
        // For each dependent binding, manually trigger the effect
        allBindings.forEach(binding => {
            if (binding.constructor.name === 'DependentBinding') {
                console.log(`Updating dependent binding for ${binding.objectPath}.${binding.property}`);
                
                // Get the current model value
                if (binding.getValueFromModel && typeof binding.getValueFromModel === 'function') {
                    const value = binding.getValueFromModel(model);
                    
                    // Apply the effect directly if _applyEffect exists
                    if (binding._applyEffect && typeof binding._applyEffect === 'function') {
                        binding._applyEffect(value);
                    }
                }
            }
        });
    }
}
