import { BaseComponent } from './BaseComponent.js';
import { ModelPathUtils } from '../../utils/ModelPathUtils.js';

// CSS is now loaded in the main HTML file
// This prevents duplicate loading and path resolution issues

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
     * Load configuration directly from the app
     * @private
     */
    async _loadConfig() {
        try {
            // Get app instance from view
            const app = this._view?._app;
            
            if (!app) {
                throw new Error('App instance not available from view');
            }
            
            // Load config directly from app
            this._config = await app.loadViewConfigJson('ModelPanel');
            this._configLoaded = true;
            
            // Configuration loaded, but we don't update the view automatically
            // The view will be updated on the next model update event
        } catch (error) {
            console.warn('Could not load ModelPanel configuration, using defaults:', error.message);
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
            console.error('No configuration available for model panel');
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
        label.textContent = propConfig.Label || this.formatLabel(propPath.split('.').pop());
        formGroup.appendChild(label);
        
        // Get property definition from the model definition
        const propDef = this._getPropertyDefinition(model._className, propPath);
        console.log(`Property definition for ${propPath}:`, propDef);
        
        // Create an input field based on the property type, widget type, and editability
        let input;
        // Use property definition type info if available, otherwise fallback to inference
        const widgetType = propConfig.widget || this._getDefaultWidgetType(value, propConfig, propDef);
        console.log(`Widget type for ${propPath}: ${widgetType}`);
        
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
                
                // Create binding for checkbox
                this.createBinding({
                    model: model,
                    path: propPath,
                    element: input,
                    attribute: 'checked',
                    events: {
                        view: 'change' // Use 'change' event for checkboxes
                    },
                    parser: val => Boolean(val)
                });
                break;
                
            case 'number':
                input = document.createElement('input');
                input.type = 'number';
                input.className = 'form-control';
                input.value = value !== undefined && value !== null ? value : '';
                
                // Add min/max/step if specified
                if (propDef.Min !== undefined) input.min = propDef.Min;
                if (propDef.Max !== undefined) input.max = propDef.Max;
                if (propDef.Step !== undefined) input.step = propDef.Step;
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
        
        // Get property definition for the array to determine element type
        const arrayPropDef = this._getPropertyDefinition(model._className, arrayConfig.PropertyPath);
        console.log(`Array property definition:`, arrayPropDef);
        
        // Get element type from array property definition
        let elementClassName = null;
        if (arrayPropDef && arrayPropDef.ElementType) {
            elementClassName = arrayPropDef.ElementType;
            console.log(`Found array element type: ${elementClassName}`);
        }
        
        // Add rows for each item
        array.forEach((item, index) => {
            const row = document.createElement('tr');
            
            // Add cells for display properties
            displayProps.forEach(propConfig => {
                const cell = document.createElement('td');
                
                // Get property name from path
                const propName = propConfig.PropertyPath;
                const value = item[propName];
                
                // Get property definition - use element type from array definition if available
                let propDef = null;
                
                if (arrayPropDef && arrayPropDef.Type) {
                    // Get the class name from ElementType
                    const elementType = arrayPropDef.Type;
                    console.log(`Looking up property ${propName} in class ${elementType}`);
                    propDef = this._getPropertyDefinition(elementType, propName);
                } else if (item && item._className) {
                    // Fall back to item's class name if array definition doesn't have ElementType
                    propDef = this._getPropertyDefinition(item._className, propName);
                }
                
                console.log(`Property definition for ${propName}:`, propDef);
                
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
        // Use config's ModelClass if className isn't provided but config has it
        if (!className && this._config && this._config.ModelClass) {
            console.log(`No _className in model, using ModelClass from config: ${this._config.ModelClass}`);
            className = this._config.ModelClass;
        }
        
        if (!className) {
            console.warn('No class name available for property definition lookup');
            return null; // Return null instead of throwing to make UI more resilient
        }
        
        // Get model manager through proper method calls
        // ModelPanel -> View -> App -> ClientModel -> ModelManager
        if (!this._view) {
            console.warn('View not available');
            return null;
        }
        
        const app = this._view.getApp();
        if (!app) {
            console.warn('App not available');
            return null;
        }
        
        const clientModel = app.getModel();
        if (!clientModel) {
            console.warn('ClientModel not available');
            return null;
        }
        
        // Use the getter method to access the model manager
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
     * Get the type of a value
     * @param {*} value - The value to check
     * @returns {string} The type of the value
     */
    getType(value) {
        if (value === null) return 'null';
        if (Array.isArray(value)) return 'array';
        if (value instanceof Date) return 'date';
        return typeof value;
    }
    
    /**
     * Get the default widget type based on property definition if available, otherwise fallback to value inference
     * @param {*} value - The property value
     * @param {Object} propConfig - The property configuration from view config 
     * @param {Object} propDef - The property definition from model class definition
     * @returns {string} The default widget type
     * @private
     */
    _getDefaultWidgetType(value, propConfig = {}, propDef = null) {
        // If we have a property definition with type information, prioritize that
        if (propDef && propDef.Type) {
            // Use the explicit type from model definition
            const defType = propDef.Type.toLowerCase();
            console.log(`Using property definition type: ${defType} for widget selection`);
            
            switch (defType) {
                case 'boolean':
                    return 'checkbox';
                case 'number':
                case 'integer':
                case 'float':
                case 'double':
                    return 'number';
                case 'array':
                    return 'array';
                case 'object':
                    return 'object';
                case 'string':
                default:
                    return 'text';
            }
        }
        
        // Fallback to property name inspection for boolean type hints
        const propName = propConfig.PropertyPath ? 
            propConfig.PropertyPath.split('.').pop().toLowerCase() : 
            (value && typeof value === 'object' && value._id ? value._id.toLowerCase() : '');
            
        if (propName && (
            propName.startsWith('is') || 
            propName.startsWith('use') || 
            propName.startsWith('flag') ||
            propName.startsWith('enable') ||
            propName.startsWith('has') ||
            propName === 'active' ||
            propName === 'required'
        )) {
            return 'checkbox';
        }
        
        // Handle string 'true'/'false' values
        if (typeof value === 'string' && 
            (value.toLowerCase() === 'true' || value.toLowerCase() === 'false')) {
            return 'checkbox';
        }
        
        // Last resort: inference from actual value type
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
    
    // Old _getDefaultWidgetType method removed - using the improved version above
    
    /**
     * Format a label from a property key
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
                            view: type === 'boolean' || type === 'number' ? 'change' : 'input'
                        },
                        parser: type === 'number' ? val => parseFloat(val) : val => val
                    });
                }
            }
        }
    }
    
    // createObjectField method removed - not used in the current implementation

    // removed unused createArrayField method

    // removed unused createArrayTable method

    // removed unused createArrayList method

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