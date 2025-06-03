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
     * Create a component binding that updates the entire component when any model property changes
     * @param {Function} updateCallback - Function to call when model changes, receives (model, changedPath)
     * @returns {Object} The created component binding
     */
    createComponentBinding(updateCallback) {
        if (!this._view) {
            console.error('Cannot create component binding: view not available');
            return null;
        }
        
        const app = this._view.getApp();
        if (!app) {
            console.error('Cannot create component binding: app not available');
            return null;
        }
        
        const bindingManager = app.getBindingManager();
        if (!bindingManager) {
            console.error('Cannot create component binding: binding manager not available');
            return null;
        }
        
        const model = app.getModel();
        if (!model) {
            console.error('Cannot create component binding: model not available');
            return null;
        }
        
        // Create the component binding
        const binding = bindingManager.createComponentBinding({
            model: model,
            path: '', // Root path to listen for all changes
            element: this.element,
            updateCallback: updateCallback,
            component: this
        });
        
        if (binding) {
            this._bindings.push(binding);
        }
        
        return binding;
    }
    
    /**
     * Remove all bindings created by this component
     */
    removeBindings() {
        console.log(`BaseComponent.removeBindings: Removing ${this._bindings.length} bindings`);
        
        if (!this._view) {
            console.error('Cannot remove bindings: view not available');
            return;
        }
        
        const app = this._view.getApp();
        if (!app) {
            console.error('Cannot remove bindings: app not available');
            return;
        }
        
        const bindingManager = app.getBindingManager();
        if (!bindingManager) {
            console.error('Cannot remove bindings: binding manager not available');
            return;
        }
        
        // Remove each binding
        this._bindings.forEach(binding => {
            bindingManager.removeBinding(binding);
        });
        
        // Clear the bindings array
        this._bindings = [];
        console.log('All bindings removed');
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
