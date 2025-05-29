import { BaseComponent } from './BaseComponent.js';

// Add styles
const styles = `
/* Force light theme */
:root {
    color-scheme: light;
}

.model-panel {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
    border: 1px solid #e0e0e0;
    border-radius: 8px;
    background: white;
    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    display: flex;
    flex-direction: column;
    height: 100%;
    /* Prevent any scrolling on the panel itself */
    overflow: hidden;
    /* Reset any inherited color scheme */
    color-scheme: light;
    /* Ensure proper box sizing */
    box-sizing: border-box;
}

.panel-header {
    background-color: #f5f5f5;
    padding: 12px 16px;
    border-bottom: 1px solid #e0e0e0;
    font-weight: 500;
    font-size: 16px;
    color: #333;
}

.model-form {
    padding: 16px;
    /* Allow scrolling only when needed */
    overflow: auto;
    /* Take remaining space */
    flex: 1 1 auto;
    /* Ensure proper height calculation */
    height: calc(100% - 49px); /* Subtract header height */
    /* Hide scrollbar by default */
    scrollbar-width: none; /* Firefox */
    -ms-overflow-style: none; /* IE and Edge */
}

/* Show scrollbar only on hover */
.model-form:hover {
    scrollbar-width: thin; /* Firefox */
    -ms-overflow-style: -ms-autohiding-scrollbar; /* IE and Edge */
}

.model-form::-webkit-scrollbar {
    display: none; /* Chrome, Safari, Opera */
}

.model-form:hover::-webkit-scrollbar {
    display: block;
    width: 6px;
    height: 6px;
}

.model-form:hover::-webkit-scrollbar-thumb {
    background-color: rgba(0, 0, 0, 0.2);
    border-radius: 3px;
}

/* Custom scrollbar for webkit browsers */
.model-form::-webkit-scrollbar {
    width: 6px;
    height: 6px;
}

.model-form::-webkit-scrollbar-thumb {
    background-color: rgba(0, 0, 0, 0.2);
    border-radius: 3px;
}

.model-form::-webkit-scrollbar-track {
    background: transparent;
}

.form-group {
    margin-bottom: 16px;
}

.form-group label {
    display: block;
    margin-bottom: 6px;
    font-size: 14px;
    color: #555;
}

.form-group input[type="text"],
.form-group input[type="number"],
.form-group textarea,
.form-group select {
    width: 100%;
    padding: 8px 12px;
    border: 1px solid #ddd;
    border-radius: 4px;
    font-size: 14px;
    box-sizing: border-box;
}

.form-group textarea {
    min-height: 80px;
    resize: vertical;
}

.form-group input[type="checkbox"] {
    width: auto;
    margin-right: 8px;
}

.form-object {
    border: 1px solid #e0e0e0;
    border-radius: 4px;
    padding: 12px;
    margin-bottom: 16px;
}

.form-object legend {
    padding: 0 8px;
    font-weight: 500;
    color: #333;
}

.array-container {
    margin-top: 8px;
    border: 1px solid #e0e0e0;
    border-radius: 4px;
    overflow: hidden;
}

.array-table-container {
    max-height: 300px;
    overflow-y: auto;
    /* Custom scrollbar for table container */
    scrollbar-width: thin;
}

.array-table-container::-webkit-scrollbar {
    width: 6px;
    height: 6px;
}

.array-table-container::-webkit-scrollbar-thumb {
    background-color: rgba(0, 0, 0, 0.2);
    border-radius: 3px;
}

.array-table-container::-webkit-scrollbar-track {
    background: transparent;
}

table.array-table {
    width: 100%;
    border-collapse: collapse;
}

table.array-table th,
table.array-table td {
    padding: 8px 12px;
    text-align: left;
    border-bottom: 1px solid #e0e0e0;
}

table.array-table th {
    background-color: #f9f9f9;
    font-weight: 500;
    font-size: 13px;
    color: #555;
    position: sticky;
    top: 0;
    z-index: 1;
}

.empty-array {
    padding: 12px;
    color: #777;
    font-style: italic;
    text-align: center;
}

/* Disable dark mode for this component */
/* @media (prefers-color-scheme: dark) {
    .model-panel {
        background-color: white;
        border-color: #e0e0e0;
    }
    
    .panel-header {
        background-color: #f5f5f5;
        border-color: #e0e0e0;
        color: #333;
    }
    
    .form-group label {
        color: #555;
    }
    
    .form-group input[type="text"],
    .form-group input[type="number"],
    .form-group textarea,
    .form-group select {
        background-color: white;
        border-color: #ddd;
        color: #333;
    }
    
    .form-object {
        border-color: #e0e0e0;
    }
    
    .form-object legend {
        color: #333;
    }
    
    .array-container {
        border-color: #e0e0e0;
    }
    
    table.array-table th,
    table.array-table td {
        border-color: #e0e0e0;
    }
    
    table.array-table th {
        background-color: #f9f9f9;
        color: #555;
    }
} */
`;

// Add styles to the document if document is available (not in test environment)
if (typeof document !== 'undefined') {
  const styleElement = document.createElement('style');
  styleElement.textContent = styles;
  document.head.appendChild(styleElement);
}

/**
 * ModelPanel component for displaying form fields for model properties
 */
export class ModelPanel extends BaseComponent {
    /**
     * Create a new ModelPanel instance
     * @param {Object} view - The parent view instance
     */
    constructor(view) {
        super(view);
        this.createModelPanel();
        
        // Store component reference on element for layout access
        this.element.__component = this;
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
        // Clear existing form
        this.formElement.innerHTML = '';

        if (!model) {
            const emptyMessage = document.createElement('div');
            emptyMessage.className = 'empty-message';
            emptyMessage.textContent = 'No model data available';
            this.formElement.appendChild(emptyMessage);
            return;
        }


        // Build form from model
        this.buildForm(model, this.formElement);
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