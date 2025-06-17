import { ModelPanelSection } from './ModelPanelSection.js';
import { ModelPathUtils } from '../../utils/ModelPathUtils.js';
import { PropertyRenderUtils } from '../utils/PropertyRenderUtils.js';
import { ArrayTableComponent } from './ArrayTableComponent.js';
import { VectorInputComponent } from './VectorInputComponent.js';
import { DefaultWidgetComponent } from './DefaultWidgetComponent.js';

/**
 * Component for managing property group sections in the ModelPanel
 * Can now handle both regular properties and array properties within the same group
 */
export class PropertyGroupSection extends ModelPanelSection {
    /**
     * Create a new PropertyGroupSection instance
     * @param {Object} modelPanel - The parent ModelPanel instance
     * @param {Object} sectionConfig - The section configuration
     * @param {Object} model - The model data
     */
    constructor(modelPanel, sectionConfig, model) {
        super(modelPanel, sectionConfig, model);
        // Array to track child components - ensure it exists even if not in BaseComponent
        if (!this._childComponents) {
            this._childComponents = [];
        }
    }
    
    /**
     * Create section element from configuration
     * @returns {HTMLElement} The created section element
     * @protected
     */
    _createSection() {
        return this._createPropertyGroup();
    }
    
    /**
     * Create a property group from configuration
     * @returns {HTMLElement} The created property group element
     * @private
     */
    _createPropertyGroup() {
        // Create group container as fieldset
        const group = document.createElement('fieldset');
        group.className = 'property-group';
        
        // Add group header as legend if name is provided
        if (this._sectionConfig.GroupName) {
            const groupHeader = document.createElement('legend');
            groupHeader.textContent = this._sectionConfig.GroupName;
            group.appendChild(groupHeader);
        }
        
        // Using widget-based configuration
        if (this._sectionConfig.Widgets && Array.isArray(this._sectionConfig.Widgets)) {
            // Sort widgets by order if available
            const sortedWidgets = this._sortByOrder(this._sectionConfig.Widgets);
            
            // Create each widget
            sortedWidgets.forEach(widgetConfig => {
                this._createWidget(widgetConfig, group);
            });
        } else {
            console.warn('No widgets defined in section configuration');
        }
        
        return group;
    }
    
    /**
     * Create a single property field
     * @param {string} propPath - The property path
     * @param {Object} propConfig - The property configuration
     * @param {HTMLElement} container - The container to append the field to
     * @private
     */
    _createPropertyField(propPath, propConfig, container) {
        // Check if this is an array property
        if (propConfig.PropertyType === 'Array') {
            this._createArrayPropertyField(propPath, propConfig, container);
            return;
        }
        
        // Get property value from model
        const propValue = ModelPathUtils.getValueFromObjectPath(this._model, propPath);
        
        // Get property definition from utils
        const propDef = this._modelPanel.getPropertyRenderUtils().getPropertyDefinition(this._model._className, propPath);
        
        // Get property type from utils
        const propType = this._modelPanel.getPropertyRenderUtils().getPropertyType(propValue, propDef);
        
        // Check if property is editable
        const isEditable = this._modelPanel.getPropertyRenderUtils().isPropertyEditable(propConfig, propDef);
        
        // Create field container
        const fieldContainer = document.createElement('div');
        fieldContainer.className = 'form-group';
        
        // Create label
        const label = document.createElement('label');
        label.textContent = propConfig.Label || this._modelPanel.getPropertyRenderUtils().formatLabel(propPath.split('.').pop());
        fieldContainer.appendChild(label);
        
        // Create input using utils
        const input = this._modelPanel.getPropertyRenderUtils().createPropertyInput(propType, propValue, { isEditable });
        fieldContainer.appendChild(input);
        
        // Add binding using utils
        const pathParts = propPath.split('.');
        const property = pathParts.pop();
        const objectPath = pathParts.join('.');
        
        this._modelPanel.getPropertyRenderUtils().createBinding({
            model: this._model,
            objectPath: objectPath,
            property: property,
            view: input,
            parser: propType === 'number' ? val => parseFloat(val) : val => val
        }, this);
        
        // Create dependent bindings if property config exists
        if (propConfig) {
            this._modelPanel.getPropertyRenderUtils().createDependentBindings(this._model, objectPath, propConfig, input, this);
        }
        
        container.appendChild(fieldContainer);
    }
    
    /**
     * Create an array property field with table component
     * @param {string} propPath - The property path
     * @param {Object} propConfig - The property configuration
     * @param {HTMLElement} container - The container to append the field to
     * @private
     */
    _createArrayPropertyField(propPath, propConfig, container) {
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
            utils: this._modelPanel.getPropertyRenderUtils()
        });
        
        // Add the table element to the container
        fieldContainer.appendChild(arrayTable.element);
        
        // Register the component in bindings array for cleanup
        this._childComponents.push(arrayTable);
        
        container.appendChild(fieldContainer);
    }
    
    /**
     * Create a widget based on its configuration
     * @param {Object} widgetConfig - The widget configuration
     * @param {HTMLElement} container - The container to append the widget to
     * @private
     */
    _createWidget(widgetConfig, container) {
        if (!widgetConfig || !widgetConfig.WidgetClass) {
            console.warn('Invalid widget configuration, missing WidgetClass');
            return;
        }
        
        const widgetClass = widgetConfig.WidgetClass;
        const propertyConfigs = widgetConfig.PropertyConfigs || [];
        
        // Create widget instance based on class name
        try {
            let widgetInstance;
            
            // Instantiate the widget based on the class name
            switch (widgetClass) {
                case 'DefaultWidgetComponent':
                    widgetInstance = this._createDefaultWidget(propertyConfigs, widgetConfig.Label);
                    break;
                    
                case 'VectorInputComponent':
                    widgetInstance = this._createVectorWidget(propertyConfigs, widgetConfig.Label);
                    break;
                    
                default:
                    console.error(`Widget class not supported: ${widgetClass}`);
                    return;
            }
            
            if (widgetInstance && widgetInstance.element) {
                // Add the widget to the container
                container.appendChild(widgetInstance.element);
                
                // Register the widget component for cleanup
                this._childComponents.push(widgetInstance);
            } else {
                console.warn(`Failed to create widget instance for class: ${widgetClass}`);
            }
        } catch (error) {
            console.error(`Error creating widget of class ${widgetClass}:`, error);
        }
    }
    
    /**
     * Create a default widget (single property)
     * @param {Array} propertyConfigs - The property configurations
     * @param {string} label - Optional label for the widget
     * @returns {Object} The created widget instance
     * @private
     */
    _createDefaultWidget(propertyConfigs, label) {
        // Default widgets should have exactly one property config
        if (!Array.isArray(propertyConfigs) || propertyConfigs.length === 0) {
            console.warn('Default widget has no property configurations');
            return null;
        }
        
        // Create utils instance if needed
        const utils = this._utils || new PropertyRenderUtils(this._view);
        
        // Create DefaultWidgetComponent instance
        const defaultWidget = new DefaultWidgetComponent(this._view, {
            model: this._model,
            propertyConfigs: propertyConfigs,
            label: label,
            utils: utils
        });
        
        return defaultWidget;
    }
    
    /**
     * Create a vector widget (three properties with colons between them)
     * @param {Array} propertyConfigs - The property configurations
     * @param {string} label - Optional label for the widget
     * @returns {Object} The created vector input component
     * @private
     */
    _createVectorWidget(propertyConfigs, label) {
        if (!Array.isArray(propertyConfigs) || propertyConfigs.length !== 3) {
            console.warn('Vector widget requires exactly 3 property configurations');
            return null;
        }
        
        // Create the vector input component
        try {
            const vectorInput = new VectorInputComponent(this._view, {
                model: this._model,
                propertyConfigs: propertyConfigs,
                label: label,
                utils: this._modelPanel.getPropertyRenderUtils()
            });
            
            return vectorInput;
        } catch (error) {
            console.error('Error creating vector input component:', error);
            return null;
        }
    }
    
    /**
     * Clean up resources when the component is destroyed
     */
    destroy() {
        // Clean up any child components first
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
