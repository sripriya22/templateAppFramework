/**
 * Dropdown Button Widget
 * A button that can display a dropdown menu when clicked
 */

export class DropdownButton {
    /**
     * Create a new DropdownButton instance
     * @param {Object} config - Button configuration
     * @param {string} config.id - Button ID
     * @param {string} config.label - Button label text
     * @param {Array} config.items - Array of menu items with label and onClick properties
     * @param {boolean} [config.disabled=false] - Whether the button is disabled
     * @param {string} [config.className] - Additional CSS class for styling
     */
    constructor(config) {
        this.config = config;
        this.id = config.id;
        this.element = null;
        this.select = null;
        this.buttonWrapper = null;
        this._boundChangeHandler = this._handleChange.bind(this);
        this._createDropdown();
    }

    /**
     * Create the dropdown element
     * @private
     */
    _createDropdown() {
        // Create container element
        this.element = document.createElement('div');
        this.element.className = 'dropdown-button-container';
        this.element.id = this.id + '-container';
        
        // Create button-like wrapper
        this.buttonWrapper = document.createElement('div');
        this.buttonWrapper.className = 'dropdown-button toolstrip-button has-menu';
        if (this.config.className) {
            this.buttonWrapper.classList.add(this.config.className);
        }
        
        // Create a native select element for maximum compatibility
        this.select = document.createElement('select');
        this.select.className = 'dropdown-select';
        this.select.id = this.id;
        this.select.disabled = this.config.disabled || false;
        
        // Style the select to be invisible but functional
        this.select.style.opacity = '0';
        this.select.style.position = 'absolute';
        this.select.style.width = '100%';
        this.select.style.height = '100%';
        this.select.style.left = '0';
        this.select.style.top = '0';
        this.select.style.cursor = 'pointer';
        
        // Add a default option that shows the label
        const defaultOption = document.createElement('option');
        defaultOption.textContent = this.config.label;
        defaultOption.value = '';
        defaultOption.selected = true;
        defaultOption.disabled = true;
        this.select.appendChild(defaultOption);
        
        // Add menu items as options
        if (this.config.items && Array.isArray(this.config.items)) {
            this.config.items.forEach((item, index) => {
                const option = document.createElement('option');
                option.textContent = item.label;
                option.value = index.toString();
                this.select.appendChild(option);
            });
        }
        
        // Create visible button label
        const buttonLabel = document.createElement('span');
        buttonLabel.className = 'button-label';
        buttonLabel.textContent = this.config.label;
        this.buttonWrapper.appendChild(buttonLabel);
        
        // Add change event listener
        this.select.addEventListener('change', this._boundChangeHandler);
        
        // Add select element to button wrapper
        this.buttonWrapper.appendChild(this.select);
        
        // Add button wrapper to container
        this.element.appendChild(this.buttonWrapper);
    }
    
    /**
     * Handle select change event
     * @param {Event} event - Change event
     * @private
     */
    _handleChange(event) {
        const selectedIndex = parseInt(this.select.value, 10);
        const selectedItem = this.config.items[selectedIndex];
        
        if (selectedItem && typeof selectedItem.onClick === 'function') {
            selectedItem.onClick();
        }
        
        // Reset to default option after action is performed
        setTimeout(() => {
            this.select.selectedIndex = 0;
        }, 0);
    }
    
    /**
     * Set the disabled state of the dropdown
     * @param {boolean} disabled - Whether the dropdown should be disabled
     */
    setDisabled(disabled) {
        this.config.disabled = disabled;
        if (this.select) {
            this.select.disabled = disabled;
        }
        
        // Update visual state of the button wrapper
        if (this.buttonWrapper) {
            if (disabled) {
                this.buttonWrapper.classList.add('disabled');
            } else {
                this.buttonWrapper.classList.remove('disabled');
            }
        }
    }
    
    /**
     * Update the items in the dropdown
     * @param {Array} items - New array of menu items
     */
    updateItems(items) {
        if (!Array.isArray(items)) return;
        
        this.config.items = items;
        
        // Remove all options except the first one (label)
        while (this.select.options.length > 1) {
            this.select.remove(1);
        }
        
        // Add new items
        items.forEach((item, index) => {
            const option = document.createElement('option');
            option.textContent = item.label;
            option.value = index.toString();
            this.select.appendChild(option);
        });
    }
    
    /**
     * Update the button label
     * @param {string} label - New label text
     */
    updateLabel(label) {
        if (!label) return;
        
        this.config.label = label;
        
        // Update the visible button label
        const buttonLabel = this.buttonWrapper.querySelector('.button-label');
        if (buttonLabel) {
            buttonLabel.textContent = label;
        }
        
        // Update the default option
        if (this.select && this.select.options.length > 0) {
            this.select.options[0].textContent = label;
        }
    }
    
    /**
     * Clean up resources when the component is destroyed
     */
    destroy() {
        // Remove event listeners
        if (this.select) {
            this.select.removeEventListener('change', this._boundChangeHandler);
        }
        
        console.log(`DropdownButton ${this.id} - destroyed`);
    }
}
