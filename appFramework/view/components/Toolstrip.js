import { BaseComponent } from './BaseComponent.js';
import { DropdownButton } from '../widgets/DropdownButton.js';

/**
 * Toolstrip component for providing buttons for different actions
 * @module Toolstrip
 */
export class Toolstrip extends BaseComponent {
    /**
     * Create a new Toolstrip instance
     * @param {Object} view - The parent view instance
     */
    constructor(view) {
        super(view);
        this.buttons = [];
        this.createToolstrip();
    }

    /**
     * Create the toolstrip DOM structure
     */
    createToolstrip() {
        this.element = document.createElement('div');
        this.element.className = 'toolstrip';
        
        // Load dropdown button styles
        if (!document.querySelector('link[href$="dropdown-button.css"]')) {
            const link = document.createElement('link');
            link.rel = 'stylesheet';
            
            // Use app's resource loading if available (for MATLAB environment)
            if (this._view && this._view.getApp && this._view.getApp()) {
                const app = this._view.getApp();
                if (app.isMatlabEnvironment && app.isMatlabEnvironment()) {
                    // In MATLAB, use the MatlabResourceLoader
                    const matlabBaseUrl = app.getMatlabBaseUrl();
                    // Ensure there's a trailing slash in the base URL
                    const baseUrlWithSlash = matlabBaseUrl.endsWith('/') ? matlabBaseUrl : `${matlabBaseUrl}/`;
                    link.href = `${baseUrlWithSlash}appFramework/view/styles/dropdown-button.css`;
                } else {
                    // In browser
                    link.href = '/appFramework/view/styles/dropdown-button.css';
                }
            } else {
                // Fallback to standard path
                link.href = '/appFramework/view/styles/dropdown-button.css';
            }
            
            document.head.appendChild(link);
        }
    }

    /**
     * Add a button to the toolstrip
     * @param {Object} buttonConfig - Button configuration object
     * @param {string} buttonConfig.id - Button ID
     * @param {string} buttonConfig.label - Button label text
     * @param {Function} buttonConfig.onClick - Button click handler
     * @param {string} [buttonConfig.icon] - Optional icon class or URL
     * @param {boolean} [buttonConfig.disabled=false] - Whether the button is disabled
     * @returns {HTMLElement} - The created button element
     */
    addButton(buttonConfig) {
        const { id, label, onClick, disabled = false, icon } = buttonConfig;
        
        // Create button element
        const button = document.createElement('button');
        button.id = id;
        button.className = 'toolstrip-button';
        button.disabled = disabled;
        
        // Add icon if provided
        if (icon) {
            const iconElement = document.createElement('span');
            iconElement.className = 'button-icon';
            
            // Check if the icon is a URL or a class name
            // Check for URL-like patterns or file paths
            if (icon.includes('/') || icon.includes('.')) {
                const iconImg = document.createElement('img');
                iconImg.src = icon;
                iconImg.alt = '';
                iconElement.appendChild(iconImg);
            } else {
                iconElement.classList.add(icon);
            }
            
            button.appendChild(iconElement);
        }
        
        // Add label
        const labelElement = document.createElement('span');
        labelElement.className = 'button-label';
        labelElement.textContent = label;
        button.appendChild(labelElement);
        
        // Add click handler
        button.addEventListener('click', onClick);
        
        // Add to toolstrip
        this.element.appendChild(button);
        
        // Store button reference
        this.buttons.push({
            id,
            element: button,
            config: buttonConfig,
            type: 'button'
        });
        
        return button;
    }

    /**
     * Get a button by its ID
     * @param {string} id - Button ID
     * @returns {HTMLElement|null} - The button element or null if not found
     */
    getButton(id) {
        const button = this.buttons.find(btn => btn.id === id);
        return button ? button.element : null;
    }

    /**
     * Enable or disable a button
     * @param {string} id - Button ID
     * @param {boolean} disabled - Whether to disable the button
     */
    setButtonDisabled(id, disabled) {
        const button = this.getButton(id);
        if (button) {
            button.disabled = disabled;
        }
    }

    /**
     * Update the toolstrip based on model changes
     * @param {Object} model - The model data
     */
    /**
     * Add a dropdown button to the toolstrip
     * @param {Object} buttonConfig - Button configuration object
     * @param {string} buttonConfig.id - Button ID
     * @param {string} buttonConfig.label - Button label text
     * @param {string} [buttonConfig.icon] - Optional icon class or URL
     * @param {Array} buttonConfig.items - Array of menu items
     * @param {boolean} [buttonConfig.disabled=false] - Whether the button is disabled
     * @returns {DropdownButton} - The created dropdown button instance
     */
    addDropdownButton(buttonConfig) {
        const { id } = buttonConfig;
        
        // Create dropdown button instance
        const dropdownButton = new DropdownButton(buttonConfig);
        
        // Add to toolstrip
        this.element.appendChild(dropdownButton.element);
        
        // Store button reference
        this.buttons.push({
            id,
            element: dropdownButton.element, // Store the DOM element reference
            instance: dropdownButton, // Keep the instance reference separately
            config: buttonConfig,
            type: 'dropdown'
        });
        
        return dropdownButton;
    }
    
    updateModel(model) {
        // This method can be used to enable/disable buttons based on model state
        // For now, we don't need to do anything here
    }
}