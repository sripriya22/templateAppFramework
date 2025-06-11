import { BaseComponent } from './BaseComponent.js';
import { TreeTable } from '../widgets/TreeTable.js';
import { ModelPathUtils } from '../../utils/ModelPathUtils.js';

/**
 * ModelInspector component for displaying a tree view of the model using TreeTable
 */
export class ModelInspector extends BaseComponent {
    /**
     * Create a new ModelInspector instance
     * @param {Object} view - The parent view instance
     */
    constructor(view) {
        super(view);
        
        // Create main container element first
        this.element = document.createElement('div');
        this.element.className = 'model-inspector';
        
        // Store component reference on element for layout access
        this.element.__component = this;
        
        // Now create the rest of the inspector
        this.createModelInspector();
    }

    /**
     * Create the model inspector DOM structure
     */
    createModelInspector() {
        // Main container is already created in the constructor

        // Create header
        const header = document.createElement('div');
        header.className = 'inspector-header';
        header.textContent = 'Model Inspector';

        // Create toolbar
        const toolbar = document.createElement('div');
        toolbar.className = 'inspector-toolbar';
        
        // Add expand/collapse all buttons
        const expandAllButton = document.createElement('button');
        expandAllButton.className = 'inspector-button';
        expandAllButton.textContent = 'Expand All';
        expandAllButton.addEventListener('click', () => this.treeTable && this.treeTable.expandAll());
        
        const collapseAllButton = document.createElement('button');
        collapseAllButton.className = 'inspector-button';
        collapseAllButton.textContent = 'Collapse All';
        collapseAllButton.addEventListener('click', () => this.treeTable && this.treeTable.collapseAll());
        
        toolbar.appendChild(expandAllButton);
        toolbar.appendChild(collapseAllButton);

        // Create tree table container
        const treeContainer = document.createElement('div');
        treeContainer.className = 'tree-container';

        // Create tree table
        this.treeTable = new TreeTable({
            className: 'model-tree-table',
            columns: [
                { title: 'Property', className: 'property-column' },
                { title: 'Type', className: 'type-column' },
                { title: 'Value', className: 'value-column' }
            ],
            expandOnClick: true,
            expandRoot: true // Expand root node by default
        });

        // Assemble the component
        this.element.appendChild(header);
        this.element.appendChild(toolbar);
        treeContainer.appendChild(this.treeTable.element);
        this.element.appendChild(treeContainer);
    }

    /**
     * Update the model inspector with new model data
     * @param {Object} model - The model data to display
     */
    updateModel(model) {
        if (!this.treeTable) return;

        if (!model) {
            this.treeTable.setData(null);
            return;
        }

        // Set data to tree table
        this.treeTable.setData(model, this.customNodeRenderer.bind(this));
        
        // Root node will be expanded automatically by TreeTable with expandRoot: true
        
        // Remove any existing bindings first
        this.removeBindings();
        
        // Get the app and model through the view
        const app = this._view.getApp();
        if (!app) {
            console.error('Cannot create component binding: app not available');
            return;
        }
        // Ensure we have a valid element before creating the binding
        if (!this.element) {
            console.error('Cannot create component binding: element not available');
            return;
        }
        
        // Create a component binding to update specific tree nodes when model properties change
        // This follows the binding architecture without storing model references in the component
        this.createComponentBinding((currentModel, changedPath) => {
            console.log(`ModelInspector: Model property changed: ${changedPath}`);
            
            // Find the node in the tree table that corresponds to the changed path
            const node = this.treeTable.findNodeByPath(changedPath);
            
            if (node) {
                // If we found the node, just update that specific node
                this._updateNodeInTreeTable(node, currentModel.getRootInstance(), changedPath);
            } else {
                // If we couldn't find the node (might be a new property), refresh the entire tree
                this.treeTable.setData(currentModel.getRootInstance(), this.customNodeRenderer.bind(this));
            }
        });
    }

    /**
     * Custom renderer for tree table nodes
     * @param {HTMLElement} row - The row element
     * @param {Object|Array|*} node - The node data
     * @param {string} path - The path to this node
     * @param {number} level - The nesting level
     * @param {string} type - The data type
     */
    customNodeRenderer(row, node, path, level, type) {
        // Extract the node name from the path using standardized path utilities
        // No fallbacks - path must be valid and parsable by ModelPathUtils
        const { segments } = ModelPathUtils.parseObjectPath(path);
        
        // Get the last segment as the node name
        // If no segments exist or path is invalid, this is a structural error that should be fixed at the source
        const nodeName = segments[segments.length - 1] || path;

        // Create name cell with proper indentation
        const nameCell = document.createElement('td');
        nameCell.className = 'name-cell';
        
        // Add indentation based on level
        if (level > 0) {
            const indent = document.createElement('span');
            indent.className = 'tree-indent';
            indent.style.paddingLeft = `${level * 20}px`;
            nameCell.appendChild(indent);
        }
        
        const nameText = document.createElement('span');
        nameText.textContent = nodeName;
        nameCell.appendChild(nameText);
        row.appendChild(nameCell);
        
        // Create type cell
        const typeCell = document.createElement('td');
        typeCell.className = 'type-cell';
        typeCell.textContent = type;
        row.appendChild(typeCell);
        
        // Create value cell
        const valueCell = document.createElement('td');
        valueCell.className = 'value-cell';
        
        if (type === 'object') {
            valueCell.textContent = '{...}';
        } else if (type === 'array') {
            valueCell.textContent = `[${node.length}]`;
        } else {
            valueCell.textContent = this.formatValue(node, type);
            valueCell.className += ` type-${type}`;
        }
        
        row.appendChild(valueCell);
    }

    /**
     * Update a specific node in the tree table
     * @param {Object} node - The tree table node
     * @param {Object} model - The current model
     * @param {string} path - The path to the changed property
     * @private
     */
    _updateNodeInTreeTable(node, model, path) {
        if (!node || !node.row) {
            console.warn(`Node not found or invalid for path: ${path}`);
            return;
        }
        
        try {
            // Get the updated value from the model using the standardized path utilities
            // No fallbacks - path must be valid and parsable by ModelPathUtils
            const value = ModelPathUtils.getValueFromObjectPath(model, path);
            
            // If value is undefined, this is an error that should be fixed at the source
            if (value === undefined) {
                throw new Error(`Value not found for path: ${path}`);
            }
            
            // Get the type of the value
            let type = 'undefined';
            if (value === null) {
                type = 'null';
            } else if (Array.isArray(value)) {
                type = 'array';
            } else if (value instanceof Date) {
                type = 'date';
            } else {
                type = typeof value;
            }
            
            // Update the type cell
            const typeCell = node.row.querySelector('.type-cell');
            if (typeCell) {
                typeCell.textContent = type;
            }
            
            // Update the value cell
            const valueCell = node.row.querySelector('.value-cell');
            if (valueCell) {
                if (type === 'object') {
                    valueCell.textContent = '{...}';
                } else if (type === 'array') {
                    valueCell.textContent = `[${value.length}]`;
                } else {
                    valueCell.textContent = this.formatValue(value, type);
                    valueCell.className = `value-cell type-${type}`;
                }
                console.log(`Updated value cell for path ${path} with value:`, value);
            }
        } catch (error) {
            console.error(`Error updating node for path ${path}:`, error);
        }
    }
    
    /**
     * Format a value for display
     * @param {*} value - The value to format
     * @param {string} type - The type of the value
     * @returns {string} - The formatted value
     */
    formatValue(value, type) {
        switch (type) {
            case 'string':
                return `"${value}"`;
            case 'null':
            case 'undefined':
                return type;
            case 'date':
                return value.toISOString();
            default:
                return String(value);
        }
    }
}