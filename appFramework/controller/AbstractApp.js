/**
 * AbstractApp - Base application class that coordinates between models, views, and the MATLAB HTML component
 * Provides abstract methods for creating model and view instances
 */
import { EventManager } from './EventManager.js';
import { ClientModel } from '../model/ClientModel.js';
import { MockMATLABComponent } from './MockMATLABComponent.js';
import { EventTypes } from './EventTypes.js';
import { BindingManager } from '../binding/BindingManager.js';

/**
 * Abstract base class for applications
 * Manages the application lifecycle and coordinates between models and views
 */
export class AbstractApp {
  /**
   * Get the default client-side event subscriptions for the app
   * @returns {string[]} Array of client event types to subscribe to
   */
  static getDefaultClientSubscriptions() {
    return [
      EventTypes.CLIENT_ERROR
    ];
  }

  /**
   * Get the default server-side event subscriptions for the app
   * @returns {string[]} Array of server event types to subscribe to
   */
  static getDefaultServerSubscriptions() {
    return [
      EventTypes.SERVER_ERROR
    ];
  }

  /**
   * Create a new AbstractApp instance
   */
  constructor() {
    /** @private */
    this._eventManager = new EventManager();
    
    /** @private */
    this._model = null;
    
    /** @private */
    this._view = null;
    
    /** @private */
    this._htmlComponent = null;
    
    /** @private */
    this._initialized = false;
    
    /** @private */
    this._htmlComponentPromise = null;
    
    /** @private */
    this._htmlComponentResolver = null;
    
    /** @private */
    this._initializationPromise = null;
    
    /** @private */
    this._bindingManager = null;
    
    // Bind methods
    this._onServerEvent = this._onServerEvent.bind(this);
    this._onClientEvent = this._onClientEvent.bind(this);
    this.waitForHtmlComponent = this.waitForHtmlComponent.bind(this);
    
    // Start waiting for HTML component immediately
    this._initializeApp();
  }

  /**
   * Abstract method to create the model instance
   * Must be implemented by subclasses
   * @returns {ClientModel} The model instance
   * @abstract
   * @protected
   */
  getRootClassName() {
    throw new Error('getRootClassName() must be implemented by subclasses');
  }

  getRootFolderPath() {
    // relative to server root
    throw new Error('getRootFolderPath() must be implemented by subclasses');
  }

  getAppTitle() {
    throw new Error('getAppTitle() must be implemented by subclasses');
  }


  
    /**
     * Create the model instance - override to use a custom model class
     * @returns {ClientModel} The model instance
     * @protected
     */
    createModel() {
      // Uncomment and modify to use a custom model class
      // return new CustomModel({ app: this });
      
      // The current directory is the directory containing the index.html file
      // We don't need to include the directory name in the path since we're already in it
      return new ClientModel({
        app: this,
        rootClassName: this.getRootClassName(),
        rootFolderPath: this.getRootFolderPath()
      });
    }

  /**
   * Create the view instance - can be overridden by subclasses
   * @returns {Promise<View>|View} The view instance or a promise that resolves to the view instance
   * @protected
   */
  createView() {
    // The View constructor expects an options object with app and container
    return new View({
      app: this,
      container: '#app',
      title: this.getAppTitle()
    });
  }

  /**
   * Internal method to handle app initialization flow
   * @private
   */
  async _initializeApp() {
    // Prevent multiple initializations
    if (this._initializationPromise) {
      return this._initializationPromise;
    }

    this._initializationPromise = (async () => {
      try {
        // Wait for HTML component with timeout (1000ms)
        console.log('Waiting for HTML component (1s timeout)...');
        
        try {
          await this.waitForHtmlComponent(1000);
          console.log('HTML component received, initializing app...');
          // If we get here, we're connected to MATLAB
          await this._initApp();
        } catch (error) {
          console.log('No HTML component received, initializing mock component...');
          if (this.initializeMockComponent) {
            await this.initializeMockComponent();
            await this._initApp();
          } else {
            throw new Error('No HTML component available and no mock component implementation');
          }
        }
      } catch (error) {
        console.error('Error during app initialization:', error);
        throw error;
      } finally {
        // Clear the initialization promise when done
        this._initializationPromise = null;
      }
    })();

    return this._initializationPromise;
  }

  /**
   * Initialize the application components
   * @private
   */
  async _initApp() {
    try {
      // Create model
      this._model = this.createModel();
      console.log('Model created');
      
      // Initialize model
      await this._model.init();
      console.log('Model initialized');
      
      // Create binding manager
      this._bindingManager = new BindingManager({ app: this });
      console.log('Binding manager created');
      
      // Create view (which may return a Promise)
      const viewResult = this.createView();
      
      // Handle both synchronous and asynchronous view creation
      this._view = viewResult instanceof Promise ? await viewResult : viewResult;
      console.log('View created');
      
      // Initialize view
      await this._view.init();
      console.log('View initialized');
      
      // Set up event subscriptions
      this._setupEventSubscriptions();
      console.log('Event subscriptions set up');
      
      // Mark as initialized
      this._initialized = true;
      console.log('App initialized successfully');
      
      // Dispatch initialization event
      // Note: We don't need to manually add timestamp as our enhanced EventTypes.create method adds it automatically
      this.dispatchClientEvent(EventTypes.APP_INITIALIZED, {
        appName: this.constructor.name,
        version: this.version || '1.0.0'
      });
      console.log('App initialized successfully');
    } catch (error) {
      console.error('Error initializing app:', error);
      throw error;
    }
  }
  
  /**
   * Initialize the HTML component, either from provided instance or create a mock
   * @param {Object} [htmlComponent] - Optional HTML component instance
   * @private
   */
  async _initHTMLComponent(htmlComponent) {
    if (htmlComponent) {
      this._htmlComponent = htmlComponent;
    } else {
      // Wait for MATLAB connection with timeout (2 seconds)
      const timeout = 2000;
      const startTime = Date.now();
      
      while (!this._htmlComponent && (Date.now() - startTime) < timeout) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      if (!this._htmlComponent) {
        console.log('No HTML component provided, using mock');
        this._htmlComponent = new MockMATLABComponent({
          onDataRequested: this._onDataRequested.bind(this),
          onDataReceived: this._onDataReceived.bind(this),
          onError: this._onError.bind(this)
        });
      }
    }
  }
  
  /**
   * Check if connected to the server
   * @returns {boolean} True if connected, false otherwise
   * @private
   */
  _isConnectedToServer() {
    return this._htmlComponent && this._htmlComponent.isConnected && this._htmlComponent.isConnected();
  }
  
  /**
   * Find the first JSON file in the resources directory
   * @private
   * @returns {Promise<string>} Path to the first JSON file found
   * @throws {Error} If no JSON file is found
   */
  async _findFirstJsonFile() {
    try {
      // In a real app, we would use the File System Access API or similar
      // For now, we'll assume the file is in the standard location
      const response = await fetch('resources/');
      if (!response.ok) {
        throw new Error('Failed to read resources directory');
      }
      
      // Parse the directory listing (this is a simplified example)
      // In a real app, you'd need to parse the HTML response or use a different approach
      const html = await response.text();
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');
      
      // Find all links in the directory listing
      const links = Array.from(doc.querySelectorAll('a'))
        .map(a => a.getAttribute('href'))
        .filter(href => href.endsWith('.json'));
      
      if (links.length === 0) {
        throw new Error('No JSON files found in resources directory');
      }
      
      // Get the first JSON file found
      const jsonFile = links[0];
      
      // Ensure we have a valid path (handle both relative and absolute paths)
      if (jsonFile.startsWith('http') || jsonFile.startsWith('/')) {
        return jsonFile;
      }
      
      // For relative paths, ensure we don't duplicate 'resources/'
      return jsonFile.startsWith('resources/') ? jsonFile : `resources/${jsonFile}`;
    } catch (error) {
      console.error('Error finding JSON file:', error);
      throw new Error('Failed to find a JSON file in resources directory');
    }
  }
  
  /**
   * Initialize the mock component when not running in MATLAB
   * @returns {Promise<void>}
   */
  async initializeMockComponent() {
    // Empty implementation - can be overridden by subclasses
    console.log('Initializing mock component');
    return Promise.resolve();
  }

  /**
   * Dispatch a client event
   * @param {string} eventType - The type of event
   * @param {Object} data - Event data (will be validated against the event type schema)
   */
  dispatchClientEvent(eventType, data = {}) {
    if (this._eventManager) {
      this._eventManager.dispatchEvent(eventType, data);
    } else {
      console.warn(`Event manager not initialized. Cannot dispatch event: ${eventType}`);
    }
  }

  /**
   * Load test data when not connected to server
   * @private
   */
  async loadTestData() {
    try {
      // Find and load the first JSON file in resources
      const jsonFilePath = await this._findFirstJsonFile();
      const response = await fetch(jsonFilePath);
      
      if (!response.ok) {
        throw new Error(`Failed to load test data from ${jsonFilePath}`);
      }
      
      const testData = await response.json();
      
      // Dispatch server model updated event - ClientModel will handle this and dispatch CLIENT_MODEL_UPDATED
      this.dispatchClientEvent(
        EventTypes.SERVER_MODEL_UPDATED,
        { 
          Data: testData
        }
      );
      console.log('Dispatched SERVER_MODEL_UPDATED event with test data');
    } catch (error) {
      console.error('Error loading test data:', error);
      this.dispatchClientEvent(
        EventTypes.CLIENT_ERROR,
        {
          ID: 'load-test-data-failed',
          Message: 'Failed to load test data',
          Error: error.message
        },
        'test-data-loader'
      );
    }
  }

  /**
   * Wait for the HTML component to be set
   * @param {number} timeoutMs - Timeout in milliseconds
   * @returns {Promise<HTMLElement>} The HTML component
   */
  waitForHtmlComponent(timeoutMs = 1000) {
    if (this._htmlComponent) {
      return Promise.resolve(this._htmlComponent);
    }

    if (!this._htmlComponentPromise) {
      this._htmlComponentPromise = new Promise((resolve, reject) => {
        this._htmlComponentResolver = resolve;
        
        // Set timeout
        if (timeoutMs > 0) {
          setTimeout(() => {
            if (!this._htmlComponent) {
              reject(new Error(`Timed out waiting for HTML component after ${timeoutMs}ms`));
              this._htmlComponentPromise = null;
              this._htmlComponentResolver = null;
            }
          }, timeoutMs);
        }
      });
    }

    return this._htmlComponentPromise;
  }

  /**
   * Set up event subscriptions
   * @private
   */
  _setupEventSubscriptions() {
    // Subscribe to client events
    this.constructor.getDefaultClientSubscriptions().forEach(eventType => {
      this._eventManager.addEventListener(eventType, (data) => {
        this._onClientEvent(eventType, data);
      });
    });

    // Subscribe to server events
    this.constructor.getDefaultServerSubscriptions().forEach(eventType => {
      this._eventManager.addEventListener(eventType, (data) => {
        this._onServerEvent(eventType, data);
      });
    });
  }
  
  /**
   * Handle a client event
   * @param {string} eventType - The type of event
   * @param {Object} eventData - The event data (passed directly from dispatchEvent)
   * @private
   */
  _onClientEvent(eventType, eventData) {
    try {
      // Convert event type to handler method name (e.g., 'CLIENT_ERROR' -> 'handle_client_error')
      const handlerName = `handle_${eventType.toLowerCase()}`;
      
      // Call the handler if it exists
      if (typeof this[handlerName] === 'function') {
        // Pass the event data directly to the handler
        // The source is now included in the event data as _source if it was provided
        this[handlerName](eventData);
      }
    } catch (error) {
      console.error(`Error in client event handler for ${eventType}:`, error);
      // Dispatch error event but prevent infinite loops
      if (eventType !== EventTypes.CLIENT_ERROR) {
        this.dispatchClientEvent(EventTypes.CLIENT_ERROR, {
          ID: 'EVENT_HANDLER_ERROR',
          Message: `Error handling ${eventType} event`,
          Error: error.message,
          Stack: error.stack
        });
      }
    }
  }

  /**
   * Handle a server event
   * @param {string} eventType - The type of event
   * @param {Object} eventData - The event data (passed directly from dispatchEvent)
   * @private
   */
  _onServerEvent(eventType, eventData) {
    try {
      // Convert event type to handler method name (e.g., 'SERVER_ERROR' -> 'handle_server_error')
      const handlerName = `handle_${eventType.toLowerCase()}`;
      
      // Call the handler if it exists
      if (typeof this[handlerName] === 'function') {
        // Pass the event data directly to the handler
        // The source is now included in the event data as _source if it was provided
        this[handlerName](eventData);
      }
    } catch (error) {
      console.error(`Error in server event handler for ${eventType}:`, error);
      // Dispatch error event but prevent infinite loops
      if (eventType !== EventTypes.CLIENT_ERROR) {
        this.dispatchClientEvent(EventTypes.CLIENT_ERROR, {
          ID: 'SERVER_EVENT_HANDLER_ERROR',
          Message: `Error handling server event: ${eventType}`,
          Error: error.message,
          Stack: error.stack
        });
      }
    }
  }

  /**
   * Handle a data request from the server
   * @param {Object} request - The data request
   * @private
   */
  _handleDataRequest(request) {
    try {
      const { type, uid, params } = request;
      let response;
      
      if (this._model) {
        switch (type) {
          case 'getModel':
            response = this._model.getModelData?.(params);
            break;
          case 'getAllInstances':
            response = this._model.getAllInstances?.(params?.className);
            break;
          case 'getInstance':
            response = this._model.getInstance?.(uid);
            break;
          default:
            throw new Error(`Unknown request type: ${type}`);
        }
      } else {
        throw new Error('Model not initialized');
      }
      
      this._sendToServer({
        type: `${type}Response`,
        uid: request.uid,
        data: response
      });
      
    } catch (error) {
      console.error('Error handling data request:', error);
      this._sendToServer({
        type: 'error',
        uid: request?.uid,
        error: error.message
      });
    }
  }

  /**
   * Send a message to the server
   * @param {Object} message - The message to send
   * @protected
   */
  _sendToServer(message) {
    if (!this._htmlComponent) {
      console.warn('Cannot send message: HTML component not available');
      return;
    }
    
    try {
      if (this._htmlComponent.sendMessageToMATLAB) {
        this._htmlComponent.sendMessageToMATLAB(JSON.stringify(message));
      } else if (this._htmlComponent.postMessage) {
        this._htmlComponent.postMessage(message, '*');
      } else {
        console.warn('No method available to send message to server');
      }
    } catch (error) {
      console.error('Error sending message to server:', error);
    }
  }

  // Public API
  
  /**
   * Get the event manager instance
   * @returns {EventManager} The event manager
   */
  get eventManager() {
    return this._eventManager;
  }
  
  /**
   * Get the model instance
   * @returns {ClientModel} The model
   */
  get model() {
    return this._model;
  }
  
  /**
   * Get the model instance (method version)
   * @returns {ClientModel} The model
   */
  getModel() {
    return this._model;
  }
  
  /**
   * Get the view instance
   * @returns {View} The view
   */
  get view() {
    return this._view;
  }
  
  /**
   * Get the binding manager
   * @returns {BindingManager} The binding manager
   */
  get bindingManager() {
    return this._bindingManager;
  }
  
  /**
   * Get the binding manager (method version)
   * @returns {BindingManager} The binding manager
   */
  getBindingManager() {
    return this._bindingManager;
  }
  
  /**
   * Sets the MATLAB HTML component for integration
   * @param {Object} htmlComponent - The MATLAB HTML component instance
   */
  setHTMLComponent(htmlComponent) {
    if (!htmlComponent) {
      console.error('Invalid HTML component provided');
      return;
    }
    
    this._htmlComponent = htmlComponent;
    console.log('MATLAB HTML component successfully connected');
    
    // Notify the application that the MATLAB component is ready
    if (this._eventManager) {
      this._eventManager.dispatch({
        type: 'MATLAB_COMPONENT_READY',
        data: { component: htmlComponent }
      });
    }
    
    // Resolve the HTML component promise if it exists
    if (this._htmlComponentResolver) {
      this._htmlComponentResolver(htmlComponent);
      this._htmlComponentResolver = null;
    }
  }
  
  /**
   * Check if the app is initialized
   * @returns {boolean} True if initialized
   */
  get isInitialized() {
    return this._initialized;
  }
  
  /**
   * Clean up resources
   */
  destroy() {
    if (this._htmlComponent && this._htmlComponent.removeEventListener) {
      this._htmlComponent.removeEventListener('message', this._onServerEvent);
    }
    window.removeEventListener('message', this._onClientEvent);
    
    if (this._view && typeof this._view.destroy === 'function') {
      this._view.destroy();
    }
    
    if (this._model && typeof this._model.destroy === 'function') {
      this._model.destroy();
    }
    
    if (this._bindingManager && typeof this._bindingManager.destroy === 'function') {
      this._bindingManager.destroy();
    }
    
    this._eventManager.removeAllListeners();
    
    this._initialized = false;
    this._htmlComponent = null;
    this._model = null;
    this._view = null;
    this._bindingManager = null;
  }
}

// Export as default for easier imports
export default AbstractApp;
