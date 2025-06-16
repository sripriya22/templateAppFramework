/**
 * Component for rendering array data as a table
 * Refactored from ArrayPropertySection to be a standalone component that can be used
 * by PropertyGroupSection for array properties
 */
import { BaseComponent } from './BaseComponent.js';
import { ModelPathUtils } from '../../utils/ModelPathUtils.js';

export class ArrayTableComponent extends BaseComponent {
    /**
     * Create a new ArrayTableComponent instance
     * @param {Object} view - The parent view instance
     * @param {Object} options - Component options
     * @param {string} options.propertyPath - Path to the array property in the model
     * @param {Array<Object>} options.columns - Column configurations for the table
     * @param {Object} options.model - The model data
     * @param {string} [options.className] - Optional class name for the table container
     * @param {string} [options.title] - Optional title for the table
     * @param {Object} options.utils - PropertyRenderUtils instance
     */
    constructor(view, options) {
        super(view);
        this._propertyPath = options.propertyPath;
        this._columns = options.columns || [];
        this._model = options.model;
        this._title = options.title;
        this._className = options.className || '';
        this._utils = options.utils;
        
        // Create component DOM
        this.element = this._createArrayTable();
    }
    
    /**
     * Create array table element
     * @private
     * @returns {HTMLElement} The created table element
     */
    _createArrayTable() {
        // Create section container
        const container = document.createElement('div');
        container.className = `array-table-component ${this._className}`;
        
        // Add title if provided
        if (this._title) {
            const titleElement = document.createElement('h4');
            titleElement.className = 'array-table-title';
            titleElement.textContent = this._title;
            container.appendChild(titleElement);
        }
        
        // Create table
        const table = document.createElement('table');
        table.className = 'array-table';
        
        // Create header row
        table.appendChild(this._createTableHeader());
        
        // Get array data and create rows
        const arrayData = this._getArrayData();
        console.log('Array data:', arrayData);
        
        if (arrayData && Array.isArray(arrayData)) {
            // Create table body
            const tbody = document.createElement('tbody');
            
            // Create a row for each item
            arrayData.forEach((item, index) => {
                tbody.appendChild(this._createTableRow(item, index));
            });
            
            table.appendChild(tbody);
        } else {
            console.warn(`No array data found at path: ${this._propertyPath}`);
        }
        
        container.appendChild(table);
        return container;
    }
    
    /**
     * Create table header with column names
     * @private
     * @returns {HTMLElement} The created header element
     */
    _createTableHeader() {
        const thead = document.createElement('thead');
        const headerRow = document.createElement('tr');
        
        // Create header cells for each column
        this._columns.forEach(column => {
            const th = document.createElement('th');
            th.textContent = column.Label || this._utils.formatLabel(column.Key);
            headerRow.appendChild(th);
        });
        
        thead.appendChild(headerRow);
        return thead;
    }
    
    /**
     * Create a table row for an array item
     * @param {Object} item - The array item data
     * @param {number} rowIndex - The row index
     * @private
     * @returns {HTMLElement} The created row element
     */
    _createTableRow(item, rowIndex) {
        const tr = document.createElement('tr');
        
        // Create a cell for each column
        this._columns.forEach(column => {
            const cell = document.createElement('td');
            
            // For each cell, add the appropriate input based on property type
            cell.appendChild(this._createCellInput(item, column, rowIndex));
            
            tr.appendChild(cell);
        });
        
        return tr;
    }
    
    /**
     * Create input element for a table cell
     * @param {Object} rowItem - The row item data
     * @param {Object} column - Column configuration
     * @param {number} rowIndex - The row index
     * @private
     * @returns {HTMLElement} The created input element
     */
    _createCellInput(rowItem, column, rowIndex) {
        // Get the property value
        const propertyValue = rowItem[column.Key];
        
        // Get property type and definition
        let propType = column.Type;
        let isEditable = true;
        
        // Get model class name for property definitions
        const arrayPropDef = this._getArrayPropertyDefinition();
        
        // If we have a property definition, we can get the item class name
        if (arrayPropDef && arrayPropDef.Type) {
            const itemClassName = arrayPropDef.Type;
            
            // Get property definition for this specific cell
            const propDef = this._utils.getPropertyDefinition(itemClassName, column.Key);
            
            if (propDef) {
                // Use the property definition type if available
                propType = propType || this._utils.getPropertyType(propertyValue, propDef);
                
                // Check if the property is editable based on the readOnly flag in the definition
                isEditable = this._utils.isPropertyEditable(column, propDef);
            }
        }
        
        // If no type detected, try to determine type from the value
        if (!propType) {
            propType = this._utils.getPropertyType(propertyValue, null);
        }
        
        // Create the input element
        const input = this._utils.createPropertyInput(propType, propertyValue, { isEditable });
        
        // Create binding path for this cell
        const cellPath = `${this._propertyPath}[${rowIndex}].${column.Key}`;
        console.log(`Creating binding for cell: ${cellPath}`);
        
        // Create binding
        this._utils.createBinding({
            model: this._model,
            objectPath: `${this._propertyPath}[${rowIndex}]`,
            property: column.Key,
            view: input,
            viewAttribute: input.type === 'checkbox' ? 'checked' : 'value',
            viewEvent: 'input'
        }, this);
        
        // Create dependent bindings for editability, visibility, etc.
        if (column.Editable && typeof column.Editable === 'string') {
            this._utils.createEditabilityBinding(
                this._model,
                cellPath,
                column,
                input,
                this
            );
        }
        
        if (column.Visible && typeof column.Visible === 'string') {
            this._utils.createVisibilityBinding(
                this._model,
                cellPath,
                column,
                input,
                this
            );
        }
        
        return input;
    }
    
    /**
     * Get array property definition
     * @private
     * @returns {Object|null} The array property definition
     */
    _getArrayPropertyDefinition() {
        // Early validation to ensure we have the necessary properties
        if (!this._propertyPath) {
            console.error('No property path defined for array table');
            return null;
        }
        
        if (!this._utils) {
            console.error('PropertyRenderUtils not available in array table');
            return null;
        }
        
        if (!this._model) {
            console.error('Model not available in array table');
            return null;
        }
        
        // Extract class name from path (e.g., Parameters from Model.Parameters)
        const pathParts = this._propertyPath.split('.');
        let className = '';
        let propPath = pathParts[pathParts.length - 1]; // Always get the last part as property name
        
        try {
            // For top-level properties directly on the model (e.g., 'Parameters')
            if (pathParts.length === 1) {
                className = this._model._className;
            }// For nested properties (e.g., 'Model.SubModel.Parameters')
            else if (pathParts.length > 1) {
                // Get the parent path (everything except the last part)
                const parentPath = pathParts.slice(0, pathParts.length - 1).join('.');
                
                // Try to get the parent object
                try {
                    const parentObject = this._model[parentPath] || this._utils.getValueFromPath?.(this._model, parentPath);
                    if (parentObject && parentObject._className) {
                        className = parentObject._className;
                        console.log(`Found parent object class: ${className} for ${propPath}`);
                    }
                } catch (e) {
                    console.log(`Could not get parent object for ${parentPath}: ${e.message}`);
                }
            }
        } catch (err) {
            console.warn(`Error determining class: ${err}. Using ${className}`);
        }
        
        console.log(`Final class name for ${this._propertyPath}: ${className}, property: ${propPath}`);
        
        // If we have utils, try to get the property definition
        if (this._utils.getPropertyDefinition) {
            return this._utils.getPropertyDefinition(className, propPath);
        }
        
        return null;
    }
    
    /**
     * Get array data from model
     * @private
     * @returns {Array|null} The array data
     */
    _getArrayData() {
        console.log(`Getting array data for ${this._propertyPath}`);
        
        if (!this._model) {
            console.warn('Model not available to get array data');
            return null;
        }
        
        try {
            // Use the ModelPathUtils to get array data from the model directly
            return ModelPathUtils.getValueFromObjectPath(this._model, this._propertyPath);
        } catch (error) {
            console.error(`Error getting array data for ${this._propertyPath}:`, error);
            return null;
        }
    }
    
    /**
     * Update the component with model data
     * @param {Object} model - The model data
     */
    updateModel(model) {
        this._model = model;
        
        // Recreate the table with new model data
        const newElement = this._createArrayTable();
        
        // Replace old element with new one
        if (this.element && this.element.parentNode) {
            this.element.parentNode.replaceChild(newElement, this.element);
        }
        
        this.element = newElement;
        
        // Update dependent bindings
        if (this._utils) {
            this._utils.updateDependentBindings(this, model);
        }
    }
}
