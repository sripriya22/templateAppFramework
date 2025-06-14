import { BaseComponent } from './BaseComponent.js';

/**
 * Abstract base class for ModelPanel section components
 * Provides common functionality for all section types
 */
export class ModelPanelSection extends BaseComponent {
    /**
     * Create a new ModelPanelSection instance
     * @param {Object} modelPanel - The parent ModelPanel instance
     * @param {Object} sectionConfig - The section configuration
     * @param {Object} model - The model data
     */
    constructor(modelPanel, sectionConfig, model) {
        super(modelPanel._view);
        this._modelPanel = modelPanel;
        this._sectionConfig = sectionConfig;
        this._model = model;
        
        // Initialize the component element by calling the createSection method
        this.element = this._createSection();
    }
    
    /**
     * Create a section element based on configuration
     * This is an abstract method that must be implemented by derived classes
     * @returns {HTMLElement} The created section element
     * @protected
     */
    _createSection() {
        throw new Error('_createSection must be implemented by derived classes');
    }
    
    /**
     * Create section container with standard styling
     * @param {string} className - Additional class name for the section
     * @returns {HTMLElement} The created section container
     * @protected
     */
    _createSectionContainer(className = '') {
        const container = document.createElement('div');
        container.className = `model-panel-section ${className}`;
        return container;
    }
    
    /**
     * Create section header with standard styling
     * @param {string} title - The header title
     * @returns {HTMLElement} The created header element
     * @protected
     */
    _createSectionHeader(title) {
        const header = document.createElement('h3');
        header.className = 'section-header';
        header.textContent = title;
        return header;
    }
    
    /**
     * Sort configuration items by order if available
     * @param {Array} items - The items to sort
     * @returns {Array} The sorted items
     * @protected
     */
    _sortByOrder(items) {
        if (!items || !Array.isArray(items)) return [];
        return [...items].sort((a, b) => (a.Order || 0) - (b.Order || 0));
    }
}
