/**
 * BaseComponent class that all view components should inherit from
 */
export class BaseComponent {
    /**
     * Create a new BaseComponent instance
     * @param {Object} view - The parent view instance
     */
    constructor(view) {
        this._view = view;
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
}
