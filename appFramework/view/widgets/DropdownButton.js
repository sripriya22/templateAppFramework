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
     * @param {string} [config.icon] - Optional icon class or URL for the main button
     * @param {Array} config.items - Array of menu items with label and onClick properties
     * @param {boolean} [config.disabled=false] - Whether the button is disabled
     * @param {string} [config.className] - Additional CSS class for styling
     */
    constructor(config) {
        this.config = config;
        this.id = config.id;
        this.element = null;
        this.button = null;
        this.menu = null;
        this.isOpen = false;
        this._boundClickHandler = this._handleClick.bind(this);
        this._boundDocumentClickHandler = this._handleDocumentClick.bind(this);
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
        
        // Create button element
        this.button = document.createElement('button');
        this.button.className = 'dropdown-button toolstrip-button';
        this.button.id = this.id;
        this.button.disabled = this.config.disabled || false;
        if (this.config.className) {
            this.button.classList.add(this.config.className);
        }
        
        // Add icon if provided
        if (this.config.icon) {
            const iconElement = document.createElement('span');
            iconElement.className = 'button-icon';
            
            // Check if icon is a URL or a class name
            if (this.config.icon.includes('/') || this.config.icon.includes('.')) {
                // It's a URL, create an image element
                const iconImg = document.createElement('img');
                iconImg.src = this.config.icon;
                iconImg.alt = '';
                iconElement.appendChild(iconImg);
            } else {
                // It's a class name or unicode
                iconElement.textContent = this.config.icon;
            }
            
            this.button.appendChild(iconElement);
        }
        
        // Create visible button label
        const buttonLabel = document.createElement('span');
        buttonLabel.className = 'button-label';
        buttonLabel.textContent = this.config.label;
        this.button.appendChild(buttonLabel);
        
        // Add dropdown indicator
        const indicator = document.createElement('span');
        indicator.className = 'dropdown-indicator';
        indicator.textContent = '▼';
        this.button.appendChild(indicator);
        
        // Create dropdown menu
        this.menu = document.createElement('div');
        this.menu.className = 'dropdown-menu';
        this.menu.style.display = 'none';
        
        // Add menu items
        if (this.config.items && Array.isArray(this.config.items)) {
            this.config.items.forEach((item, index) => {
                const menuItem = document.createElement('div');
                menuItem.className = 'dropdown-menu-item';
                menuItem.textContent = item.label;
                menuItem.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this._closeMenu();
                    if (typeof item.onClick === 'function') {
                        item.onClick();
                    }
                });
                this.menu.appendChild(menuItem);
            });
        }
        
        // Add click event listener to button
        this.button.addEventListener('click', this._boundClickHandler);
        
        // Add elements to container
        this.element.appendChild(this.button);
        this.element.appendChild(this.menu);
    }
    
    /**
     * Handle button click event
     * @param {Event} event - Click event
     * @private
     */
    _handleClick(event) {
        event.stopPropagation();
        if (this.config.disabled) return;
        
        if (this.isOpen) {
            this._closeMenu();
        } else {
            this._openMenu();
        }
    }
    
    /**
     * Handle document click to close menu when clicking outside
     * @param {Event} event - Click event
     * @private
     */
    _handleDocumentClick(event) {
        if (!this.element.contains(event.target)) {
            this._closeMenu();
        }
    }
    
    /**
     * Open the dropdown menu
     * @private
     */
    _openMenu() {
        if (this.config.disabled) return;
        
        this.isOpen = true;
        
        // Position the menu relative to the button
        const buttonRect = this.button.getBoundingClientRect();
        this.menu.style.position = 'fixed';
        this.menu.style.top = (buttonRect.bottom) + 'px';
        this.menu.style.left = buttonRect.left + 'px';
        this.menu.style.minWidth = buttonRect.width + 'px';
        
        this.menu.style.display = 'block';
        this.button.classList.add('menu-open');
        
        // Add document click listener to close menu when clicking outside
        document.addEventListener('click', this._boundDocumentClickHandler);
    }
    
    /**
     * Close the dropdown menu
     * @private
     */
    _closeMenu() {
        this.isOpen = false;
        this.menu.style.display = 'none';
        this.button.classList.remove('menu-open');
        
        // Remove document click listener
        document.removeEventListener('click', this._boundDocumentClickHandler);
    }
    
    /**
     * Set the disabled state of the dropdown
     * @param {boolean} disabled - Whether the dropdown should be disabled
     */
    setDisabled(disabled) {
        this.config.disabled = disabled;
        if (this.button) {
            this.button.disabled = disabled;
        }
        
        // Update visual state of the button
        if (this.button) {
            if (disabled) {
                this.button.classList.add('disabled');
            } else {
                this.button.classList.remove('disabled');
            }
        }
        
        // Close menu if disabled
        if (disabled && this.isOpen) {
            this._closeMenu();
        }
    }
    
    /**
     * Update the items in the dropdown
     * @param {Array} items - New array of menu items
     */
    updateItems(items) {
        if (!Array.isArray(items)) return;
        
        this.config.items = items;
        
        // Clear existing menu items
        this.menu.innerHTML = '';
        
        // Add new items
        items.forEach((item, index) => {
            const menuItem = document.createElement('div');
            menuItem.className = 'dropdown-menu-item';
            menuItem.textContent = item.label;
            menuItem.addEventListener('click', (e) => {
                e.stopPropagation();
                this._closeMenu();
                if (typeof item.onClick === 'function') {
                    item.onClick();
                }
            });
            this.menu.appendChild(menuItem);
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
        const buttonLabel = this.button.querySelector('.button-label');
        if (buttonLabel) {
            buttonLabel.textContent = label;
        }
    }
    
    /**
     * Clean up resources when the component is destroyed
     */
    destroy() {
        // Close menu if open
        if (this.isOpen) {
            this._closeMenu();
        }
        
        // Remove event listeners
        if (this.button) {
            this.button.removeEventListener('click', this._boundClickHandler);
        }
        
        // Remove document click listener if still attached
        document.removeEventListener('click', this._boundDocumentClickHandler);
        
        console.log(`DropdownButton ${this.id} - destroyed`);
    }
}
