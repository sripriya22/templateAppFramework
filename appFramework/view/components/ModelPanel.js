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
        // Clear existing content
        this.formElement.innerHTML = '';
        
        if (!model) {
            console.warn('No model data provided to ModelPanel');
            return;
        }
        
        // If we have a configuration and it's loaded, use it
        if (this._config && this._configLoaded) {
            this._buildFormFromConfig(model);
        } else if (this._config && !this._configLoaded) {
            // If config is being loaded, show a loading message
            const loadingMessage = document.createElement('div');
            loadingMessage.className = 'loading-message';
            loadingMessage.textContent = 'Loading configuration...';
            this.formElement.appendChild(loadingMessage);
        } else {
            // Fall back to current behavior
            this.buildForm(model, this.formElement);
        }
    }
    
    /**
     * Build form from configuration
     * @param {Object} model - The model data
     * @private
     */
    _buildFormFromConfig(model) {
        // Get the model class definition manager through the public API
        const modelManager = this._view._app.model.modelManager;
        
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
        
        // Create an input field based on the property type and widget type
        let input;
        const widgetType = propConfig.widget || this._getDefaultWidgetType(value);
        
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
            });
            
            tbody.appendChild(row);
        });
        
        table.appendChild(tbody);
        container.appendChild(table);
        
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
     */
    buildForm(model, container) {
        // Process each property in the model, filtering out private properties and functions
        Object.entries(model)
            .filter(([key, value]) => {
                // Skip private properties (those starting with _) and functions
                return !key.startsWith('_') && typeof value !== 'function';
            })
            .forEach(([key, value]) => {
                const type = this.getType(value);

                if (type === 'object' && !Array.isArray(value)) {
                    // Create a fieldset for nested objects
                    this.createObjectField(key, value, container);
                } else if (type === 'array') {
                    // Create a table for arrays
                    this.createArrayField(key, value, container);
                } else {
                    // Create a form field for primitive values
                    this.createField(key, value, type, container);
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
     */
    createField(key, value, type, container) {
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
    }

    /**
     * Create a fieldset for a nested object
     * @param {string} key - The property key
     * @param {Object} value - The object value
     * @param {HTMLElement} container - The container to append the fieldset to
     */
    createObjectField(key, value, container) {
        const fieldset = document.createElement('fieldset');
        fieldset.className = 'form-object';

        // Create legend
        const legend = document.createElement('legend');
        legend.textContent = this.formatLabel(key);

        // Assemble fieldset
        fieldset.appendChild(legend);

        // Recursively build form for nested object
        this.buildForm(value, fieldset);

        // Add to container
        container.appendChild(fieldset);
    }

    /**
     * Create a table for an array of objects
     * @param {string} key - The property key
     * @param {Array} array - The array value
     * @param {HTMLElement} container - The container to append the table to
     */
    createArrayField(key, array, container) {
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

            if (isObjectArray) {
                // Create a table for array of objects
                this.createArrayTable(array, arrayContainer);
            } else {
                // Create a simple list for array of primitives
                this.createArrayList(array, arrayContainer);
            }
        }

        // Assemble form group
        formGroup.appendChild(label);
        formGroup.appendChild(arrayContainer);

        // Add to container
        container.appendChild(formGroup);
    }

    /**
     * Create a fieldset for a nested object
     * @param {string} key - The property key
     * @param {Object} value - The object value
     * @param {HTMLElement} container - The container to append the fieldset to
     */
    createObjectField(key, value, container) {
        const fieldset = document.createElement('fieldset');
        fieldset.className = 'form-object';

        // Create legend
        const legend = document.createElement('legend');
        legend.textContent = this.formatLabel(key);

        // Assemble fieldset
        fieldset.appendChild(legend);

        // Recursively build form for nested object
        this.buildForm(value, fieldset);

        // Add to container
        container.appendChild(fieldset);
    }

    /**
     * Create a table for an array of objects
     * @param {string} key - The property key
     * @param {Array} array - The array value
     * @param {HTMLElement} container - The container to append the table to
     */
    createArrayField(key, array, container) {
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

            if (isObjectArray) {
                // Create a table for array of objects
                this.createArrayTable(array, arrayContainer);
            } else {
                // Create a simple list for array of primitives
                this.createArrayList(array, arrayContainer);
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
     */
    createArrayTable(array, container) {
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

        array.forEach((item) => {
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
                } else {
                    const input = document.createElement('input');
                    input.type = type === 'number' ? 'number' : 'text';
                    input.value = value !== undefined ? String(value) : '';
                    input.className = 'form-control';
                    input.style.width = '100%';
                    input.style.boxSizing = 'border-box';
                    cell.appendChild(input);
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
     */
    createArrayList(array, container) {
        const list = document.createElement('ul');
        list.className = 'array-list';
        list.style.listStyle = 'none';
        list.style.padding = '0';
        list.style.margin = '0';

        array.forEach((item, index) => {
            const listItem = document.createElement('li');
            listItem.className = 'array-item';
            listItem.style.marginBottom = '8px';
            listItem.style.display = 'flex';
            listItem.style.alignItems = 'center';

            const indexSpan = document.createElement('span');
            indexSpan.textContent = `[${index}]: `;
            indexSpan.style.marginRight = '8px';
            indexSpan.style.minWidth = '40px';
            indexSpan.style.flexShrink = '0';

            const type = this.getType(item);
            if (type === 'object' || type === 'array') {
                listItem.textContent = `[${index}]: [${type}]`;
            } else {
                const input = document.createElement('input');
                input.type = type === 'number' ? 'number' : 'text';
                input.value = String(item);
                input.className = 'form-control';
                input.style.flexGrow = '1';
                
                listItem.appendChild(indexSpan);
                listItem.appendChild(input);
            }

            list.appendChild(listItem);
        });

        container.appendChild(list);
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
     * Dispatch a model update event
     * @param {Object} model - The model object to update
     * @param {string} [propertyPath] - Optional property path that was updated
     * @private
     */
    _dispatchModelUpdate(model, propertyPath) {
        if (!this._view || !this._view.app || !this._view.app.eventManager) {
            console.warn('Cannot dispatch model update: app or event manager not available');
            return;
        }
        
        // If we have a specific property path, dispatch a property change event
        if (propertyPath) {
            const value = ModelPathUtils.getValueFromPath(model, propertyPath);
            
            this._view.app.eventManager.dispatchEvent(EventTypes.VIEW_TO_MODEL_PROPERTY_CHANGED, {
                path: propertyPath,
                value: value,
                model: model,
                source: 'component'
            });
        }
        
        // Always dispatch the general model update event
        this._view.app.eventManager.dispatch(EventTypes.CLIENT_MODEL_UPDATED, {
            Data: model
        });
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