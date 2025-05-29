import { BaseComponent } from './BaseComponent.js';

/**
 * Toolstrip component for providing buttons for different actions
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
    }

    /**
     * Add a button to the toolstrip
     * @param {Object} buttonConfig - Button configuration object
     * @param {string} buttonConfig.id - Button ID
     * @param {string} buttonConfig.label - Button label text
     * @param {Function} buttonConfig.onClick - Button click handler
     * @param {boolean} [buttonConfig.disabled=false] - Whether the button is disabled
     * @returns {HTMLElement} - The created button element
     */
    addButton(buttonConfig) {
        const { id, label, onClick, disabled = false } = buttonConfig;
        
        // Create button element
        const button = document.createElement('button');
        button.id = id;
        button.className = 'toolstrip-button';
        button.textContent = label;
        button.disabled = disabled;
        
        // Add click handler
        button.addEventListener('click', onClick);
        
        // Add to toolstrip
        this.element.appendChild(button);
        
        // Store button reference
        this.buttons.push({
            id,
            element: button,
            config: buttonConfig
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
    updateModel(model) {
        // This method can be used to enable/disable buttons based on model state
        // For now, we don't need to do anything here
    }
}