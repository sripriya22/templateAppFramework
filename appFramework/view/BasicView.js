import { View as AbstractView } from './AbstractView.js';
import { Toolstrip } from '../../appFramework/view/components/Toolstrip.js';
import { ModelPanel } from '../../appFramework/view/components/ModelPanel.js';
import { ModelInspector } from '../../appFramework/view/components/ModelInspector.js';
import { JSONViewer } from '../../appFramework/view/components/JSONViewer.js';
import { LogConsole } from '../../appFramework/view/components/LogConsole.js';

/**
 * Example app specific View implementation
 * Handles the layout and components specific to the example application
 */
export class BasicView extends AbstractView {
    /**
     * Create a new BasicView instance
     * @param {Object} options - Configuration options
     * @param {Object} options.app - The application instance (required)
     * @param {HTMLElement|string} [options.container=document.body] - Container element or selector to append the view to
     * @param {string} [options.title=''] - Title of the view
     * @param {Object} [options.componentConfigs={}] - Configuration objects for components
     */
    constructor(options = {}) {
        // Extract componentConfigs from options
        const { componentConfigs = {}, ...viewOptions } = options;
        
        // Call parent constructor with view options
        super(viewOptions);
        
        // Store component configurations
        this._componentConfigs = componentConfigs;
    }
    
    /**
     * Set up the layout and components specific to the example application
     * @private
     */
    _setupLayout() {
        try {
            // Call parent's _setupLayout first
            super._setupLayout();
            
            // Create components with configurations if available
            const toolstrip = new Toolstrip(this, this._componentConfigs.Toolstrip);
            const modelPanel = new ModelPanel(this, this._componentConfigs.ModelPanel);
            const modelInspector = new ModelInspector(this, this._componentConfigs.ModelInspector);
            const jsonViewer = new JSONViewer(this, this._componentConfigs.JSONViewer);
            const logConsole = new LogConsole(this, this._componentConfigs.LogConsole);
            
            // Store references to components
            this.components = {
                toolstrip,
                modelPanel,
                modelInspector,
                jsonViewer,
                logConsole
            };
            
            // Add components to layout using base class method
            this._setComponent('header', toolstrip.element);
            this._setComponent('main', modelPanel.element);
            this._setComponent('left', modelInspector.element);
            this._setComponent('right', jsonViewer.element);
            this._setComponent('bottom', logConsole.element);
            
            // Add test button to toolstrip
            toolstrip.addButton({
                id: 'load-model',
                label: 'Load Test Model',
                onClick: () => this._mockLoadModel()
            });
            
            // Log initialization
            this.log('App View initialized', 'info');
        } catch (error) {
            console.error('Error setting up App View layout:', error);
            throw error;
        }
    }
    
    /**
     * Load test model by calling the app's loadTestData method
     * @returns {Promise<void>}
     */
    async _mockLoadModel() {
        try {
            this.log('Loading test model...', 'info');
            
            if (this._app?.loadTestData) {
                await this._app.loadTestData();
                this.log('Test model loaded successfully', 'info');
            } else {
                throw new Error('App does not have a loadTestData method');
            }
        } catch (error) {
            const errorMessage = `Error loading test model: ${error.message}`;
            console.error(errorMessage, error);
            this.log(errorMessage, 'error', error);
        }
    }
}

// Export the BasicView class as default for backward compatibility
export default BasicView;
