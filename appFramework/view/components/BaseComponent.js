/**
 * BaseComponent class that all view components should inherit from
 */
export class BaseComponent {
    /**
     * Create a new BaseComponent instance
     * @param {Object} view - The parent view instance
     * @param {Object} [config] - Optional component configuration
     */
    constructor(view, config = null) {
        this._view = view;
        this._config = config;
        this._bindings = [];
        this.element = null;
    }

    /**
     * Update the component with model data
     * @param {Object} model - The model data
     */
    updateModel(model) {
        // To be implemented by subclasses
        throw new Error('updateModel method must be implemented by subclass');
    }
    
    /**
     * Create a binding between a model property and an element
     * @param {Object} options - Binding options
     * @param {Object} options.model - The model object to bind to
     * @param {string} options.path - The path to the model property
     * @param {HTMLElement} options.element - The DOM element to bind to
     * @param {string} [options.attribute='value'] - The element attribute to bind to
     * @param {Function} [options.formatter] - Optional formatter function
     * @param {Function} [options.parser] - Optional parser function
     * @returns {Object} The created binding
     */
    createBinding(options) {
        // Use proper method calls to access the binding manager
        // Component -> View -> App -> BindingManager
        if (!this._view) {
            console.error('Cannot create binding: view not available');
            return null;
        }
        
        const app = this._view.getApp();
        if (!app) {
            console.error('Cannot create binding: app not available');
            return null;
        }
        
        const bindingManager = app.getBindingManager();
        if (!bindingManager) {
            console.error('Cannot create binding: binding manager not available');
            return null;
        }
        
        const binding = bindingManager.createBinding(options);
        if (binding) {
            this._bindings.push(binding);
        }
        return binding;
    }
    
    /**
     * Remove all bindings created by this component
     */
    removeBindings() {
        if (!this._view || !this._view.app || !this._view.app.bindingManager) {
            return;
        }
        
        // Remove each binding
        this._bindings.forEach(binding => {
            this._view.app.bindingManager.removeBinding(binding);
        });
        
        // Clear the bindings array
        this._bindings = [];
    }
    
    /**
     * Clean up resources when the component is destroyed
     */
    destroy() {
        this.removeBindings();
        this._view = null;
        this._config = null;
        this.element = null;
    }
}
