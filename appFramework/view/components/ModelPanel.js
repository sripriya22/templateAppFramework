import { BaseComponent } from './BaseComponent.js';
import { ModelPathUtils } from '../../utils/ModelPathUtils.js';
import { loadComponentConfig } from '../../utils/ConfigLoader.js';
import { EventTypes } from '../../controller/EventTypes.js';

// Load external CSS file
function loadStyles() {
  if (typeof document !== 'undefined') {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = '../../../appFramework/view/styles/ModelPanel.css';
    document.head.appendChild(link);
  }
}

// Load styles when the module is imported
loadStyles();

/**
 * ModelPanel component for displaying form fields for model properties
 */
export class ModelPanel extends BaseComponent {
    /**
     * Create a new ModelPanel instance
     * @param {Object} view - The parent view instance
     * @param {Object} [config=null] - Optional view configuration
     */
    constructor(view, config = null) {
        super(view);
        this._config = config; // Store view configuration
        this._configLoaded = false; // Flag to track if config has been loaded
        this.createModelPanel();
        
        // Store component reference on element for layout access
        this.element.__component = this;
        
        // Load configuration if not provided
        if (!this._config) {
            this._loadConfig();
        } else {
            this._configLoaded = true;
        }
    }
    
    /**
     * Load configuration from a file
     * @param {string} configPath - Path to the configuration file
     * @returns {Promise<Object>} The loaded configuration
     */
    async loadConfig(configPath) {
        try {
            const response = await fetch(configPath);
            if (!response.ok) {
                throw new Error(`Failed to load config: ${response.status} ${response.statusText}`);
            }
            this._config = await response.json();
            this._configLoaded = true;
            return this._config;
        } catch (error) {
            console.error('Error loading view configuration:', error);
            throw error;
        }
    }
    
    /**
     * Load configuration using the ConfigLoader
     * @private
     */
    async _loadConfig() {
        try {
            this._config = await loadComponentConfig('ModelPanel');
            this._configLoaded = true;
            
            // Configuration loaded, but we don't update the view automatically
            // The view will be updated on the next model update event
        } catch (error) {
            console.warn('Could not load ModelPanel configuration, using defaults');
        }
    }

    /**
     * Create the model panel DOM structure
     */
    createModelPanel() {
        // Create main container
        this.element = document.createElement('div');
        this.element.className = 'model-panel';

        // Create header
        const header = document.createElement('div');
        header.className = 'panel-header';
        header.textContent = 'Model Editor';

        // Create form container
        this.formElement = document.createElement('div');
        this.formElement.className = 'model-form';

        // Assemble the component
        this.element.appendChild(header);
        this.element.appendChild(this.formElement);
        
        // Initialize empty state
        this.updateModel(null);
    }

    /**
     * Update the model panel with new model data
     * @param {Object} model - The model data to display
     */
    updateModel(model) {
        console.log('ModelPanel.updateModel called with model:', model ? model._className : 'null');
        
        // Clear existing bindings before rebuilding the form
        this.removeBindings();
        console.log('Cleared existing bindings');
        
        // Clear existing content
        this.formElement.innerHTML = '';
        
        if (!model) {
            console.warn('ModelPanel.updateModel called with null model');
            return;
        }
        
        // If we have a configuration and it's loaded, use it
        if (this._config && this._configLoaded) {
            console.log('Building form from config');
            this._buildFormFromConfig(model);
        } else if (this._config && !this._configLoaded) {
            // If config is being loaded, show a loading message
            console.log('Config is loading, showing loading message');
            const loadingMessage = document.createElement('div');
            loadingMessage.className = 'loading-message';
            loadingMessage.textContent = 'Loading configuration...';
            this.formElement.appendChild(loadingMessage);
        } else {
            // Fall back to current behavior
            console.log('No config, building form directly');
            this.buildForm(model, this.formElement);
        }
        
        console.log(`ModelPanel.updateModel completed, created ${this._bindings.length} bindings`);
    }
    
    /**
     * Validate the configuration against the model definitions
     * @param {string} modelClass - The model class name
     * @private
     */
    _validateConfig(modelClass) {
        if (!this._config) {
            throw new Error('No configuration provided to ModelPanel');
        }
        
        if (!modelClass) {
            throw new Error('Model class name is required for validation');
        }
        
        const app = this._view.getApp();
        if (!app) {
            throw new Error('App not available');
        }
        
        const clientModel = app.getModel();
        if (!clientModel) {
            throw new Error('Client model not available');
        }
        
        const modelManager = clientModel.modelManager;
        if (!modelManager) {
            throw new Error('Model manager not available');
        }
        
        // Validate property groups
        if (this._config.PropertyGroups) {
            this._config.PropertyGroups.forEach(group => {
                if (!group.Properties || !Array.isArray(group.Properties)) {
                    throw new Error(`Property group '${group.GroupName}' has no properties array`);
                }
                
                group.Properties.forEach(prop => {
                    if (!prop.PropertyPath) {
                        throw new Error(`Property in group '${group.GroupName}' is missing PropertyPath`);
                    }
                    
                    // Check if property exists in model definition
                    const propInfo = this._getPropertyDefinition(modelClass, prop.PropertyPath);
                    if (!propInfo) {
                        throw new Error(`Property '${prop.PropertyPath}' not found in model class '${modelClass}'`);
                    }
                });
            });
        }
        
        // Validate array configs
        if (this._config.ArrayConfigs) {
            this._config.ArrayConfigs.forEach(arrayConfig => {
                if (!arrayConfig.PropertyPath) {
                    throw new Error('Array config is missing PropertyPath');
                }
                
                // Check if array property exists in model definition
                const arrayPropInfo = this._getPropertyDefinition(modelClass, arrayConfig.PropertyPath);
                if (!arrayPropInfo) {
                    throw new Error(`Array property '${arrayConfig.PropertyPath}' not found in model class '${modelClass}'`);
                }
                
                // Ensure it's actually an array
                if (!arrayPropInfo.IsArray) {
                    throw new Error(`Property '${arrayConfig.PropertyPath}' in model class '${modelClass}' is not an array`);
                }
                
                // Get the type of array elements
                const elementType = arrayPropInfo.Type;
                
                // Validate display properties against the element type
                if (arrayConfig.DisplayProperties && Array.isArray(arrayConfig.DisplayProperties)) {
                    arrayConfig.DisplayProperties.forEach(prop => {
                        if (!prop.PropertyPath) {
                            throw new Error(`Display property in array config '${arrayConfig.PropertyPath}' is missing PropertyPath`);
                        }
                        
                        // Check if property exists in element type definition
                        const propInfo = this._getPropertyDefinition(elementType, prop.PropertyPath);
                        if (!propInfo) {
                            throw new Error(`Property '${prop.PropertyPath}' not found in element type '${elementType}' for array '${arrayConfig.PropertyPath}'`);
                        }
                    });
                }
            });
        }
    }
    
    /**
     * Build form from configuration
     * @param {Object} model - The model data
     * @private
     */
    _buildFormFromConfig(model) {
        // Validate the configuration against the model definitions
        if (this._config.ModelClass) {
            try {
                this._validateConfig(this._config.ModelClass);
            } catch (error) {
                console.error('ModelPanel configuration validation failed:', error.message);
                throw error; // Re-throw to expose the implementation bug
            }
        }
        
        // Check if the model class matches the config
        if (this._config.ModelClass && model._className !== this._config.ModelClass) {
            console.warn(`Model class mismatch: expected ${this._config.ModelClass}, got ${model._className}`);
        }
        
        // Process property groups
        if (this._config.PropertyGroups) {
            // Sort groups by order if specified
            const sortedGroups = [...this._config.PropertyGroups].sort((a, b) => 
                (a.Order || 0) - (b.Order || 0)
            );
            
            sortedGroups.forEach(group => {
                this._createPropertyGroup(group, model);
            });
        }
        
        // Process array configs
        if (this._config.ArrayConfigs) {
            // Sort array configs by order if specified
            const sortedArrayConfigs = [...this._config.ArrayConfigs].sort((a, b) => 
                (a.Order || 0) - (b.Order || 0)
            );
            
            sortedArrayConfigs.forEach(arrayConfig => {
                this._createArraySection(arrayConfig, model);
            });
        }
    }
    
    /**
     * Create a property group from configuration
     * @param {Object} group - The group configuration
     * @param {Object} model - The model data
     * @private
     */
    _createPropertyGroup(group, model) {
        // Create fieldset for the group
        const fieldset = document.createElement('fieldset');
        fieldset.className = 'form-object';
        
        // Add legend
        const legend = document.createElement('legend');
        legend.textContent = group.GroupName;
        fieldset.appendChild(legend);
        
        // Process properties
        const sortedProperties = [...group.Properties].sort((a, b) => 
            (a.Order || 0) - (b.Order || 0)
        );
        
        sortedProperties.forEach(propConfig => {
            // Get property value from model
            const value = ModelPathUtils.getValueFromPath(model, propConfig.PropertyPath);
            
            // Get property definition from model class
            const propDef = this._getPropertyDefinition(model._className, propConfig.PropertyPath);
            
            // Create field based on configuration and property definition
            this._createConfiguredField(model, propConfig.PropertyPath, propConfig, fieldset);
        });
        
        // Add to form container
        this.formElement.appendChild(fieldset);
    }
    
    /**
     * Create a field based on configuration
     * @param {Object} model - The model object
     * @param {string} propPath - The property path
     * @param {Object} propConfig - The property configuration
     * @param {HTMLElement} container - The container to add the field to
     * @private
     */
    _createConfiguredField(model, propPath, propConfig, container) {
        // Get the property value using ModelPathUtils
        const value = ModelPathUtils.getValueFromPath(model, propPath);
        
        // Create a form group div
        const formGroup = document.createElement('div');
        formGroup.className = 'form-group';
        
        // Create a label
        const label = document.createElement('label');
        label.textContent = propConfig.label || this.formatLabel(propPath.split('.').pop());
        formGroup.appendChild(label);
        
        // Create an input field based on the property type, widget type, and editability
        let input;
        const widgetType = propConfig.widget || this._getDefaultWidgetType(value);
        const isEditable = propConfig.Editable !== false;
        
        // For non-editable fields (except checkboxes), create a span instead of an input
        if (!isEditable && widgetType !== 'checkbox') {
            input = document.createElement('span');
            input.className = 'non-editable-field';
            input.textContent = value !== undefined && value !== null ? value : '';
            
            // We still create a binding for non-editable fields to update the display
            this.createBinding({
                model: model,
                path: propPath,
                element: input,
                attribute: 'textContent'
            });
        } else {
            // For editable fields or checkboxes, create the appropriate input
            switch (widgetType) {
            case 'checkbox':
                input = document.createElement('input');
                input.type = 'checkbox';
                input.className = 'form-check-input';
                input.checked = Boolean(value);
                
                // Create binding for checkbox
                this.createBinding({
                    model: model,
                    path: propPath,
                    element: input,
                    attribute: 'checked',
                    parser: (val) => Boolean(val)
                });
                break;
                
            case 'number':
                input = document.createElement('input');
                input.type = 'number';
                input.className = 'form-control';
                input.value = value !== undefined && value !== null ? value : '';
                
                // Add min/max/step if specified
                if (propConfig.min !== undefined) input.min = propConfig.min;
                if (propConfig.max !== undefined) input.max = propConfig.max;
                if (propConfig.step !== undefined) input.step = propConfig.step;
                
                // Create binding for number input
                this.createBinding({
                    model: model,
                    path: propPath,
                    element: input,
                    parser: (val) => parseFloat(val)
                });
                break;
                
            case 'select':
                input = document.createElement('select');
                input.className = 'form-control';
                
                // Add options
                if (propConfig.options) {
                    propConfig.options.forEach(option => {
                        const optionEl = document.createElement('option');
                        optionEl.value = option.value;
                        optionEl.textContent = option.label || option.value;
                        if (option.value === value) {
                            optionEl.selected = true;
                        }
                        input.appendChild(optionEl);
                    });
                }
                
                // Create binding for select
                this.createBinding({
                    model: model,
                    path: propPath,
                    element: input
                });
                break;
                
            case 'textarea':
                input = document.createElement('textarea');
                input.className = 'form-control';
                input.value = value !== undefined && value !== null ? value : '';
                
                // Add rows if specified
                if (propConfig.rows) input.rows = propConfig.rows;
                
                // Create binding for textarea
                this.createBinding({
                    model: model,
                    path: propPath,
                    element: input
                });
                break;
                
            case 'text':
            default:
                input = document.createElement('input');
                input.type = 'text';
                input.className = 'form-control';
                input.value = value !== undefined && value !== null ? value : '';
                
                // Create binding for text input
                this.createBinding({
                    model: model,
                    path: propPath,
                    element: input
                });
                break;
            }
        }
        
        // Add placeholder if specified
        if (propConfig.placeholder && input.placeholder !== undefined) {
            input.placeholder = propConfig.placeholder;
        }
        
        // Add readonly if specified
        if (propConfig.readonly) {
            input.readOnly = true;
        }
        
        // Add the input to the form group
        formGroup.appendChild(input);
        
        // Add help text if specified
        if (propConfig.help) {
            const helpText = document.createElement('small');
            helpText.className = 'form-text text-muted';
            helpText.textContent = propConfig.help;
            formGroup.appendChild(helpText);
        }
        
        // Add the form group to the container
        container.appendChild(formGroup);
    }
    
    /**
     * Create a widget based on metadata
     * @param {Object} propConfig - The property configuration
     * @param {*} value - The property value
     * @param {Object} propDef - The property definition
     * @returns {HTMLElement} The created widget
     * @private
     */
    _createWidgetFromMetadata(propConfig, value, propDef) {
        // Default to text input if no property definition
        if (!propDef) {
            const widget = document.createElement('input');
            widget.type = 'text';
            widget.value = value !== undefined && value !== null ? String(value) : '';
            return widget;
        }
        
        // Create widget based on property type and configuration
        let widget;
        
        // Check if widget type is explicitly specified in config
        if (propConfig.WidgetType) {
            widget = this._createWidgetByType(propConfig.WidgetType, value, propDef, propConfig);
        } else {
            // Infer widget type from property definition
            if (propDef.IsPrimitive) {
                switch (propDef.Type.toLowerCase()) {
                    case 'boolean':
                        widget = this._createWidgetByType('checkbox', value, propDef, propConfig);
                        break;
                        
                    case 'number':
                        widget = this._createWidgetByType('number', value, propDef, propConfig);
                        break;
                        
                    case 'string':
                        // Check if it has enum values for dropdown
                        if (propDef.Enum && propDef.Enum.length > 0) {
                            widget = this._createWidgetByType('dropdown', value, propDef, propConfig);
                        } else {
                            widget = this._createWidgetByType('text', value, propDef, propConfig);
                        }
                        break;
                        
                    default:
                        widget = this._createWidgetByType('text', value, propDef, propConfig);
                }
            } else {
                // For non-primitive types, create a read-only field
                widget = document.createElement('input');
                widget.type = 'text';
                widget.value = '[Object]';
                widget.readOnly = true;
            }
        }
        
        return widget;
    }
    
    /**
     * Create a widget by type
     * @param {string} widgetType - The widget type
     * @param {*} value - The property value
     * @param {Object} propDef - The property definition
     * @param {Object} propConfig - The property configuration
     * @returns {HTMLElement} The created widget
     * @private
     */
    _createWidgetByType(widgetType, value, propDef, propConfig) {
        let widget;
        
        switch (widgetType) {
            case 'text':
                widget = document.createElement('input');
                widget.type = 'text';
                widget.value = value !== undefined && value !== null ? String(value) : '';
                break;
                
            case 'number':
                widget = document.createElement('input');
                widget.type = 'number';
                widget.value = value !== undefined && value !== null ? String(value) : '';
                if (propDef.Min !== undefined) widget.min = propDef.Min;
                if (propDef.Max !== undefined) widget.max = propDef.Max;
                break;
                
            case 'checkbox':
                widget = document.createElement('input');
                widget.type = 'checkbox';
                widget.checked = Boolean(value);
                break;
                
            case 'dropdown':
                widget = document.createElement('select');
                
                // Add options
                const options = propConfig.Options || propDef.Enum || [];
                options.forEach(option => {
                    const optionElement = document.createElement('option');
                    optionElement.value = option;
                    optionElement.textContent = option;
                    widget.appendChild(optionElement);
                });
                
                widget.value = value !== undefined && value !== null ? String(value) : '';
                break;
                
            case 'textarea':
                widget = document.createElement('textarea');
                widget.value = value !== undefined && value !== null ? String(value) : '';
                break;
                
            default:
                // Default to text input
                widget = document.createElement('input');
                widget.type = 'text';
                widget.value = value !== undefined && value !== null ? String(value) : '';
        }
        
        return widget;
    }
    
    /**
     * Create an array section from configuration
     * @param {Object} arrayConfig - The array configuration
     * @param {Object} model - The model data
     * @private
     */
    _createArraySection(arrayConfig, model) {
        // Get array from model
        const array = ModelPathUtils.getValueFromPath(model, arrayConfig.PropertyPath);
        
        if (!array || !Array.isArray(array)) {
            console.warn(`Property ${arrayConfig.PropertyPath} is not an array or doesn't exist`);
            return;
        }
        
        // Create container
        const container = document.createElement('div');
        container.className = 'array-container';
        
        // Add header
        const header = document.createElement('div');
        header.className = 'array-header';
        header.textContent = arrayConfig.Label || this.formatLabel(arrayConfig.PropertyPath);
        container.appendChild(header);
        
        // Create table wrapper with horizontal scrolling
        const tableWrapper = document.createElement('div');
        tableWrapper.className = 'array-table-wrapper';
        tableWrapper.style.overflowX = 'auto'; // Add horizontal scrolling
        container.appendChild(tableWrapper);
        
        // Create table
        const table = document.createElement('table');
        table.className = 'array-table';
        
        // Create header row
        const thead = document.createElement('thead');
        const headerRow = document.createElement('tr');
        
        // Add header cells for display properties
        const displayProps = arrayConfig.DisplayProperties || [];
        displayProps.sort((a, b) => (a.Order || 0) - (b.Order || 0));
        
        displayProps.forEach(propConfig => {
            const th = document.createElement('th');
            th.textContent = propConfig.Label || this.formatLabel(propConfig.PropertyPath);
            headerRow.appendChild(th);
        });
        
        thead.appendChild(headerRow);
        table.appendChild(thead);
        
        // Create body
        const tbody = document.createElement('tbody');
        
        // Add rows for each item
        array.forEach((item, index) => {
            const row = document.createElement('tr');
            
            // Add cells for display properties
            displayProps.forEach(propConfig => {
                const cell = document.createElement('td');
                
                // Get property name from path
                const propName = propConfig.PropertyPath;
                const value = item[propName];
                
                // Get property definition
                const propDef = this._getPropertyDefinition(item._className, propName);
                
                // Create appropriate widget
                const widget = this._createWidgetFromMetadata(propConfig, value, propDef);
                
                // Set common attributes
                widget.className = 'form-control';
                widget.disabled = propConfig.Editable === false;
                
                cell.appendChild(widget);
                row.appendChild(cell);
                
                // Create binding for this widget if it's not disabled
                if (propConfig.Editable !== false) {
                    const app = this._view.getApp();
                    if (app) {
                        const model = app.getModel();
                        if (model) {
                            // Create path to this array item property
                            const itemPath = `${arrayConfig.PropertyPath}[${index}].${propName}`;
                            console.log(`Creating binding for array item: ${itemPath}`);
                            
                            // Determine the appropriate attribute based on widget type
                            let attribute = 'value';
                            if (widget.type === 'checkbox') {
                                attribute = 'checked';
                            }
                            
                            // Create binding for this widget with appropriate event handling
                            let parser, formatter, viewEvent;
                            
                            if (widget.type === 'checkbox') {
                                parser = val => Boolean(val);
                                formatter = val => Boolean(val);
                            } else if (widget.type === 'number' || typeof value === 'number') {
                                parser = val => {
                                    if (val === '') return 0;
                                    const num = parseFloat(val);
                                    return isNaN(num) ? 0 : num;
                                };
                                formatter = val => (val === undefined || val === null) ? '' : val.toString();
                                formatter = val => {
                                    if (val === undefined || val === null) return '';
                                    return val.toString();
                                };
                                
                                // For numeric inputs, use 'change' event instead of 'input'
                                // This ensures we only update the model when the user completes their edit
                                // and not on every keystroke
                                viewEvent = 'change';
                            } else {
                                // Default identity functions for other types
                                parser = val => val;
                                formatter = val => val !== undefined && val !== null ? val.toString() : '';
                            }
                            
                            this.createBinding({
                                model: model,
                                path: itemPath,
                                element: widget,
                                attribute: attribute,
                                parser: parser,
                                formatter: formatter,
                                events: viewEvent ? { view: viewEvent } : undefined
                            });
                        }
                    }
                }
            });
            
            tbody.appendChild(row);
        });
        
        table.appendChild(tbody);
        tableWrapper.appendChild(table);
        
        // Add to form container
        this.formElement.appendChild(container);
    }
    
    /**
     * Get property definition from class
     * @param {string} className - The class name
     * @param {string} propPath - The property path
     * @returns {Object|null} The property definition or null if not found
     * @private
     */
    _getPropertyDefinition(className, propPath) {
        if (!className) {
            throw new Error('Class name is required');
        }
        
        // Get model manager through proper method calls
        // ModelPanel -> View -> App -> ClientModel -> ModelManager
        if (!this._view) {
            throw new Error('View not available');
        }
        
        const app = this._view.getApp();
        if (!app) {
            throw new Error('App not available');
        }
        
        const clientModel = app.getModel();
        if (!clientModel) {
            throw new Error('ClientModel not available');
        }
        
        // Use the getter method to access the model manager
        const modelManager = clientModel.modelManager;
        if (!modelManager) {
            throw new Error('ModelManager not available');
        }
        
        // Handle nested properties
        const parts = propPath.split('.');
        const propName = parts[parts.length - 1];
        
        // Get property info from model manager
        return modelManager.getPropertyInfo(className, propName);
    }
    
    /**
     * Get the type of a value
     * @param {*} value - The value to check
     * @returns {string} The type of the value
     */
    getType(value) {
        if (value === null) return 'null';
        if (Array.isArray(value)) return 'array';
        return typeof value;
    }
    
    /**
     * Get the default widget type based on the property value type
     * @param {*} value - The property value
     * @returns {string} The default widget type
     * @private
     */
    _getDefaultWidgetType(value) {
        const type = this.getType(value);
        
        switch (type) {
            case 'boolean':
                return 'checkbox';
            case 'number':
                return 'number';
            case 'array':
                return 'array';
            case 'object':
                return 'object';
            case 'null':
                return 'text';
            default:
                return 'text';
        }
    }
    
    /**
     * Format a label from a key
     * @param {string} key - The key to format
     * @returns {string} The formatted label
     */
    formatLabel(key) {
        // Convert camelCase to Title Case
        return key
            .replace(/([A-Z])/g, ' $1')
            .replace(/^./, str => str.toUpperCase())
            .trim();
    }

    /**
     * Build a form from a model object
     * @param {Object} model - The model object to build a form for
     * @param {HTMLElement} container - The container to append the form to
     * @param {string} [parentPath=''] - The parent property path
     */
    buildForm(model, container, parentPath = '') {
        // Process each property in the model, filtering out private properties and functions
        Object.entries(model)
            .filter(([key, value]) => {
                // Skip private properties (those starting with _) and functions
                return !key.startsWith('_') && typeof value !== 'function';
            })
            .forEach(([key, value]) => {
                const type = this.getType(value);
                // Construct the full property path for this property
                const propertyPath = parentPath ? `${parentPath}.${key}` : key;

                if (type === 'object' && !Array.isArray(value)) {
                    // Create a fieldset for nested objects
                    this.createObjectField(key, value, container, propertyPath);
                } else if (type === 'array') {
                    // Create a table for arrays
                    this.createArrayField(key, value, container, propertyPath);
                } else {
                    // Create a form field for primitive values
                    this.createField(key, value, type, container, propertyPath);
                }
            });
        
        // If no fields were added, show a message
        if (container.children.length === 0) {
            const emptyMessage = document.createElement('div');
            emptyMessage.className = 'empty-message';
            emptyMessage.textContent = 'No properties to display';
            container.appendChild(emptyMessage);
        }
    }

    /**
     * Create a form field for a primitive value
     * @param {string} key - The property key
     * @param {*} value - The property value
     * @param {string} type - The value type
     * @param {HTMLElement} container - The container to append the field to
     * @param {string} [propertyPath=''] - The full property path in the model
     */
    createField(key, value, type, container, propertyPath = '') {
        const formGroup = document.createElement('div');
        formGroup.className = 'form-group';

        // Create label
        const label = document.createElement('label');
        label.textContent = this.formatLabel(key);
        const fieldId = `field-${key}-${Math.random().toString(36).substr(2, 9)}`;
        label.htmlFor = fieldId;

        // Create input based on type
        let input;

        switch (type) {
            case 'boolean':
                input = document.createElement('input');
                input.type = 'checkbox';
                input.checked = value;
                break;
            case 'number':
                input = document.createElement('input');
                input.type = 'number';
                input.value = value;
                break;
            case 'string':
                if (value.length > 100) {
                    input = document.createElement('textarea');
                    input.rows = 3;
                } else {
                    input = document.createElement('input');
                    input.type = 'text';
                }
                input.value = value;
                break;
            default:
                input = document.createElement('input');
                input.type = 'text';
                input.value = String(value);
                break;
        }

        // Set common attributes
        input.id = fieldId;
        input.name = key;
        input.className = 'form-control';
        // Make all fields editable
        input.disabled = false;

        // Handle value display
        if (value === null || value === undefined) {
            input.value = '';
            input.placeholder = 'null';
        } else if (type === 'boolean') {
            input.checked = Boolean(value);
        } else {
            input.value = String(value);
        }

        // Assemble form group
        formGroup.appendChild(label);
        formGroup.appendChild(input);
        
        // Add to container
        container.appendChild(formGroup);
        
        // Create binding for this field if we have a property path
        if (propertyPath) {
            // Get the app and model through the view
            const app = this._view.getApp();
            if (app) {
                const model = app.getModel();
                if (model) {
                    console.log(`Creating binding for field: ${propertyPath}`);
                    
                    // Create binding for this input
                    this.createBinding({
                        model: model,
                        path: propertyPath,
                        element: input,
                        attribute: type === 'boolean' ? 'checked' : 'value',
                        events: {
                            view: type === 'boolean' ? 'change' : 'input'
                        },
                        parser: type === 'number' ? val => parseFloat(val) : val => val
                    });
                }
            }
        }
    }    /**
     * Create a fieldset for a nested object
     * @param {string} key - The property key
     * @param {Object} value - The object value
     * @param {HTMLElement} container - The container to append the fieldset to
     * @param {string} [propertyPath=''] - The full property path in the model
     */
    createObjectField(key, value, container, propertyPath = '') {
        const fieldset = document.createElement('fieldset');
        fieldset.className = 'form-object';

        // Create legend
        const legend = document.createElement('legend');
        legend.textContent = this.formatLabel(key);

        // Assemble fieldset
        fieldset.appendChild(legend);

        // Recursively build form for nested object with the property path
        this.buildForm(value, fieldset, propertyPath);

        // Add to container
        container.appendChild(fieldset);
    }

    /**
     * Create a table for an array of objects
     * @param {string} key - The property key
     * @param {Array} array - The array value
     * @param {HTMLElement} container - The container to append the table to
     * @param {string} [propertyPath=''] - The full property path in the model
     */
    createArrayField(key, array, container, propertyPath = '') {
        const formGroup = document.createElement('div');
        formGroup.className = 'form-group';

        // Create label
        const label = document.createElement('label');
        label.textContent = this.formatLabel(key);

        // Create array container
        const arrayContainer = document.createElement('div');
        arrayContainer.className = 'array-container';

        // Check if array is empty
        if (array.length === 0) {
            const emptyMessage = document.createElement('div');
            emptyMessage.className = 'empty-array';
            emptyMessage.textContent = 'No items';
            arrayContainer.appendChild(emptyMessage);
        } else {
            // Check if array contains objects
            const firstItem = array[0];
            const isObjectArray = typeof firstItem === 'object' && firstItem !== null && !Array.isArray(firstItem);

            // Construct the full property path for this array
            const fullPropertyPath = propertyPath;
            
            if (isObjectArray) {
                // Create a table for array of objects
                this.createArrayTable(array, arrayContainer, fullPropertyPath);
            } else {
                // Create a simple list for array of primitives
                this.createArrayList(array, arrayContainer, fullPropertyPath);
            }
        }

        // Assemble form group
        formGroup.appendChild(label);
        formGroup.appendChild(arrayContainer);

        // Add to container
        container.appendChild(formGroup);
    }

    /**
     * Create a table for an array of objects
     * @param {Array} array - The array of objects
     * @param {HTMLElement} container - The container to append the table to
     * @param {string} propertyPath - The path to the array property in the model
     */
    createArrayTable(array, container, propertyPath) {
        if (array.length === 0) {
            const emptyMessage = document.createElement('div');
            emptyMessage.className = 'empty-array';
            emptyMessage.textContent = 'No items';
            container.appendChild(emptyMessage);
            return;
        }

        // Get all unique keys from all objects in the array
        const keys = [];
        const keyTypes = new Map();
        
        // First pass: collect all non-private keys and their types
        array.forEach(item => {
            if (typeof item === 'object' && item !== null) {
                Object.entries(item).forEach(([key, value]) => {
                    // Skip private properties (starting with _) and functions
                    if (!key.startsWith('_') && typeof value !== 'function' && !keyTypes.has(key)) {
                        keyTypes.set(key, this.getType(value));
                        keys.push(key);
                    }
                });
            }
        });

        // Create table container for scrolling
        const tableContainer = document.createElement('div');
        tableContainer.className = 'array-table-container';
        
        // Create table
        const table = document.createElement('table');
        table.className = 'array-table';

        // Create header
        const thead = document.createElement('thead');
        const headerRow = document.createElement('tr');

        keys.forEach(key => {
            const th = document.createElement('th');
            th.textContent = this.formatLabel(key);
            headerRow.appendChild(th);
        });

        thead.appendChild(headerRow);
        table.appendChild(thead);

        // Create body
        const tbody = document.createElement('tbody');

        array.forEach((item, rowIndex) => {
            const row = document.createElement('tr');

            keys.forEach(key => {
                // Skip if this is a private property or function (shouldn't happen due to filtering above, but just in case)
                if (key.startsWith('_') || typeof item[key] === 'function') {
                    return;
                }
                const cell = document.createElement('td');
                const value = item ? item[key] : undefined;
                const type = keyTypes.get(key) || 'string';

                if (type === 'object' || type === 'array') {
                    cell.textContent = `[${type}]`;
                } else if (type === 'boolean') {
                    const checkbox = document.createElement('input');
                    checkbox.type = 'checkbox';
                    checkbox.checked = Boolean(value);
                    checkbox.className = 'form-control';
                    checkbox.style.width = 'auto';
                    checkbox.style.margin = '0 auto';
                    checkbox.style.display = 'block';
                    cell.style.textAlign = 'center';
                    cell.appendChild(checkbox);
                    
                    // Create binding for this checkbox
                    // Get the app and model through the view
                    const app = this._view.getApp();
                    if (app) {
                        const model = app.getModel();
                        if (model) {
                            // Create path to this array item property
                            const itemPath = `${propertyPath}[${rowIndex}].${key}`;
                            console.log(`Creating binding for array item: ${itemPath}`);
                            
                            // Create binding for this checkbox
                            this.createBinding({
                                model: model,
                                path: itemPath,
                                element: checkbox,
                                attribute: 'checked',
                                events: {
                                    view: 'change' // Use 'change' event for checkboxes
                                }
                            });
                        }
                    }
                } else {
                    const input = document.createElement('input');
                    input.type = type === 'number' ? 'number' : 'text';
                    input.value = value !== undefined ? String(value) : '';
                    input.className = 'form-control';
                    input.style.width = '100%';
                    input.style.boxSizing = 'border-box';
                    cell.appendChild(input);
                    
                    // Create binding for this input with explicit event handling
                    // Get the app and model through the view
                    const app = this._view.getApp();
                    if (app) {
                        const model = app.getModel();
                        if (model) {
                            // Create path to this array item property
                            const itemPath = `${propertyPath}[${rowIndex}].${key}`;
                            console.log(`Creating binding for array item: ${itemPath}`);
                            
                            // Create binding for this input, letting Binding._determineViewEvent select the appropriate event
                            this.createBinding({
                                model: model,
                                path: itemPath,
                                element: input,
                                attribute: 'value',
                                parser: type === 'number' ? val => parseFloat(val) : val => val
                            });
                        }
                    }
                }

                row.appendChild(cell);
            });

            tbody.appendChild(row);
        });

        table.appendChild(tbody);
        tableContainer.appendChild(table);
        container.appendChild(tableContainer);
    }

    /**
     * Create a list for an array of primitive values
     * @param {Array} array - The array of primitive values
     * @param {HTMLElement} container - The container to append the list to
     * @param {string} propertyPath - The path to the array property in the model
     */
    createArrayList(array, container, propertyPath) {
        if (array.length === 0) {
            const emptyMessage = document.createElement('div');
            emptyMessage.className = 'empty-array';
            emptyMessage.textContent = 'No items';
            container.appendChild(emptyMessage);
            return;
        }

        // Create list container
        const listContainer = document.createElement('div');
        listContainer.className = 'array-list-container';

        // Create list
        const list = document.createElement('div');
        list.className = 'array-list';

        // Determine the type of the first non-null item
        let itemType = 'string';
        for (const item of array) {
            if (item !== null && item !== undefined) {
                itemType = this.getType(item);
                break;
            }
        }

        // Create list items
        array.forEach((item, index) => {
            const listItem = document.createElement('div');
            listItem.className = 'array-list-item';

            // Create index label
            const indexLabel = document.createElement('div');
            indexLabel.className = 'array-index';
            indexLabel.textContent = `[${index}]`;

            // Create value container
            const valueContainer = document.createElement('div');
            valueContainer.className = 'array-value';

            if (itemType === 'boolean') {
                const checkbox = document.createElement('input');
                checkbox.type = 'checkbox';
                checkbox.checked = Boolean(item);
                checkbox.className = 'form-control';
                valueContainer.appendChild(checkbox);
                
                // Create binding for this checkbox
                // Get the app and model through the view
                const app = this._view.getApp();
                if (app) {
                    const model = app.getModel();
                    if (model) {
                        // Create path to this array item
                        const itemPath = `${propertyPath}[${index}]`;
                        console.log(`Creating binding for array item: ${itemPath}`);
                        
                        // Create binding for this checkbox
                        this.createBinding({
                            model: model,
                            path: itemPath,
                            element: checkbox,
                            attribute: 'checked',
                            events: {
                                view: 'change' // Use 'change' event for checkboxes
                            }
                        });
                    }
                }
            } else {
                const input = document.createElement('input');
                input.type = itemType === 'number' ? 'number' : 'text';
                input.value = item !== undefined ? String(item) : '';
                input.className = 'form-control';
                valueContainer.appendChild(input);
                
                // Create binding for this input
                // Get the app and model through the view
                const app = this._view.getApp();
                if (app) {
                    const model = app.getModel();
                    if (model) {
                        // Create path to this array item
                        const itemPath = `${propertyPath}[${index}]`;
                        console.log(`Creating binding for array item: ${itemPath}`);
                        
                        // Create binding for this input, letting Binding._determineViewEvent select the appropriate event
                        this.createBinding({
                            model: model,
                            path: itemPath,
                            element: input,
                            attribute: 'value',
                            parser: itemType === 'number' ? val => parseFloat(val) : val => val
                        });
                    }
                }
            }

            // Assemble list item
            listItem.appendChild(indexLabel);
            listItem.appendChild(valueContainer);
            list.appendChild(listItem);
        });

        listContainer.appendChild(list);
        container.appendChild(listContainer);
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
     * Get the type of a value
     * @param {*} value - The value to get the type of
     * @returns {string} - The type name
     */
    getType(value) {
        if (value === null) return 'null';
        if (Array.isArray(value)) return 'array';
        if (value instanceof Date) return 'date';
        return typeof value;
    }
}