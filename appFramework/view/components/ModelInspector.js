import { BaseComponent } from './BaseComponent.js';
import { TreeTable } from '../widgets/TreeTable.js';

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
        this.createModelInspector();
        
        // Store component reference on element for layout access
        this.element.__component = this;
    }

    /**
     * Create the model inspector DOM structure
     */
    createModelInspector() {
        // Create main container
        this.element = document.createElement('div');
        this.element.className = 'model-inspector';

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
        // Extract the node name from the path
        let nodeName = path;
        if (path.includes('.')) {
            nodeName = path.split('.').pop();
        } else if (path.includes('[')) {
            nodeName = path.match(/\[([^\]]+)\]$/)?.[0] || path;
        }

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