/**
 * AbstractApp - Base application class that coordinates between models, views, and the MATLAB HTML component
 * Provides abstract methods for creating model and view instances
 */
import { EventManager } from './EventManager.js';
import { ClientModel } from '../model/ClientModel.js';
import { EventTypes } from './EventTypes.js';
import { BindingManager } from '../binding/BindingManager.js';
import MatlabResourceLoader from '../utils/MatlabResourceLoader.js';
import { UIHTMLServiceLayer } from '../controller/service/UIHTMLServiceLayer.js';

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
   * Constructor for AbstractApp
   */
  constructor() {
    /**
     * Flag to track initialization state
     * @type {boolean}
     * @protected
     */
    this._initialized = false;
    
    /**
     * Event manager for the application
     * @type {EventManager}
     * @protected
     */
    this._eventManager = new EventManager();

    /**
     * Binding manager for the application
     * @type {BindingManager}
     * @protected
     */
    this._bindingManager = this._createBindingManager();
    
    /**
     * ServiceLayer instance for MATLAB communication
     * @type {ServiceLayer}
     * @protected
     */
    this._serviceLayer = new UIHTMLServiceLayer(this);
  }

  /**
   * Initialize the application
   * @returns {Promise<boolean>} Promise that resolves when initialization is complete
   */
  async initApp() {
    if (this._initialized) {
      console.warn('App already initialized');
      return true;
    }

    try {
      // Initialize both components in parallel and capture results
      const [_, model] = await Promise.all([
        this._serviceLayer.init(), // Waits for HTML component or timeout
        this._createModel() // Create model with provided definitions
      ]);
      
      // Assign model from Promise.all results
      this._model = model;
      
      // Initialize the model
      await this._model.init();
      
      // Once both are ready, continue with app initialization
      this._view = await this._createView();
      await this._view.init();
      
      // Set up app-specific event subscriptions
      this._setupEventSubscriptions();
      
      // Mark as initialized and dispatch event
      this._initialized = true;
      this._eventManager.dispatchEvent(EventTypes.APP_INITIALIZED, {
        appName: this.constructor.name,
        version: this.version || '1.0.0'
      });
      
      return true;
    } catch (error) {
      console.error('App initialization failed:', error);
      return false;
    }
  }

  /**
   * Create binding manager
   * @returns {BindingManager}
   * @private
   */
  _createBindingManager() {
    return new BindingManager({
      eventManager: this._eventManager,
      app: this
    });
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
   * Check if we're running in a MATLAB environment
   * @returns {boolean} True if running in MATLAB environment
   */
  isMatlabEnvironment() {
    return MatlabResourceLoader.isMatlabEnvironment();
  }
  
  /**
   * Get the MATLAB base URL if running in MATLAB environment
   * @returns {string} MATLAB base URL
   */
  getMatlabBaseUrl() {
    // Get static path from MatlabResourceLoader
    const staticPath = MatlabResourceLoader.getMatlabStaticPath();
    
    if (staticPath) {
      return window.location.origin + staticPath;
    }
    
    // If we're in a MATLAB environment but don't have a static path,
    // just return the origin
    if (this.isMatlabEnvironment()) {
      return window.location.origin + '/';
    }
    
    return '';
  }
  
  /**
   * Builds a resource path for this app
   * @param {string} relativePath - Path relative to app root
   * @returns {string} The full resource path
   */
  buildResourcePath(relativePath) {
    return MatlabResourceLoader.buildResourcePath(
      this.getRootFolderPath(),
      relativePath
    );
  }
  
  /**
   * Loads a JSON resource
   * @param {string} relativePath - Path relative to app root
   * @returns {Promise<Object>} The parsed JSON data
   */
  async loadJsonResource(relativePath) {
    const fullPath = this.buildResourcePath(relativePath);
    console.log(`Loading JSON from: ${fullPath}`);
    
    const response = await fetch(fullPath);
    if (!response.ok) {
      throw new Error(`Failed to load resource ${relativePath}: ${response.status} ${response.statusText}`);
    }
    
    return await response.json();
  }
  
  /**
   * Loads a model definition JSON file
   * @param {string} className - Class name for the model
   * @returns {Promise<Object>} The parsed model definition
   */
  async loadModelDefinition(className) {
    return this.loadJsonResource(`data-model/${className}.json`);
  }
  
  /**
   * Loads the view configuration JSON file
   * @param {string} viewName - Name of the view configuration
   * @returns {Promise<Object>} The parsed view configuration
   */
  async loadViewConfig(viewName) {
    return this.loadJsonResource(`view/config/${viewName}.json`);
  }
  
  /**
   * Loads test data JSON file
   * @param {string} fileName - Optional name of test data file (default: 'testData.json')
   * @returns {Promise<Object>} The parsed test data
   */
  async loadTestData(fileName = 'testData.json') {
    return this.loadJsonResource(`test-data/${fileName}`);
  }
  
  /**
   * Get the base URL for loading app-specific resources
   * This can be overridden by subclasses if they need a different URL structure
   * @protected
   * @returns {string} Base URL for app resources
   */
  _getAppBaseUrl() {
    // If we're in MATLAB environment, use the MATLAB base URL with static path
    if (this.isMatlabEnvironment()) {
      const matlabBaseUrl = this.getMatlabBaseUrl();
      const staticPath = 'static';
      const folderPath = this.getRootFolderPath();
      
      // Construct URL like: https://127.0.0.1:31515/static/gPKPDSimConfig/
      const appBaseUrl = `${matlabBaseUrl}${staticPath}/${folderPath}/`;
      console.log(`MATLAB app base URL: ${appBaseUrl}`);
      return appBaseUrl;
    }
    
    // Default for browser environment
    return `/apps/${this.getRootFolderPath()}/`;
  }


  
    /**
   * Create the model instance using direct model definitions
   * @returns {Promise<ClientModel>} The model instance
   * @protected
   */
  async _createModel() {
    console.log('Creating model with direct model definitions...');
    
    try {
      // Load all model definitions
      const modelDefinitions = await this.loadAllModelDefinitions();
      
      // Create the ClientModel with directly provided definitions only
      // No model classes are loaded - using pure JSON definitions
      return new ClientModel({
        app: this,
        rootClassName: this.getRootClassName(),
        modelDefinitions: modelDefinitions,
        // No model classes - empty array
        modelClasses: []
      });
    } catch (error) {
      console.error('Error creating model:', error);
      throw error; // Ensure errors are properly propagated
    }
  }

  /**
   * Create the view instance - can be overridden by subclasses
   * @returns {Promise<View>|View} The view instance or a promise that resolves to the view instance
   * @protected
   */
  async _createView() {
    throw new Error('_createView is abstract and must be implemented by App subclass');
  }

  // ----------------------------------------------------------------------
  // ABSTRACT METHODS FOR LOADING APP-SPECIFIC FILES
  // These must be implemented in the App subclass
  // ----------------------------------------------------------------------
  
  /**
   * Load view configuration JSON for a component
   * To be implemented by App subclass
   * @param {string} componentName - Name of the component
   * @returns {Promise<Object>} - JSON configuration for the component
   * @throws {Error} If the component configuration cannot be loaded
   */
  async loadViewConfigJson(componentName) {
    throw new Error('loadViewConfigJson is abstract and must be implemented by App subclass');
  }
  
  /**
   * Load model definition JSON for a specific class
   * Default implementation that loads from standard path convention
   * @param {string} className - Name of the model class
   * @returns {Promise<Object>} - JSON definition of the model class
   * @throws {Error} If the model definition cannot be loaded
   * @deprecated Use loadAllModelDefinitions instead which loads all definitions at once
   */
  async loadModelDefinitionJson(className) {
    // Default implementation uses standard path convention
    return this.loadJsonResource(`data-model/${className}.json`);
  }

  /**
   * Get the names of all model classes used by this app
   * To be implemented by App subclass
   * @returns {string[]} Array of model class names used by this app
   */
  getModelClassNames() {
    throw new Error('getModelClassNames is abstract and must be implemented by App subclass');
  }

  /**
   * Load all model class definitions for the app
   * To be implemented by App subclass
   * @returns {Promise<Object>} - Object mapping class names to their JSON definitions
   * @throws {Error} If the model definitions cannot be loaded
   */
  async loadAllModelDefinitions() {
    // Default implementation that uses getModelClassNames and loadModelDefinitionJson
    const classNames = this.getModelClassNames();
    
    // Load all definitions in parallel
    const definitionPromises = classNames.map(className => this.loadModelDefinitionJson(className));
    const definitions = await Promise.all(definitionPromises);
    
    // Create a map of className to definition
    const definitionMap = {};
    classNames.forEach((className, index) => {
      definitionMap[className] = definitions[index];
    });
    
    return definitionMap;
  }

  /**
   * Get the base URL for loading app-specific resources
   * @private
   * @returns {string} The base URL for app resources
   */
  _getAppBaseUrl() {
    // Different approach for MATLAB vs browser environment
    if (this.isMatlabEnvironment()) {
      const matlabBase = this.getMatlabBaseUrl();
      
      // Extract the full path structure from current URL for MATLAB environments
      const currentUrl = window.location.href;
      const currentPath = window.location.pathname;
      
      // Check if the current URL contains the static path structure
      if (currentPath.includes('/static/')) {
        // Extract the path up to the app folder name
        // Format is typically: /static/{uniqueId}/{guid}/{appFolder}/...
        const pathMatch = currentPath.match(/(\/static\/[^\/]+\/[^\/]+\/[^\/]+\/)/); // Match /static/id/guid/folder/
        
        if (pathMatch && pathMatch[1]) {
          const staticPath = pathMatch[1]; // Includes trailing slash
          console.log('Using MATLAB static path:', staticPath);
          return matlabBase + staticPath.substring(1); // Remove leading slash as matlabBase ends with one
        }
      }
      
      // Fallback to basic static path if we couldn't extract the full path
      const appFolder = this.getRootFolderPath();
      const fallbackPath = `static/${appFolder}/`;
      console.log('Falling back to MATLAB path:', matlabBase + fallbackPath);
      return matlabBase + fallbackPath;
    } else {
      // In browser environment, construct path relative to apps folder
      return `/apps/${this.getRootFolderPath()}`;
    }
  }
  
  /**
   * Load all model classes for the app
   * Default implementation that loads classes from model/index.js if it exists
   * @returns {Promise<Array<Function>>} - Array of model class constructors or empty array if no model/index.js exists
   */
  async loadModelClasses() {
    // Check if we should skip model class loading (controlled by config)
    if (this.config && this.config.skipModelClassLoading === true) {
      console.log('Skipping model class loading as configured');
      return [];
    }
    
    console.log('Loading all model classes...');
    
    try {
      // Construct path based on environment
      let importPath;
      
      if (this.isMatlabEnvironment()) {
        const matlabBase = this.getMatlabBaseUrl();
        // Adjust path for MATLAB environment which serves files from a different location
        importPath = `${matlabBase}static/${this.getRootFolderPath()}/model/index.js`;
        console.log(`MATLAB environment detected for model loading, using path: ${importPath}`);
      } else {
        const baseUrl = this._getAppBaseUrl();
        importPath = `${baseUrl}/model/index.js`;
        console.log(`Standard browser environment for model loading, using path: ${importPath}`);
      }
      
      console.log(`Importing model index from: ${importPath}`);
      
      // Try to fetch the file first to see if it exists
      try {
        const response = await fetch(importPath);
        if (!response.ok) {
          console.log(`model/index.js not found at ${importPath}, using JSON definitions only`);
          return [];
        }
      } catch (fetchError) {
        console.log(`Could not fetch model/index.js: ${fetchError.message}, using JSON definitions only`);
        return [];
      }
      
      // Dynamic import using absolute path only if the file exists
      const indexModule = await import(importPath);
      
      // Get all exported model classes (excluding default export)
      const modelClassExports = Object.entries(indexModule)
        .filter(([key]) => key !== 'default')
        .map(([_, ModelClass]) => ModelClass);
      
      console.log(`Successfully loaded ${modelClassExports.length} model classes`);
      return modelClassExports;
    } catch (error) {
      console.log('Error loading model classes, proceeding with JSON definitions only:', error.message);
      return []; // Return empty array to avoid breaking the application
    }
  }
  
  /**
   * Get the available test data paths for this app
   * To be implemented by App subclass
   * @returns {string[]} - Array of paths to test data JSON files, relative to the app root
   */
  getTestDataPaths() {
    throw new Error('getTestDataPaths is abstract and must be implemented by App subclass');
  }
  
  /**
   * Load test data JSON from resources
   * Default implementation that uses getTestDataPaths() to locate test data
   * @returns {Promise<Object>} - Test data JSON
   * @throws {Error} If test data cannot be loaded
   */
  async loadTestDataJson() {
    // Get the paths from getTestDataPaths to maintain a single source of truth
    const paths = this.getTestDataPaths();
    
    if (!paths || paths.length === 0) {
      throw new Error('No test data paths available');
    }
    
    // Use the first path (primary test data file)
    const filePath = paths[0];
    
    // Use loadJsonResource directly with the correct path
    return this.loadJsonResource(filePath);
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
   * Load and apply test data to the application
   * Sends MATLAB_METHOD_CALL_REQUEST if connected to MATLAB, otherwise
   * dispatches SERVER_MODEL_UPDATED event directly with the loaded data
   * @returns {Promise<void>}
   */
  async loadTestData() {
    try {
      // Use the abstract method to load test data
      const testData = await this.loadTestDataJson();
      
      // Check if we're connected to MATLAB
      if (this.isMatlabEnvironment() && this._serviceLayer) {
        console.log('MATLAB environment detected, sending setRootModel request to server');
        
        // Define success callback
        const successCallback = (response) => {
          console.log('Server successfully set root model with test data:', response);
          // No need to dispatch SERVER_MODEL_UPDATED as the server should broadcast it
        };
        
        // Define error callback
        const errorCallback = (error) => {
          console.error('Error setting root model on server:', error);
          this.dispatchClientEvent(
            EventTypes.CLIENT_ERROR,
            {
              ID: 'set-root-model-failed',
              Message: 'Failed to set root model on server',
              Error: error.message
            },
            'test-data-loader'
          );
        };
        
        // Send MATLAB method call request to set the root model on the server
        this._eventManager.dispatchEvent(EventTypes.MATLAB_METHOD_CALL_REQUEST, {
          MethodName: 'setRootModel',
          ObjectPath: '',
          Args: {
            RootModelData: testData
          },
          Callback: successCallback,
          ErrorCallback: errorCallback
        });
      } else {
        // If not connected to MATLAB, mock the server event directly
        console.log('No MATLAB connection, mocking SERVER_MODEL_UPDATED event');
        
        // Dispatch server model updated event - ClientModel will handle this and dispatch CLIENT_MODEL_UPDATED
        this.dispatchClientEvent(
          EventTypes.SERVER_MODEL_UPDATED,
          { 
            Data: testData
          }
        );
        console.log('Dispatched SERVER_MODEL_UPDATED event with test data');
      }
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
   * Set the MATLAB HTML component
   * @param {Object} htmlComponent - The MATLAB HTML component
   */
  setHTMLComponent(htmlComponent) {
    if (!htmlComponent) {
      console.error('Invalid HTML component provided');
      return;
    }

    // Pass the HTML component to the service layer
    if (this._serviceLayer) {
      this._serviceLayer.setHTMLComponent(htmlComponent);
    } else {
      console.error('ServiceLayer not created yet, cannot set HTML component');
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
   * Destroys the app, removing event listeners and references
   */
  destroy() {
    // Clean up binding manager
    if (this._bindingManager) {
      this._bindingManager.destroy();
      this._bindingManager = null;
    }

    if (this._view) {
      this._view.destroy();
      this._view = null;
    }
    
    // Clear references
    if (this._model) {
      this._model.destroy();
      this._model = null;
    }
    
    // Clean up event manager last
    if (this._eventManager) {
      this._eventManager.destroy();
      this._eventManager = null;
    }
    
    // Clean up service layer
    if (this._serviceLayer) {
      this._serviceLayer.destroy();
      this._serviceLayer = null;
    }
    
    // Reset initialization flag
    this._initialized = false;
  }
}

// Export as default for easier imports
export default AbstractApp;
