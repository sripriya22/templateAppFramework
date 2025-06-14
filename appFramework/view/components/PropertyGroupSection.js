import { ModelPanelSection } from './ModelPanelSection.js';
import { ModelPathUtils } from '../../utils/ModelPathUtils.js';

/**
 * Component for managing property group sections in the ModelPanel
 */
export class PropertyGroupSection extends ModelPanelSection {
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
        // Create group container
        const group = document.createElement('div');
        group.className = 'property-group';
        
        // Add group header if name is provided
        if (this._sectionConfig.GroupName) {
            const groupHeader = document.createElement('h3');
            groupHeader.className = 'group-header';
            groupHeader.textContent = this._sectionConfig.GroupName;
            group.appendChild(groupHeader);
        }
        
        // Create properties from configuration
        if (this._sectionConfig.Properties && Array.isArray(this._sectionConfig.Properties)) {
            // Sort properties by order if available
            const sortedProps = this._sortByOrder(this._sectionConfig.Properties);
            
            // Create each property field
            sortedProps.forEach(propConfig => {
                const propPath = propConfig.PropertyPath;
                if (propPath) {
                    this._createPropertyField(propPath, propConfig, group);
                }
            });
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
        // Get property value from model
        const propValue = ModelPathUtils.getValueFromObjectPath(this._model, propPath);
        
        // Get property definition
        const propDef = this._getPropertyDefinition(this._model._className, propPath);
        
        // Get property type
        const propType = this._getPropertyType(propValue, propDef);
        
        // Create field container
        const fieldContainer = document.createElement('div');
        fieldContainer.className = 'form-group';
        
        // Create label
        const label = document.createElement('label');
        label.textContent = propConfig.Label || this._modelPanel.formatLabel(propPath.split('.').pop());
        fieldContainer.appendChild(label);
        
        // Create input using centralized method
        const input = this._createPropertyInput(
            propType,
            propValue,
            { isEditable: this._isPropertyEditable(propConfig, propDef) }
        );
        fieldContainer.appendChild(input);
        
        // Add binding
        const pathParts = propPath.split('.');
        const property = pathParts.pop();
        const objectPath = pathParts.join('.');
        
        this._createBinding({
            model: this._model,
            objectPath: objectPath,
            property: property,
            view: input,
            parser: propType === 'number' ? val => parseFloat(val) : val => val
        });
        
        // Create dependent bindings if property config exists
        if (propConfig) {
            this._createDependentBindings(this._model, objectPath, propConfig, input);
        }
        
        container.appendChild(fieldContainer);
    }
}
