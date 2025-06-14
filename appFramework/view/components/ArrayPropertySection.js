import { ModelPanelSection } from './ModelPanelSection.js';
import { ModelPathUtils } from '../../utils/ModelPathUtils.js';

/**
 * Component for managing array property sections in the ModelPanel
 */
export class ArrayPropertySection extends ModelPanelSection {
    /**
     * Create section element from configuration
     * @returns {HTMLElement} The created section element
     * @protected
     */
    _createSection() {
        return this._createArraySection();
    }
    
    /**
     * Create an array section from configuration
     * @returns {HTMLElement} The created array section element
     * @private
     */
    _createArraySection() {
        const arrayConfig = this._sectionConfig;
        const model = this._model;
        const propertyPath = arrayConfig.PropertyPath;
        
        if (!propertyPath) {
            console.error('Missing PropertyPath in array configuration:', arrayConfig);
            return document.createElement('div');
        }
        
        // Get array data from model
        const arrayData = ModelPathUtils.getValueFromObjectPath(model, propertyPath);
        if (!arrayData || !Array.isArray(arrayData)) {
            console.warn(`Property ${propertyPath} is not an array or is empty:`, arrayData);
            return document.createElement('div');
        }
        
        // Create array section container
        const section = document.createElement('div');
        section.className = 'array-section';
        
        // Create section header
        const sectionHeader = document.createElement('h3');
        sectionHeader.className = 'section-header';
        sectionHeader.textContent = arrayConfig.Label || this._modelPanel.formatLabel(propertyPath.split('.').pop());
        section.appendChild(sectionHeader);
        
        // Create table container
        const tableContainer = document.createElement('div');
        tableContainer.className = 'array-table-container';
        
        // Create table
        const table = document.createElement('table');
        table.className = 'array-table';
        
        // Create table header
        const thead = document.createElement('thead');
        const headerRow = document.createElement('tr');
        
        // Get display properties
        const displayProps = arrayConfig.DisplayProperties || [];
        
        // Create header cells
        displayProps.forEach(propConfig => {
            const th = document.createElement('th');
            th.textContent = propConfig.Label || this._modelPanel.formatLabel(propConfig.PropertyPath);
            headerRow.appendChild(th);
        });
        
        // Assemble header
        thead.appendChild(headerRow);
        table.appendChild(thead);
        
        // Create table body
        const tbody = document.createElement('tbody');
        
        // Create row for each array item
        arrayData.forEach((item, index) => {
            const row = document.createElement('tr');
            
            // Create cell for each display property
            displayProps.forEach(propConfig => {
                const propPath = propConfig.PropertyPath;
                const cell = document.createElement('td');
                
                // Get property value and determine its type
                const propValue = item[propPath];
                const propType = this._modelPanel.getType(propValue);
                
                // Create form field in cell
                const cellContainer = document.createElement('div');
                cellContainer.className = 'cell-content';
                
                // Create full path for binding
                const fullPath = `${propertyPath}[${index}].${propPath}`;
                
                // Create input based on property definition and pass the property config
                const input = this._createCellInput(propType, propValue, fullPath, propConfig);
                cellContainer.appendChild(input);
                cell.appendChild(cellContainer);
                row.appendChild(cell);
            });
            
            tbody.appendChild(row);
        });
        
        // Assemble table
        table.appendChild(tbody);
        tableContainer.appendChild(table);
        section.appendChild(tableContainer);
        
        return section;
    }
    
    /**
     * Create a cell input element based on property type
     * @param {string} propType - The property type
     * @param {*} propValue - The property value 
     * @param {string} fullPath - The full property path for binding
     * @param {Object} propConfig - The property configuration from the display properties
     * @returns {HTMLElement} The created input element
     * @private
     */
    _createCellInput(propType, propValue, fullPath, propConfig) {
        // Get property definition for read-only check
        let propDef = null;
        
        // For array items, we need to determine the class of the array items
        // by first getting the array property definition from the parent model
        if (this._model && this._sectionConfig && this._sectionConfig.PropertyPath && propConfig.PropertyPath) {
            // First, get the array property definition from the parent model
            const arrayPath = this._sectionConfig.PropertyPath;
            const arrayPropDef = this._getPropertyDefinition(this._model._className, arrayPath);
            
            if (arrayPropDef) {
                console.log(`Found array property definition for ${arrayPath}:`, arrayPropDef);
                
                propDef = this._getPropertyDefinition(arrayPropDef.Type, propConfig.PropertyPath);
            }
        }
        
        // Create input using centralized method
        const input = this._createPropertyInput(
            propType, 
            propValue, 
            { 
                isEditable: this._isPropertyEditable(propConfig, propDef) 
            }
        );
        
        // Add binding if path exists
        if (fullPath) {
            // Extract object path and property for binding
            const pathParts = fullPath.split('.');
            const property = pathParts.pop();
            const objectPath = pathParts.join('.');
            
            // Create binding using centralized method
            this._createBinding({
                model: this._model,
                objectPath: objectPath,
                property: property,
                view: input,
                parser: propType === 'number' ? val => parseFloat(val) : val => val
            });
            
            // Create dependent bindings if property config exists
            if (propConfig) {
                console.log('Creating dependent bindings for array item:', fullPath, propConfig);
                this._createDependentBindings(this._model, objectPath, propConfig, input);
            }
        }
        
        return input;
    }
}
