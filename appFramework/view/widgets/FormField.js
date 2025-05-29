/**
 * FormField widget for creating form input fields
 * This is a reusable widget that can be used by components like ModelPanel
 */
export class FormField {
    /**
     * Create a new FormField instance
     * @param {Object} config - Field configuration
     * @param {string} config.name - Field name/id
     * @param {string} config.label - Field label
     * @param {string} config.type - Field type (text, number, checkbox, etc.)
     * @param {*} config.value - Field value
     * @param {boolean} [config.readOnly=false] - Whether the field is read-only
     * @param {Function} [config.onChange] - Change event handler
     */
    constructor(config) {
        this.config = config;
        this.createField();
    }

    /**
     * Create the form field DOM structure
     */
    createField() {
        const { name, label, type, value, readOnly = false, onChange } = this.config;

        // Create container
        this.element = document.createElement('div');
        this.element.className = 'form-field';

        // Create label
        const labelElement = document.createElement('label');
        labelElement.textContent = label;
        labelElement.htmlFor = `field-${name}`;

        // Create input based on type
        this.input = this.createInput(type, name, value, readOnly);

        // Add change handler
        if (onChange && !readOnly) {
            this.input.addEventListener('change', (e) => {
                let newValue;
                if (type === 'checkbox') {
                    newValue = e.target.checked;
                } else if (type === 'number') {
                    newValue = parseFloat(e.target.value);
                } else {
                    newValue = e.target.value;
                }
                onChange(newValue, name);
            });
        }

        // Assemble field
        this.element.appendChild(labelElement);
        this.element.appendChild(this.input);
    }

    /**
     * Create an input element based on type
     * @param {string} type - Field type
     * @param {string} name - Field name/id
     * @param {*} value - Field value
     * @param {boolean} readOnly - Whether the field is read-only
     * @returns {HTMLElement} - The input element
     */
    createInput(type, name, value, readOnly) {
        let input;

        switch (type) {
            case 'checkbox':
                input = document.createElement('input');
                input.type = 'checkbox';
                input.checked = Boolean(value);
                break;
            case 'number':
                input = document.createElement('input');
                input.type = 'number';
                input.value = value !== undefined ? value : '';
                break;
            case 'textarea':
                input = document.createElement('textarea');
                input.rows = 3;
                input.value = value !== undefined ? String(value) : '';
                break;
            case 'select':
                input = document.createElement('select');
                if (this.config.options) {
                    this.config.options.forEach(option => {
                        const optionElement = document.createElement('option');
                        optionElement.value = option.value;
                        optionElement.textContent = option.label;
                        if (option.value === value) {
                            optionElement.selected = true;
                        }
                        input.appendChild(optionElement);
                    });
                }
                break;
            default:
                input = document.createElement('input');
                input.type = type || 'text';
                input.value = value !== undefined ? String(value) : '';
                break;
        }

        // Set common attributes
        input.id = `field-${name}`;
        input.name = name;
        input.readOnly = readOnly;
        if (readOnly) {
            input.classList.add('read-only');
        }

        return input;
    }

    /**
     * Get the current value of the field
     * @returns {*} - The field value
     */
    getValue() {
        const { type } = this.config;
        
        if (type === 'checkbox') {
            return this.input.checked;
        } else if (type === 'number') {
            return parseFloat(this.input.value);
        } else {
            return this.input.value;
        }
    }

    /**
     * Set the value of the field
     * @param {*} value - The new value
     */
    setValue(value) {
        const { type } = this.config;
        
        if (type === 'checkbox') {
            this.input.checked = Boolean(value);
        } else if (type === 'select') {
            this.input.value = value;
        } else {
            this.input.value = value !== undefined ? String(value) : '';
        }
    }

    /**
     * Set the read-only state of the field
     * @param {boolean} readOnly - Whether the field should be read-only
     */
    setReadOnly(readOnly) {
        this.input.readOnly = readOnly;
        if (readOnly) {
            this.input.classList.add('read-only');
        } else {
            this.input.classList.remove('read-only');
        }
    }
}
