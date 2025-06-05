/**
 * AbstractApp - Base application class that coordinates between models, views, and the MATLAB HTML component
 * Provides abstract methods for creating model and view instances
 */
import { EventManager } from './EventManager.js';
import { ClientModel } from '../model/ClientModel.js';
import { MockMATLABComponent } from './MockMATLABComponent.js';
import { EventTypes } from './EventTypes.js';
import { BindingManager } from '../binding/BindingManager.js';
import MatlabResourceLoader from '../utils/MatlabResourceLoader.js';

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
   * @param {Object} options - Initialization options
   */
  constructor(options = {}) {
    /** @private */
    this._eventManager = new EventManager();
    
    /** @private */
    this._bindingManager = new BindingManager({ eventManager: this._eventManager, app: this });
    
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
    
    // Store preloaded resources if provided
    this.modelDefinitions = options.modelDefinitions || {};
    this.viewConfig = options.viewConfig || null;
    this.testData = options.testData || null;
    
    // Configuration for resource loading
    this.config = options.config || {};
    
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
  async createModel() {
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
      console.log('Starting app initialization...');
      
      // Load required resources if not already loaded
      await this._loadRequiredResources();
      
      // Create model (async in newer implementations)
      const modelResult = this.createModel();
      this._model = modelResult instanceof Promise ? await modelResult : modelResult;
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
      this.dispatchClientEvent(EventTypes.APP_INITIALIZED, {
        appName: this.constructor.name,
        version: this.version || '1.0.0'
      });
    } catch (error) {
      console.error('Error initializing app:', error);
      throw error;
    }
  }

  /**
   * Load required JSON resources if they haven't been preloaded
   * @private
   * @returns {Promise<void>}
   */
  async _loadRequiredResources() {
    // Show loading indicator if exists
    if (this.appNode) {
      this.appNode.classList.add('loading');
    }
    
    try {
      // Load model definitions if not already provided
      if (!this.modelDefinitions || Object.keys(this.modelDefinitions).length === 0) {
        // Get model class names from config or use default method
        const classNames = this.config.modelClassNames || this.getModelClassNames() || [];
        console.log(`Loading model definitions for: ${classNames.join(', ')}`);
        
        // Load each model definition
        const definitionsMap = {};
        for (const className of classNames) {
          definitionsMap[className] = await this.loadModelDefinition(className);
        }
        this.modelDefinitions = definitionsMap;
      }
      
      // Load view config if not already provided
      if (!this.viewConfig) {
        // Get view config name from config or use default
        const viewConfigName = this.config.viewConfigName || 'defaultView';
        console.log(`Loading view config: ${viewConfigName}`);
        
        // Load view config
        this.viewConfig = await this.loadViewConfig(viewConfigName);
      }
      
      // Load test data if not already provided and it's configured to be used
      if (!this.testData && this.config.useTestData) {
        // Get test data file name from config or use default
        const testDataFileName = this.config.testDataFileName || 'testData.json';
        console.log(`Loading test data: ${testDataFileName}`);
        
        // Load test data
        this.testData = await this.loadTestData(testDataFileName);
      }
      
      console.log('Required resources loaded successfully');
    } catch (error) {
      console.error('Error loading resources:', error);
      throw new Error(`Failed to load required resources: ${error.message}`);
    } finally {
      // Remove loading indicator
      if (this.appNode) {
        this.appNode.classList.remove('loading');
      }
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
   * To be implemented by App subclass
   * @param {string} className - Name of the model class
   * @returns {Promise<Object>} - JSON definition of the model class
   * @throws {Error} If the model definition cannot be loaded
   * @deprecated Use loadAllModelDefinitions instead which loads all definitions at once
   */
  async loadModelDefinitionJson(className) {
    throw new Error('loadModelDefinitionJson is abstract and must be implemented by App subclass');
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
   * To be implemented by App subclass
   * @returns {Promise<Object>} - Test data JSON
   * @throws {Error} If test data cannot be loaded
   */
  async loadTestDataJson() {
    throw new Error('loadTestDataJson is abstract and must be implemented by App subclass');
  }
  
  /**
   * @deprecated Use loadTestDataJson instead
   * Find the first JSON file in the resources directory
   * @private
   * @returns {Promise<string>} Path to the first JSON file found
   * @throws {Error} If no JSON file is found
   */
  async _findFirstJsonFile() {
    console.warn('_findFirstJsonFile is deprecated. Use loadTestDataJson instead.');
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
      // Use the abstract method to load test data
      const testData = await this.loadTestDataJson();
      
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
