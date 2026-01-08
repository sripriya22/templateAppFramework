import { BaseComponent } from './BaseComponent.js';
import { ModelPathUtils } from '../../utils/ModelPathUtils.js';
import { PropertyGroupSection } from './PropertyGroupSection.js';
import { DependentBinding } from '../../binding/DependentBinding.js';
import { PropertyRenderUtils } from '../utils/PropertyRenderUtils.js';

// CSS is now loaded in the main HTML file
// This prevents duplicate loading and path resolution issues

/**
 * ModelPanel component for displaying form fields for model properties
 * Uses section components to display different types of content
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
        
        // Create a shared PropertyRenderUtils instance for all sections
        this._propertyRenderUtils = new PropertyRenderUtils(view);
        
        this.createModelPanel();
        
        // Store component reference on element for layout access
        this.element.__component = this;
        this._configLoaded = true;
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
     * Create the model panel DOM structure
     */
    createModelPanel() {
        // Create main container
        this.element = document.createElement('div');
        this.element.className = 'model-panel';

        // Create header
        const header = document.createElement('div');
        header.className = 'panel-header';
        header.textContent = ''; // Will be set based on config or model
        this.headerElement = header; // Store reference to header for updates

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
        
        // Update header based on config or model
        this._updateHeader(model);
        
        if (!model) {
            console.warn('ModelPanel.updateModel called with null model');
            this._showNoModelMessage();
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
    }
    
    /**
     * Update the header based on configuration or model
     * @param {Object} model - The model data (can be null)
     * @private
     */
    _updateHeader(model) {
        if (!this.headerElement) return;
        
        // Check if config has a HeaderLabel
        if (this._config && this._config.HeaderLabel !== undefined) {
            if (this._config.HeaderLabel === '') {
                // Empty HeaderLabel means hide the header
                this.headerElement.style.display = 'none';
            } else {
                // Use the HeaderLabel from config
                this.headerElement.style.display = 'block';
                this.headerElement.textContent = this._config.HeaderLabel;
            }
        } else if (model) {
            // Fallback to class name if no HeaderLabel in config
            this.headerElement.style.display = 'block';
            const className = this._view.getApp().getRootClassName();
            const displayName = className.split('.').pop();
            this.headerElement.textContent = displayName;
        } else {
            // No model and no HeaderLabel - hide header
            this.headerElement.style.display = 'none';
        }
    }
    
    /**
     * Show the no model message
     * @private
     */
    _showNoModelMessage() {
        const noModelMessage = document.createElement('div');
        noModelMessage.className = 'no-model-message';
        
        // Use NoModelMessage from config if available, otherwise use default
        const message = (this._config && this._config.NoModelMessage) 
            ? this._config.NoModelMessage 
            : 'No model loaded.';
            
        noModelMessage.textContent = message;
        this.formElement.appendChild(noModelMessage);
    }
    
    /**
     * Validate the configuration against the model definitions
     * @param {string} modelClass - The model class name
     * @private
     */
    _validateConfig(modelClass) {
        if (!this._config) {
            console.error('No configuration available to validate');
            return;
        }
        
        // Basic validation: check for required configuration properties
        if (!this._config.Sections || !Array.isArray(this._config.Sections)) {
            console.error('Invalid configuration: missing or invalid Sections array');
            return;
        }
        
        // Log validation success and configuration summary
        console.log(`Configuration validated for model class ${modelClass}`, {
            sections: this._config.Sections.length
        });
    }
    
    /**
     * Build form from configuration
     * @param {Object} model - The model data
     * @private
     */
    _buildFormFromConfig(model) {
        if (!this._config || !this._config.Sections) {
            console.error('No valid configuration available for form building');
            return;
        }
        
        // Get model class for validation
        const modelClass = model._className;
        console.log(`Building form from config for model class: ${modelClass}`);
        
        // Validate the configuration against model schema
        this._validateConfig(modelClass);
        
        // Created sections collection to track sections
        this._sections = [];
        
        // Process each section in the configuration
        for (const section of this._config.Sections) {
            if (!section || !section.Type) {
                console.warn('Invalid section configuration, missing Type property');
                continue;
            }
            
            console.log(`Processing section of type ${section.Type}`);
            
            try {
                // Create section based on type
                const sectionComponent = this._createSection(section, model);
                
                // Add section component to form if created successfully
                if (sectionComponent && sectionComponent.element) {
                    this.formElement.appendChild(sectionComponent.element);
                    this._sections.push(sectionComponent);
                } else {
                    console.warn(`Failed to create section of type ${section.Type}`);
                }
            } catch (error) {
                console.error(`Error creating section of type ${section.Type}:`, error);
            }
        }
        
        // Force update on all dependent bindings in each section
        this._sections.forEach(section => {
            if (section._updateDependentBindings) {
                section._updateDependentBindings();
            }
        });
    }
    
    /**
     * Force an update on all DependentBindings in each section
     * @private
     * @deprecated Moved to individual ModelPanelSection instances
     */
    _updateDependentBindings() {
        console.log('Delegating dependent binding updates to individual sections');
        
        if (!this._sections || !this._sections.length) {
            console.warn('No sections available to update dependent bindings');
            return;
        }
        
        // Ask each section to update its own dependent bindings
        this._sections.forEach(section => {
            if (section._updateDependentBindings) {
                section._updateDependentBindings();
            }
        });
    }
    
    /**
     * Create a section based on its type
     * @param {Object} section - The section configuration
     * @param {Object} model - The model data
     * @private
     * @returns {Object} The created section component
     */
    _createSection(section, model) {
        if (!section || !section.Type) {
            console.error('Invalid section configuration:', section);
            return null;
        }
        
        // Create the appropriate section type
        let sectionComponent = null;
        
        // Only handle PropertyGroup sections - no backward compatibility
        if (section.Type === 'PropertyGroup') {
            console.log('Creating PropertyGroupSection for:', section.GroupName);
            sectionComponent = new PropertyGroupSection(this, section, model);
        } else {
            console.error('Unknown section type:', section.Type);
            return null;
        }
        
        // Add the section to the form
        if (sectionComponent && sectionComponent.element) {
            this.formElement.appendChild(sectionComponent.element);
            return sectionComponent;
        }
        
        return null;
    }
    
    /**
     * Create dependent bindings for a field based on property config
     * @param {Object} model - The model object
     * @param {string} objectPath - The path to the object
     * @param {Object} propConfig - The property configuration
     * @param {HTMLElement} element - The element to apply effects to
     * @private
     */
    _createDependentBindings(model, objectPath, propConfig, element) {
        const app = this._view.getApp();
        if (!app || !app.getModel()) return;
        
        // Debug the incoming property config
        console.log('Creating dependent bindings for', objectPath, propConfig);
        
        // Process editability dependency
        this._createEditabilityBinding(model, objectPath, propConfig, element);
        
        // Process visibility dependency (if implemented)
        this._createVisibilityBinding(model, objectPath, propConfig, element);
        
        // Other dependent bindings can be added here
    }
    
    /**
     * Create editability binding if the Editable property is a reference
     * @param {Object} model - The model object
     * @param {string} objectPath - The path to the object
     * @param {Object} propConfig - The property configuration
     * @param {HTMLElement} element - The element to apply effects to
     * @private
     */
    _createEditabilityBinding(model, objectPath, propConfig, element) {
        console.log('Checking editability binding for', propConfig);
        
        // Only process if Editable is defined and not a simple boolean
        if (propConfig.Editable === undefined) {
            console.log('No Editable property defined');
            return;
        }
        
        // If it's a boolean, apply static editability
        if (typeof propConfig.Editable === 'boolean') {
            console.log('Static editability:', propConfig.Editable);
            element.disabled = !propConfig.Editable;
            if (!propConfig.Editable) {
                element.classList.add('disabled');
            } else {
                element.classList.remove('disabled');
            }
            return;
        }
        
        // Check if Editable references another property
        const dependency = this._parseDependencyExpression(propConfig.Editable, objectPath);
        if (!dependency) {
            console.log('Not a valid dependency expression:', propConfig.Editable);
            return;
        }
        
        console.log(`Creating editable dependency for ${propConfig.PropertyPath} on ${dependency.objectPath}.${dependency.property}`);
        
        // Create a dependent binding that controls editability
        this.createDependentBinding({
            type: 'editable',
            objectPath: dependency.objectPath,
            property: dependency.property,
            view: element
        });
    }
    
    /**
     * Create visibility binding if the Visible property is a reference
     * @param {Object} model - The model object
     * @param {string} objectPath - The path to the object
     * @param {Object} propConfig - The property configuration
     * @param {HTMLElement} element - The element to apply effects to
     * @private
     */
    _createVisibilityBinding(model, objectPath, propConfig, element) {
        // Only process if Visible is defined and not a simple boolean
        if (propConfig.Visible === undefined || typeof propConfig.Visible === 'boolean') {
            return;
        }
        
        // Check if Visible references another property
        const dependency = this._parseDependencyExpression(propConfig.Visible, objectPath);
        if (!dependency) return;
        
        console.log(`Creating visibility dependency for ${propConfig.PropertyPath} on ${dependency.property}`);
        
        // Get the view's event manager
        const app = this._view.getApp();
        if (!app || !app.getModel() || !this.eventManager) {
            console.warn('Cannot create visibility binding: missing eventManager');
            return;
        }
        
        // Create a dependent binding that controls visibility
        // Make sure to include eventManager to prevent 'missing required binding options' error
        this.createDependentBinding({
            type: 'visibility',
            objectPath: dependency.objectPath,
            property: dependency.property,
            view: element.closest('.form-group') || element, // Apply to the form group for proper hiding if possible
            eventManager: this.eventManager,
            model: app.getModel()
        });
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
        const value = ModelPathUtils.getValueFromObjectPath(model, propPath);
        
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
        const widgetType = propConfig.WidgetType || this._getDefaultWidgetType(value, propConfig, propDef);
        console.log(`Widget type for ${propPath}: ${widgetType}`);
        
        // Check if property is explicitly set as editable/non-editable in config
        // If not specified, check if it's marked as ReadOnly in property info
        let isEditable = propConfig.Editable !== false;
        
        // Create the appropriate widget based on type
        switch (widgetType) {
            case 'checkbox':
                input = document.createElement('input');
                input.type = 'checkbox';
                input.checked = !!value;
                if (!isEditable) input.disabled = true;
                break;
            case 'select':
                // Implementation for select dropdown
                input = document.createElement('select');
                if (!isEditable) input.disabled = true;
                
                // Add options from property definition if available
                if (propDef && propDef.options) {
                    propDef.options.forEach(option => {
                        const optElement = document.createElement('option');
                        optElement.value = option.value || option;
                        optElement.textContent = option.label || option;
                        input.appendChild(optElement);
                    });
                }
                input.value = value || '';
                break;
            case 'textarea':
                input = document.createElement('textarea');
                input.value = value || '';
                if (!isEditable) input.disabled = true;
                break;
            case 'number':
                input = document.createElement('input');
                input.type = 'number';
                input.value = value || '';
                if (!isEditable) input.disabled = true;
                
                // Add min/max if in property definition
                if (propDef) {
                    if (propDef.min !== undefined) input.min = propDef.min;
                    if (propDef.max !== undefined) input.max = propDef.max;
                }
                break;
            case 'text':
            default:
                input = document.createElement('input');
                input.type = 'text';
                input.value = value !== undefined && value !== null ? value : '';
                if (!isEditable) input.disabled = true;
        }
        
        // Add to form group
        formGroup.appendChild(input);
        
        // Add to container
        container.appendChild(formGroup);

        // Create binding for this field
        const pathParts = propPath.split('.');
        const property = pathParts.pop();
        const objectPath = pathParts.length > 0 ? pathParts.join('.') : '';
        
        const app = this._view.getApp();
        
        // Create binding with the view's app model
        this.createBinding({
            model: app.getModel(),
            objectPath: objectPath,
            property: property,
            view: input,
            viewAttribute: widgetType === 'checkbox' ? 'checked' : 'value',
            viewEvent: widgetType === 'checkbox' ? 'change' : 'blur',
            parser: widgetType === 'number' ? val => Number(val) : val => val
        });
        
        // Process any dependent bindings for this field
        this._createDependentBindings(model, objectPath, propConfig, input);
    }
    
    /**
     * Helper methods to determine widget type based on value and config
     * @param {*} value - The property value
     * @param {Object} propConfig - The property configuration
     * @param {Object} propDef - The property definition
     * @returns {string} The widget type to use
     * @private
     */
    _getDefaultWidgetType(value, propConfig, propDef) {
        // If widget type specified in config, use that
        if (propConfig.WidgetType) {
            return propConfig.WidgetType;
        }
        
        // If property definition has a widget type, use that
        if (propDef && propDef.widget) {
            return propDef.widget;
        }
        
        // Otherwise infer based on value type
        const valueType = this.getType(value);
        
        switch (valueType) {
            case 'boolean':
                return 'checkbox';
            case 'number':
                return 'number';
            case 'object':
                // Complex objects get handled separately
                return null;
            case 'array':
                // Arrays get handled separately
                return null;
            default:
                return 'text';
        }
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
    
    /**
     * Get the shared PropertyRenderUtils instance
     * @returns {PropertyRenderUtils} The PropertyRenderUtils instance
     */
    getPropertyRenderUtils() {
        return this._propertyRenderUtils;
    }
}
