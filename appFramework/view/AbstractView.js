import { Layout } from './Layout.js';
import { Toolstrip } from './components/Toolstrip.js';
import { ModelPanel } from './components/ModelPanel.js';
import { ModelInspector } from './components/ModelInspector.js';
import { JSONViewer } from './components/JSONViewer.js';
import { LogConsole } from './components/LogConsole.js';
import { EventListener } from '../controller/EventListener.js';
import { EventTypes } from '../controller/EventTypes.js';

/**
 * View class that manages the application view and layout
 * Acts as a mediator between the layout and any external systems
 */
export class View extends EventListener {
    /**
     * Create a new View instance
     * @param {Object} options - Configuration options
     * @param {Object} options.app - The application instance (required)
     * @param {HTMLElement|string} [options.container=document.body] - Container element or selector to append the view to
     * @param {string} [options.title=''] - Title of the view
     */
    constructor(options = {}) {
        const { app, container = document.body, title = '' } = options;
        
        if (!app) {
            throw new Error('App instance is required');
        }
        
        super(app);
        
        /** @private */
        this._app = app;
        
        // Handle container option (can be element or selector)
        if (typeof container === 'string') {
            this.container = document.querySelector(container);
            if (!this.container) {
                console.warn(`Container element '${container}' not found, using document.body`);
                this.container = document.body;
            }
        } else {
            this.container = container;
        }
        
        /** @private */
        this.title = title;
        
        /** @private */
        this._initialized = false;
        
        // Create the main view element
        this.element = document.createElement('div');
        this.element.className = 'view';
        
        // Create layout instance
        this.layout = new Layout(this.element);
        
        // Append to container immediately
        this.container.appendChild(this.element);
    }
    
    /**
     * Get the events this view is subscribed to
     * @returns {Array<string>} Array of event types
     */
    getSubscribedEvents() {
        // Only include events that are actually defined in EventTypes
        return [
            EventTypes.CLIENT_MODEL_UPDATED,
            EventTypes.CLIENT_ERROR,
            EventTypes.SERVER_ERROR
            // CLIENT_WARNING and SERVER_WARNING are not defined in EventTypes
            // and were causing null/undefined values in the events array
        ];
    }

    /**
     * Handle client model updated event
     * @param {Object} event - The event object
     */
    handle_client_model_updated(event) {
        this.updateModel(event.Data);
    }
    
    /**
     * Handle client error event
     * @param {Object} event - The event object
     */
    handle_client_error(event) {
        this.log(`Client error: ${event.Message}`, 'error', event.data.Error);
    }
    
    /**
     * Handle server error event
     * @param {Object} event - The event object
     */
    handle_server_error(event) {
        this.log(`Server error: ${event.Message}`, 'error', event.data.Error);
    }
    
    /**
     * Get the application instance
     * @returns {Object} The application instance
     */
    getApp() {
        return this._app;
    }
    
    /**
     * Handle client warning event
     * @param {Object} event - The event object
     */
    handle_client_warning(event) {
        this.log(`Warning: ${event.Message}`, 'warn', event.data.Details);
    }
    
    /**
     * Handle server warning event
     * @param {Object} event - The event object
     */
    handle_server_warning(event) {
        this.log(`Server warning: ${event.Message}`, 'warn', event.data.Details);
    }

    /**
     * Initialize the view and its layout
     * @returns {Promise<void>}
     */
    async init() {
        if (this._initialized) {
            console.warn('View already initialized');
            return;
        }
        
        try {
            // Call parent's init to set up event subscriptions
            await super.init();
            
            // Set up the layout and components
            this._setupLayout();
            
            // Mark as initialized after successful setup
            this._initialized = true;
            
            // Log successful initialization
            this.log(`View initialized in container: ${this.container.tagName}${this.container.id ? `#${this.container.id}` : ''}${this.container.className ? `.${this.container.className.split(' ').join('.')}` : ''}`);
            
            return this;
        } catch (error) {
            console.error('Error initializing View:', error);
            this.log(`Error initializing view: ${error.message}`, 'error');
            throw error;
        }
    }
    
    /**
     * Set up the layout and components
     * Subclasses should override this to set up their specific components
     * and call _setComponent() to register them with the layout
     * @abstract
     * @protected
     */
    _setupLayout() {
        // This is a no-op in the base class
        // Subclasses should override this to set up their specific components
        // and use _setComponent() to add them to the layout
    }
    
    /**
     * Set a component in the layout
     * @param {string} position - The layout position ('header', 'main', 'left', 'right', 'bottom')
     * @param {HTMLElement} element - The component's root element
     * @protected
     */
    _setComponent(position, element) {
        if (!this.layout) {
            console.warn('Layout not initialized. Call super._setupLayout() first');
            return;
        }
        
        const methodName = `set${position.charAt(0).toUpperCase() + position.slice(1)}`;
        if (typeof this.layout[methodName] === 'function') {
            this.layout[methodName](element);
        } else {
            console.warn(`Invalid layout position: ${position}`);
        }
    }
    
    /**
     * Update the model by delegating to the layout
     * @param {Object} model - The model data to update with
     */
    updateModel(model) {
        // Delegate to layout which will update all components
        this.layout.updateModel(model);
        
        // Log the update
        this.log('Model updated', 'info');
    }
    
    /**
     * Helper method to log messages to the console component
     * @param {string} message - The message to log
     * @param {string} level - The log level (info, warn, error, debug)
     * @param {*} [details] - Optional additional details to log
     */
    log(message, level = 'info', details = null) {
        // If we have a log console component, use it
        if (this.layout?.getBottomContent) {
            const logConsoleElement = this.layout.getBottomContent().firstChild;
            if (logConsoleElement?.__component) {
                logConsoleElement.__component.log(message, level, details);
                return;
            }
        }
        
        // Fallback to console if no log console is available
        const consoleMethod = console[level] || console.log;
        const formattedMessage = `[${level.toUpperCase()}] ${message}`;
        if (details) {
            consoleMethod(formattedMessage, details);
        } else {
            consoleMethod(formattedMessage);
        }
    }
}
