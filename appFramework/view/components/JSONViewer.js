import { BaseComponent } from './BaseComponent.js';

/**
 * JSONViewer component for displaying model data as formatted JSON
 */
export class JSONViewer extends BaseComponent {
    /**
     * Create a new JSONViewer instance
     * @param {Object} view - The parent view instance
     */
    constructor(view) {
        super(view);
        this.createJSONViewer();
        
        // Store component reference on element for layout access
        this.element.__component = this;
    }

    /**
     * Create the JSON viewer DOM structure
     */
    createJSONViewer() {
        // Create main container with same styling as ModelPanel
        this.element = document.createElement('div');
        this.element.className = 'model-panel';
        this.element.style.overflow = 'hidden';
        this.element.style.boxSizing = 'border-box';

        // Create header with same styling as ModelPanel
        const header = document.createElement('div');
        header.className = 'panel-header';
        header.textContent = 'Model JSON View';
        
        // Create content container with proper scrolling
        const contentWrapper = document.createElement('div');
        contentWrapper.className = 'model-form';
        contentWrapper.style.padding = '16px';
        contentWrapper.style.overflow = 'auto'; // Enable scrolling
        contentWrapper.style.boxSizing = 'border-box';
        contentWrapper.style.maxHeight = '100%'; // Ensure it doesn't overflow parent
        
        this.contentElement = document.createElement('pre');
        this.contentElement.className = 'json-content';
        this.contentElement.style.margin = '0';
        this.contentElement.style.whiteSpace = 'pre-wrap';
        this.contentElement.style.wordBreak = 'break-word';
        this.contentElement.style.fontFamily = 'monospace';
        this.contentElement.style.fontSize = '13px';
        this.contentElement.style.lineHeight = '1.5';

        // Assemble the component
        contentWrapper.appendChild(this.contentElement);
        this.element.appendChild(header);
        this.element.appendChild(contentWrapper);
        
        // Add JSON-specific styles
        this.addJSONStyles();
    }

    /**
     * Update the JSON viewer with new model data
     * @param {Object} model - The model data to display
     */
    updateModel(model) {
        if (!model) {
            this.contentElement.innerHTML = '<span class="json-null">null</span>';
            return;
        }

        try {
            // Format the JSON with 2-space indentation
            const formattedJson = JSON.stringify(model, null, 2);
            
            // Apply syntax highlighting
            this.contentElement.innerHTML = this.highlightJson(formattedJson);
        } catch (error) {
            this.contentElement.innerHTML = `<span class="json-error">Error formatting JSON: ${error.message}</span>`;
            console.error('Error formatting JSON:', error);
        }
    }

    /**
     * Apply syntax highlighting to JSON string
     * @param {string} json - The JSON string to highlight
     * @returns {string} - HTML with syntax highlighting
     */
    /**
     * Add JSON-specific styles
     */
    addJSONStyles() {
        const style = document.createElement('style');
        style.textContent = `
            .json-key { color: #881391; font-weight: 500; }
            .json-string { color: #c41a16; }
            .json-number { color: #1c00cf; font-weight: 500; }
            .json-boolean { color: #0d22aa; font-weight: 500; }
            .json-null { color: #666; font-style: italic; }
            .json-error { color: #c00; font-weight: 500; }
            
            /* Hide scrollbar by default, show on hover */
            .model-form {
                scrollbar-width: none; /* Firefox */
                -ms-overflow-style: none; /* IE and Edge */
                overflow: auto;
                max-height: 100%;
            }
            
            .model-form:hover {
                scrollbar-width: thin; /* Firefox */
                -ms-overflow-style: -ms-autohiding-scrollbar; /* IE and Edge */
            }
            
            .model-form::-webkit-scrollbar {
                display: none; /* Chrome, Safari, Opera */
                width: 6px;
                height: 6px;
            }
            
            .model-form:hover::-webkit-scrollbar {
                display: block;
            }
            
            .model-form::-webkit-scrollbar-thumb {
                background-color: transparent;
                border-radius: 3px;
            }
            
            .model-form:hover::-webkit-scrollbar-thumb {
                background-color: rgba(0, 0, 0, 0.2);
            }
        `;
        document.head.appendChild(style);
    }
    
    /**
     * Apply syntax highlighting to JSON string
     * @param {string} json - The JSON string to highlight
     * @returns {string} - HTML with syntax highlighting
     */
    highlightJson(json) {
        // Replace with syntax highlighting
        return json
            // Replace keys
            .replace(/"([^"]+)"\s*:/g, '"<span class="json-key">$1</span>":')
            // Replace string values
            .replace(/:\s*"([^"]+)"/g, ': "<span class="json-string">$1</span>"')
            // Replace numeric values
            .replace(/:\s*([\d\.]+)/g, ': <span class="json-number">$1</span>')
            // Replace boolean values
            .replace(/:\s*(true|false)/g, ': <span class="json-boolean">$1</span>')
            // Replace null values
            .replace(/:\s*(null)/g, ': <span class="json-null">$1</span>');
    }
}