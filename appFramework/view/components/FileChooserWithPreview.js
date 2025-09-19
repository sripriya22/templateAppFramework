import { BaseComponent } from './BaseComponent.js';
import { ModelPathUtils } from '../../utils/ModelPathUtils.js';
import { PropertyRenderUtils } from '../utils/PropertyRenderUtils.js';
import { EventTypes } from '../../controller/EventTypes.js';

/**
 * A widget that allows selecting a file with preview capability.
 * Features a read-only text input and two buttons - "Choose" and "Preview"
 */
export class FileChooserWithPreview extends BaseComponent {
    /**
     * Create a new FileChooserWithPreview
     * @param {Object} view - The view instance
     * @param {Object} options - Configuration options
     * @param {Object} options.model - The data model
     * @param {Array} options.propertyConfigs - Property configuration (should contain PropertyPath)
     * @param {string} [options.label] - Optional label for the widget
     * @param {PropertyRenderUtils} [options.utils] - Optional PropertyRenderUtils instance
     */
    constructor(view, options) {
        super(view);
        
        this._model = options.model;
        this._propertyConfigs = options.propertyConfigs || [];
        this._label = options.label || '';
        this._utils = options.utils || new PropertyRenderUtils(view);
        this._childComponents = [];
        this._bindings = [];
        
        // Validate property config
        if (!Array.isArray(this._propertyConfigs) || this._propertyConfigs.length === 0) {
            console.warn('FileChooserWithPreview requires at least one property configuration');
        }
        
        // Initialize the component
        this.element = this._createWidget();
    }
    
    /**
     * Create the file chooser widget UI with text input and buttons
     * @returns {HTMLElement} The widget container element
     * @private
     */
    _createWidget() {
        // Create the main container
        const container = document.createElement('div');
        container.className = 'form-group';
        
        // Get property config
        const propConfig = this._propertyConfigs[0];
        if (!propConfig) return container;
        
        const propPath = propConfig.PropertyPath;
        if (!propPath) {
            console.warn('No property path provided for file chooser');
            return container;
        }
        
        // Get property value from model
        const propValue = ModelPathUtils.getValueFromObjectPath(this._model, propPath);
        
        // Create label - use the one from propConfig
        const label = document.createElement('label');
        label.textContent = propConfig.Label || this._utils.formatLabel(propPath.split('.').pop());
        container.appendChild(label);
        
        // Create the widget group container
        const widgetGroup = document.createElement('div');
        widgetGroup.className = 'file-chooser-group';
        container.appendChild(widgetGroup);
        
        // Create text input field (readonly) with native tooltip
        const textField = document.createElement('input');
        textField.type = 'text';
        textField.className = 'file-path-input';
        textField.value = propValue || '';
        textField.readOnly = true;
        textField.title = propValue || '';  // Native browser tooltip
        widgetGroup.appendChild(textField);
        
        // Create Choose button
        const chooseBtn = document.createElement('button');
        chooseBtn.textContent = 'Choose';
        chooseBtn.className = 'file-chooser-button choose-button';
        chooseBtn.addEventListener('click', () => this._handleChooseClick(propPath));
        widgetGroup.appendChild(chooseBtn);
        
        // Create Preview button
        const previewBtn = document.createElement('button');
        previewBtn.textContent = 'Preview';
        previewBtn.className = 'file-chooser-button preview-button';
        previewBtn.addEventListener('click', () => this._handlePreviewClick(propPath));
        widgetGroup.appendChild(previewBtn);
        
        // Add binding for the text field
        const pathParts = propPath.split('.');
        const property = pathParts.pop();
        const objectPath = pathParts.join('.');
        
        // Create a custom formatter function to update the input value and tooltip
        const formatter = (value) => {
            // Update the input value
            textField.value = value || '';
            // Update the native tooltip
            textField.title = value || '';
            return value;
        };
        
        this._utils.createBinding({
            model: this._model,
            objectPath: objectPath,
            property: property,
            view: textField,
            formatter: formatter
        }, this);
        
        return container;
    }
    
    /**
     * Handle click on the Choose button
     * @param {string} propPath - Property path for the file
     * @private
     */
    _handleChooseClick(propPath) {
        const pathParts = propPath.split('.');
        const property = pathParts.pop();
        
        // Dispatch event to MATLAB to choose a file
        this._view.getApp().eventManager.dispatchEvent(EventTypes.MATLAB_METHOD_CALL_REQUEST, {
            MethodName: `choose${property}`,
            ObjectPath: '',
            Args: {},
            Callback: (response) => {
                if (response && !response.Error) {
                    // The MATLAB method should update the model property directly
                    console.log('File chosen successfully');
                } else {
                    const errorMsg = response && response.Error ? 
                        `${response.Error.id}: ${response.Error.message}` : 'Unknown error';
                    console.error(`Error choosing file: ${errorMsg}`);
                }
            }
        });
    }
    
    /**
     * Handle click on the Preview button
     * @param {string} propPath - Property path for the file
     * @private
     */
    _handlePreviewClick(propPath) {
        const pathParts = propPath.split('.');
        const property = pathParts.pop();
        
        // Dispatch event to MATLAB to preview a file
        this._view.getApp().eventManager.dispatchEvent(EventTypes.MATLAB_METHOD_CALL_REQUEST, {
            MethodName: `preview${property}`,
            ObjectPath: '',
            Args: {},
            Callback: (response) => {
                if (response && !response.Error) {
                    console.log('File preview initiated successfully');
                } else {
                    const errorMsg = response && response.Error ? 
                        `${response.Error.id}: ${response.Error.message}` : 'Unknown error';
                    console.error(`Error previewing file: ${errorMsg}`);
                }
            }
        });
    }
    
    /**
     * Clean up resources when the component is destroyed
     */
    destroy() {
        // Clean up any child components
        if (this._childComponents) {
            this._childComponents.forEach(component => {
                if (component && typeof component.destroy === 'function') {
                    component.destroy();
                }
            });
            this._childComponents = [];
        }
        
        // Call parent class destroy method
        super.destroy();
    }
}
