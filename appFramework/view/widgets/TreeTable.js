/**
 * TreeTable widget for displaying hierarchical data in a table format
 * This is a reusable widget that can be used by components like ModelInspector
 */
export class TreeTable {
    /**
     * Create a new TreeTable instance
     * @param {Object} config - Configuration options
     * @param {string} [config.className='tree-table'] - CSS class name for the table
     * @param {Array} [config.columns=[]] - Column definitions
     * @param {boolean} [config.expandOnClick=true] - Whether to expand/collapse on row click
     */
    constructor(config = {}) {
        this.config = {
            className: 'tree-table',
            columns: [],
            expandOnClick: true,
            expandRoot: false, // New option to expand root node by default
            ...config
        };
        
        this.createTreeTable();
        this._expandedPaths = new Set(); // Track expanded paths
    }

    /**
     * Create the tree table DOM structure
     */
    createTreeTable() {
        // Create main container
        this.element = document.createElement('div');
        this.element.className = this.config.className;
        
        // Create table element
        this.tableElement = document.createElement('table');
        this.tableElement.className = `${this.config.className}-table`;
        
        // Create header if columns are defined
        if (this.config.columns && this.config.columns.length > 0) {
            const thead = document.createElement('thead');
            const headerRow = document.createElement('tr');
            
            // Add expand/collapse column
            const toggleHeader = document.createElement('th');
            toggleHeader.className = 'toggle-column';
            headerRow.appendChild(toggleHeader);
            
            // Add column headers
            this.config.columns.forEach(column => {
                const th = document.createElement('th');
                th.className = column.className || '';
                th.textContent = column.title || '';
                headerRow.appendChild(th);
            });
            
            thead.appendChild(headerRow);
            this.tableElement.appendChild(thead);
        }
        
        // Create table body
        this.tbody = document.createElement('tbody');
        this.tableElement.appendChild(this.tbody);
        
        // Add table to container
        this.element.appendChild(this.tableElement);
    }

    /**
     * Set the data for the tree table
     * @param {Object|Array} data - The hierarchical data to display
     * @param {Function} [nodeRenderer] - Optional custom renderer for node content
     */
    setData(data, nodeRenderer) {
        // Clear existing rows and expanded paths
        this.tbody.innerHTML = '';
        this._expandedPaths.clear();
        
        if (!data) {
            const emptyRow = document.createElement('tr');
            const emptyCell = document.createElement('td');
            emptyCell.colSpan = this.config.columns.length + 1;
            emptyCell.textContent = 'No data available';
            emptyCell.className = 'empty-message';
            emptyRow.appendChild(emptyCell);
            this.tbody.appendChild(emptyRow);
            return;
        }
        
        // Store the renderer for later use
        this._nodeRenderer = nodeRenderer;
        
        // Add a small delay to ensure DOM is ready
        setTimeout(() => {
            // Build tree rows
            if (Array.isArray(data)) {
                data.forEach((item, index) => {
                    const path = `[${index}]`;
                    if (this.config.expandRoot) {
                        this._expandedPaths.add(path);
                    }
                    this.addTreeNode(item, this.tbody, 0, path, nodeRenderer);
                });
                
                // Expand root nodes after they're added
                if (this.config.expandRoot) {
                    const rows = Array.from(this.tbody.querySelectorAll('tr'));
                    rows.forEach((row, index) => {
                        const path = `[${index}]`;
                        this.toggleNode(row, data[index], path, nodeRenderer);
                    });
                }
            } else {
                const path = 'root';
                if (this.config.expandRoot) {
                    this._expandedPaths.add(path);
                }
                this.addTreeNode(data, this.tbody, 0, path, nodeRenderer);
                
                // Expand root node after it's added
                if (this.config.expandRoot) {
                    const row = this.tbody.querySelector('tr');
                    if (row) {
                        // Use a small delay to ensure the row is fully rendered
                        setTimeout(() => {
                            this.toggleNode(row, data, path, nodeRenderer);
                        }, 0);
                    }
                }
            }
        }, 0);
    }

    /**
     * Add a tree node to the table
     * @param {Object|Array|*} node - The node data
     * @param {HTMLElement} container - The container to append the node to
     * @param {number} level - The nesting level
     * @param {string} path - The path to this node
     * @param {Function} [nodeRenderer] - Optional custom renderer for node content
     */
    addTreeNode(node, container, level, path, nodeRenderer) {
        const type = this.getType(node);
        const isExpandable = type === 'object' || type === 'array';
        
        // Create row
        const row = document.createElement('tr');
        row.className = `tree-row level-${level}`;
        row.dataset.level = level;
        row.dataset.path = path;
        row.dataset.type = type;
        
        // Store the node data as a JSON string in a data attribute
        try {
            row.dataset.nodeData = JSON.stringify(node);
        } catch (e) {
            console.warn('Could not stringify node data', e);
        }
        
        // Create toggle cell
        const toggleCell = document.createElement('td');
        toggleCell.className = 'toggle-cell';
        
        if (isExpandable) {
            const toggleIcon = document.createElement('span');
            toggleIcon.className = 'toggle-icon';
            
            // Set initial toggle state based on expanded paths
            if (this._expandedPaths.has(path)) {
                toggleIcon.textContent = '▼';
            } else {
                toggleIcon.textContent = '▶';
            }
            
            toggleCell.appendChild(toggleIcon);
            
            // Add click handler for expanding/collapsing
            if (this.config.expandOnClick) {
                toggleCell.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.toggleNode(row, node, path, nodeRenderer || this._nodeRenderer);
                });
            }
        }
        
        row.appendChild(toggleCell);
        
        // Use custom renderer if provided, otherwise use default rendering
        if (nodeRenderer) {
            nodeRenderer(row, node, path, level, type);
        } else {
            this.defaultNodeRenderer(row, node, path, level, type);
        }
        
        // Add row to container
        container.appendChild(row);
    }

    /**
     * Default renderer for tree nodes
     * @param {HTMLElement} row - The row element
     * @param {Object|Array|*} node - The node data
     * @param {string} path - The path to this node
     * @param {number} level - The nesting level
     * @param {string} type - The data type
     */
    defaultNodeRenderer(row, node, path, level, type) {
        // Extract the node name from the path
        const nodeName = path.split('.').pop();
        
        // Create name cell
        const nameCell = document.createElement('td');
        nameCell.className = 'name-cell';
        nameCell.textContent = nodeName;
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
     * Toggle a tree node expansion
     * @param {HTMLElement} row - The row element
     * @param {Object|Array} node - The node data
     * @param {string} path - The path to this node
     * @param {Function} [nodeRenderer] - Optional custom renderer for node content
     */
    toggleNode(row, node, path, nodeRenderer) {
        if (!row || !row.parentNode) return;
        
        const toggleIcon = row.querySelector('.toggle-icon');
        if (!toggleIcon) return;
        
        const isExpanded = toggleIcon.textContent === '▼';
        
        // Update expanded state first
        if (isExpanded) {
            this._expandedPaths.delete(path);
        } else {
            this._expandedPaths.add(path);
        }
        
        // Update the icon immediately for better UX
        toggleIcon.textContent = isExpanded ? '▶' : '▼';
        
        if (isExpanded) {
            // Collapse: remove child rows
            this.removeChildRows(row);
            toggleIcon.textContent = '▶';
        } else {
            // Expand: add child rows
            const level = parseInt(row.dataset.level || '0', 10) + 1;
            const type = this.getType(node);
            
            // Only proceed if this is an expandable type
            if (type !== 'object' && type !== 'array') {
                return;
            }
            
            // Create container for child rows
            const childContainer = document.createElement('tbody');
            childContainer.className = 'child-container';
            
            // Add child nodes
            if (type === 'array') {
                node.forEach((item, index) => {
                    this.addTreeNode(item, childContainer, level, `${path}[${index}]`, nodeRenderer);
                });
                
                if (node.length === 0) {
                    const emptyRow = document.createElement('tr');
                    emptyRow.className = `tree-row level-${level} empty-row`;
                    
                    const emptyToggleCell = document.createElement('td');
                    emptyRow.appendChild(emptyToggleCell);
                    
                    const emptyCell = document.createElement('td');
                    emptyCell.colSpan = this.config.columns.length;
                    emptyCell.textContent = '(empty array)';
                    emptyCell.className = 'empty-message';
                    emptyRow.appendChild(emptyCell);
                    
                    childContainer.appendChild(emptyRow);
                }
            } else if (type === 'object') {
                // Filter out private properties (those starting with _)
                const keys = Object.keys(node).filter(key => !key.startsWith('_'));
                
                keys.forEach(key => {
                    this.addTreeNode(node[key], childContainer, level, `${path}.${key}`, nodeRenderer);
                });
                
                if (keys.length === 0) {
                    const emptyRow = document.createElement('tr');
                    emptyRow.className = `tree-row level-${level} empty-row`;
                    
                    const emptyToggleCell = document.createElement('td');
                    emptyRow.appendChild(emptyToggleCell);
                    
                    const emptyCell = document.createElement('td');
                    emptyCell.colSpan = this.config.columns.length;
                    emptyCell.textContent = '(empty object)';
                    emptyCell.className = 'empty-message';
                    emptyRow.appendChild(emptyCell);
                    
                    childContainer.appendChild(emptyRow);
                }
            }
            
            // Insert child rows after the current row
            const rows = Array.from(childContainer.children);
            const nextRow = row.nextSibling;
            
            rows.forEach(childRow => {
                if (row.parentNode) {
                    row.parentNode.insertBefore(childRow, nextRow);
                    childRow.dataset.parent = path;
                }
            });
            
            // Update the toggle icon
            toggleIcon.textContent = '▼';
        }
    }

    /**
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
     * Remove all child rows of a parent row
     * @param {HTMLElement} parentRow - The parent row element
     */
    removeChildRows(parentRow) {
        if (!parentRow || !parentRow.nextSibling) return;
        
        const parentLevel = parseInt(parentRow.dataset.level || '0', 10);
        let currentRow = parentRow.nextSibling;
        const rowsToRemove = [];
        
        // First, collect all child rows to be removed
        while (currentRow) {
            const rowLevel = parseInt(currentRow.dataset.level || '0', 10);
            
            // If we hit a row at the same or higher level, we're done
            if (rowLevel <= parentLevel) {
                break;
            }
            
            // Add to removal list and move to next
            rowsToRemove.push(currentRow);
            currentRow = currentRow.nextSibling;
        }
        
        // Then remove them in reverse order to avoid DOM issues
        for (let i = rowsToRemove.length - 1; i >= 0; i--) {
            const row = rowsToRemove[i];
            if (row && row.parentNode) {
                row.parentNode.removeChild(row);
            }
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

    /**
     * Expand all nodes in the tree
     * @param {Function} [nodeRenderer] - Optional custom renderer for node content
     */
    expandAll(nodeRenderer) {
        // Start with the top-level rows
        const rows = Array.from(this.tbody.querySelectorAll('tr[data-level]'));
        
        // Process each row that can be expanded
        rows.forEach(row => {
            const toggleIcon = row.querySelector('.toggle-icon');
            const type = row.dataset.type;
            
            // Only expand if it's a collapsible type and currently collapsed
            if (toggleIcon && toggleIcon.textContent === '▶' && 
                (type === 'object' || type === 'array')) {
                
                // Get the node data from the row's data attributes
                const path = row.dataset.path;
                const level = parseInt(row.dataset.level || '0', 10);
                
                // Get the node data from the row's data attributes
                const nodeData = {};
                try {
                    // Try to parse the data from the row's data attributes
                    const dataStr = row.dataset.nodeData;
                    if (dataStr) {
                        const parsed = JSON.parse(dataStr);
                        Object.assign(nodeData, parsed);
                    }
                } catch (e) {
                    console.warn('Could not parse node data', e);
                }
                
                if (Object.keys(nodeData).length > 0) {
                    this.toggleNode(row, nodeData, path, nodeRenderer);
                }
            }
        });
    }

    /**
     * Collapse all nodes in the tree
     */
    collapseAll() {
        // Get all rows that can be collapsed
        const rows = Array.from(this.tbody.querySelectorAll('tr[data-level]'));
        
        // Process rows in reverse order to handle nested nodes correctly
        for (let i = rows.length - 1; i >= 0; i--) {
            const row = rows[i];
            const toggleIcon = row.querySelector('.toggle-icon');
            
            // Only collapse if it's currently expanded
            if (toggleIcon && toggleIcon.textContent === '▼') {
                this.removeChildRows(row);
                toggleIcon.textContent = '▶';
            }
        }
    }

    /**
     * Get data by path from the original data
     * @param {string} path - The path to the data
     * @returns {*} - The data at the path or null if not found
     */
    getDataByPath(path) {
        // This is a placeholder - in a real implementation, you would
        // need to store the original data and traverse it by path
        return null;
    }
}
