// js/model/ClientModel.js
import { ModelClassDefinitionManager } from './ModelClassDefinitionManager.js';
import { EventListener } from '../controller/EventListener.js';
import { EventTypes } from '../controller/EventTypes.js';

/**
 * Client-side model that manages application data and state
 * Extends EventListener to handle events from the server
 * Dynamically loads model classes from the provided root folder
 */
export class ClientModel extends EventListener {
  /**
   * Create a new ClientModel
   * @param {Object} options - Configuration options
   * @param {App} options.app - The main application instance (required)
   * @param {string} options.rootClassName - The name of the root model class (required)
   * @param {string} options.rootFolderPath - The root folder path for model and data-model folders (required)
   */
  constructor(options = {}) {
    const { app, rootClassName, rootFolderPath } = options;
    
    if (!app) {
      throw new Error('App instance is required');
    }
    
    if (!rootClassName) {
      throw new Error('Root class name is required');
    }
    
    if (!rootFolderPath) {
      throw new Error('Root folder path is required');
    }
    
    // Initialize EventListener with the app
    super(app);
    
    /** @private */
    this._app = app;
    
    /** @private */
    this._rootClassName = rootClassName;
    
    /** @private */
    this._rootFolderPath = rootFolderPath;
    
    /** @private */
    this._modelManager = new ModelClassDefinitionManager();
    
    /** @private */
    this.instances = new Map();
    
    /** @private */
    this._initialized = false;
    
    /** @private */
    this._pendingChanges = new Map();
    
    // Detect if we're in a MATLAB environment
    this._isMatlabEnv = window.location.search.includes('mre=');
    if (this._isMatlabEnv) {
      console.log('MATLAB environment detected.');
    }
    
    /** @private */
    this._modelClasses = {};
  }
  
  /**
   * Get the import path for a model
   * @param {string} modelName - The name of the model
   * @returns {string} The import path
   * @private
   */
  _getModelImportPath(modelName) {
    if (this._isMatlabEnv) {
      // In MATLAB, we need a special approach to handle the unique URL structure
      const baseUrl = new URL('./', document.baseURI).href;
      return `${baseUrl}apps/${this._rootFolderPath}/model/${modelName}.js`;
    } else {
      // In browser, use path that works with import maps
      return `apps/${this._rootFolderPath}/model/${modelName}.js`;
    }
  }
  
  /**
   * Gets the full path to a data model definition file
   * @param {string} modelName - The name of the data model file (without extension)
   * @returns {string} The full path to the data model file
   * @private
   */
  _getDataModelFetchPath(modelName) {
    if (this._isMatlabEnv) {
      // In MATLAB, we need to use the baseURI to construct absolute URLs
      const baseUrl = new URL('./', document.baseURI).href;
      return `${baseUrl}apps/${this._rootFolderPath}/data-model/${modelName}.json`;
    } else {
      // In browser, use path that works with import maps
      return `apps/${this._rootFolderPath}/data-model/${modelName}.json`;
    }
  }
  
  /**
   * Initialize the model
   * @param {...any} args - Additional initialization arguments
   * @returns {Promise<void>}
   */
  async init(...args) {
    // Call parent class init first to set up event subscriptions
    await super.init(...args);
    
    console.log('ClientModel initializing with root class:', this._rootClassName);
    
    try {
      // Subscribe to events
      this.subscribeToEvents();
      
      // Delegate to initialize method
      const success = await this.initialize();
      
      if (!success) {
        throw new Error('Model initialization failed');
      }
      
      // Verify root class is registered
      if (!this._modelManager.isClassRegistered(this._rootClassName)) {
        throw new Error(`Root class '${this._rootClassName}' is not registered`);
      }
    } catch (error) {
      console.error('Error during model initialization:', error);
      this._initialized = false;
      throw error;
    }
  }
  
  /**
   * Get the list of event types this model is interested in
   * @returns {string[]} Array of event type strings
   */
  getSubscribedEvents() {
    return [EventTypes.SERVER_MODEL_UPDATED];
  }
  
  // subscribeToEvents is implemented in the EventListener superclass
  
  /**
   * Handle server model updated event
   * @param {Object} eventData - The event data containing the updated model
   * @param {Object} eventData.Data - The updated model data (PascalCase from server)
   * @param {string} eventData.Timestamp - ISO timestamp of the update (PascalCase from server)
   */
  handle_server_model_updated(eventData) {
    try {
      // Extract data using PascalCase field names from server
      const { Data: modelData, Timestamp } = eventData;
      
      // Convert ISO timestamp to Date object
      const timestamp = Timestamp ? new Date(Timestamp) : new Date();
      
      if (modelData) {
        console.log('Received model update from server:', timestamp.toISOString());
        
        // Load the data, clearing existing instances
        const rootInstance = this.loadData(modelData, true);
        
        console.log(`Loaded root instance of ${this._rootClassName} with ID: ${rootInstance.id}`);
        
        // Create and dispatch CLIENT_MODEL_UPDATED event
        if (this._app?.eventManager) {
          this._app.eventManager.dispatchEvent(EventTypes.CLIENT_MODEL_UPDATED, {
            Data: rootInstance
          });
          console.log('Dispatched CLIENT_MODEL_UPDATED event');
        }
      } else {
        console.warn('Received empty model update from server');
        
        // Notify about the empty update
        if (this._app?.eventManager) {
          this._app.eventManager.dispatchEvent(EventTypes.CLIENT_WARNING, {
            ID: 'EMPTY_MODEL_UPDATE',
            Message: 'Received empty model update from server'
          });
        }
      }
    } catch (error) {
      console.error('Error handling server model update:', error);
      
      // Notify about the error
      if (this._app?.eventManager) {
        this._app.eventManager.dispatchEvent(EventTypes.CLIENT_ERROR, {
          ID: 'MODEL_UPDATE_ERROR',
          Message: 'Failed to process server model update',
          Error: error.message,
          Stack: error.stack
        });
      }
    }
  }
  
  /**
   * Print diagnostic information about model class registration
   * @private
   */
  _printRegistrationDiagnostics() {
    console.log('--- Model Registration Diagnostics ---');
    const registeredClasses = this._modelManager.getAllRegisteredClassNames();
    console.log(`Total registered classes: ${registeredClasses.length}`);
    
    for (const className of registeredClasses) {
      const status = this._modelManager.getRegistrationStatus(className);
      console.log(`${className}: Constructor: ${status.hasConstructor ? 'YES' : 'NO'}, Definition: ${status.hasDefinition ? 'YES' : 'NO'}`);
    }
    
    // Check root class specifically
    const rootStatus = this._modelManager.getRegistrationStatus(this._rootClassName);
    console.log(`Root class '${this._rootClassName}' registration status:`);
    console.log(`- Constructor registered: ${rootStatus.hasConstructor ? 'YES' : 'NO'}`);
    console.log(`- Definition loaded: ${rootStatus.hasDefinition ? 'YES' : 'NO'}`);
    console.log('--- End Diagnostics ---');
  }
  
  /**
   * Initialize the client model
   * This loads and registers all model classes and definitions
   * @returns {Promise<boolean>} True if initialization was successful
   */
  async initialize() {
    if (this._initialized) {
      console.log('ClientModel already initialized');
      return true;
    }
    
    try {
      // Load and register model classes
      await this._loadAndRegisterModels();
      
      // Load model definitions
      await this._loadModelDefinitions();
      
      // Register event handlers
      this._registerEventHandlers();
      
      // Print diagnostics
      this._printRegistrationDiagnostics();
      
      this._initialized = true;
      
      return true;
    } catch (error) {
      console.error('Error initializing client model:', error);
      
      // Dispatch error event
      if (this._app?.eventManager) {
        this._app.eventManager.dispatchEvent(EventTypes.CLIENT_ERROR, {
          ID: 'MODEL_INITIALIZATION_ERROR',
          Message: 'Failed to initialize client model',
          Error: error.message,
          Stack: error.stack
        });
      }
      
      return false;
    }
  }
  
  /**
   * Load and register all model classes
   * This method supports both MATLAB and browser environments
   * @private
   * @returns {Promise<boolean>} True if loading was successful
   */
  async _loadAndRegisterModels() {
    try {
      console.log(`Loading model classes for ${this._isMatlabEnv ? 'MATLAB' : 'browser'} environment`);
      
      // Strategy 1: Try to use explicit imports from ModelLoader.js
      try {
        console.log('Strategy 1: Using explicit imports from ModelLoader.js');
        const modelLoaderPath = this._getModelImportPath('ModelLoader');
        console.log(`Loading ModelLoader from: ${modelLoaderPath}`);
        
        // Dynamic import of the ModelLoader module
        const modelLoaderModule = await import(modelLoaderPath);
        
        if (modelLoaderModule && typeof modelLoaderModule.getModelClasses === 'function') {
          console.log('ModelLoader loaded successfully, getting model classes');
          const modelClasses = modelLoaderModule.getModelClasses();
          
          // Register all model classes with the model manager
          for (const [className, classConstructor] of Object.entries(modelClasses)) {
            console.log(`Registering model class: ${className}`);
            this._modelManager.registerClass(className, classConstructor);
            this._modelClasses[className] = classConstructor;
          }
          
          console.log('All model classes registered successfully via ModelLoader');
          return true;
        }
        
        console.warn('ModelLoader.js found but getModelClasses function not available');
      } catch (importError) {
        console.warn('Error loading ModelLoader.js:', importError);
      }
      
      // Strategy 2: For MATLAB, try using ModelRegistry.js
      if (this._isMatlabEnv) {
        try {
          console.log('Strategy 2: Using ModelRegistry.js for MATLAB environment');
          const modelRegistryPath = this._getModelImportPath('ModelRegistry');
          console.log(`Loading ModelRegistry from: ${modelRegistryPath}`);
          
          // Dynamic import of the ModelRegistry module
          const modelRegistryModule = await import(modelRegistryPath);
          
          if (modelRegistryModule && typeof modelRegistryModule.registerModels === 'function') {
            console.log('ModelRegistry loaded successfully, registering models');
            await modelRegistryModule.registerModels(this._modelManager, this._rootClassName);
            console.log('Models registered successfully via ModelRegistry');
            return true;
          }
          
          console.warn('ModelRegistry.js found but registerModels function not available');
        } catch (registryError) {
          console.warn('Error loading ModelRegistry.js:', registryError);
        }
        
        // In MATLAB environment, if both strategies fail, we should throw an error
        // rather than masking the issue with a placeholder model
        throw new Error('Failed to load models in MATLAB environment. Both ModelLoader and ModelRegistry strategies failed.');
      }
      
      // Strategy 4: For browser, use standard dynamic import of model index
      console.log('Strategy 4: Using standard dynamic import for browser');
      const modelIndexPath = this._getModelImportPath('index');
      console.log(`Loading model index from: ${modelIndexPath}`);
      
      try {
        const modelIndex = await import(modelIndexPath);
        
        if (modelIndex && modelIndex.default && Array.isArray(modelIndex.default)) {
          const modelNames = modelIndex.default;
          console.log(`Found ${modelNames.length} models in index:`, modelNames);
          
          // Load each model class dynamically
          for (const modelName of modelNames) {
            try {
              const modelPath = this._getModelImportPath(modelName);
              console.log(`Loading model class: ${modelName} from ${modelPath}`);
              
              const modelModule = await import(modelPath);
              
              if (modelModule && modelModule[modelName]) {
                console.log(`Registering model class: ${modelName}`);
                this._modelManager.registerClass(modelName, modelModule[modelName]);
                this._modelClasses[modelName] = modelModule[modelName];
              } else {
                console.warn(`Model class ${modelName} not found in module`);
              }
            } catch (modelError) {
              console.error(`Error loading model class ${modelName}:`, modelError);
            }
          }
          
          return true;
        }
        
        console.warn('Model index not found or invalid');
      } catch (indexError) {
        console.error('Error loading model index:', indexError);
      }
      
      // If we get here, all strategies failed
      console.error('All model loading strategies failed');
      return false;
    } catch (error) {
      console.error('Error in _loadAndRegisterModels:', error);
      return false;
    }
  }
  
  /**
   * Load model definitions for all registered classes
   * @private
   * @returns {Promise<boolean>} True if loading was successful
   */
  async _loadModelDefinitions() {
    try {
      console.log('Loading model definitions');
      
      // Get all registered class names
      const registeredClasses = this._modelManager.getAllRegisteredClassNames();
      console.log(`Found ${registeredClasses.length} registered classes`);
      
      if (registeredClasses.length === 0) {
        console.warn('No registered classes found, cannot load definitions');
        return false;
      }
      
      // Check if definitions are already loaded
      let allDefinitionsLoaded = true;
      for (const className of registeredClasses) {
        const status = this._modelManager.getRegistrationStatus(className);
        if (!status.hasDefinition) {
          allDefinitionsLoaded = false;
          break;
        }
      }
      
      if (allDefinitionsLoaded) {
        console.log('All definitions already loaded');
        return true;
      }
      
      // Strategy 1: Try to load definitions from data-model folder
      try {
        console.log('Strategy 1: Loading definitions from data-model folder');
        
        // Load each definition file
        for (const className of registeredClasses) {
          try {
            const definitionPath = this._getDataModelFetchPath(className);
            console.log(`Loading definition for ${className} from ${definitionPath}`);
            
            const response = await fetch(definitionPath);
            if (!response.ok) {
              console.warn(`Failed to load definition for ${className}: ${response.status} ${response.statusText}`);
              continue;
            }
            
            const definition = await response.json();
            if (!definition) {
              console.warn(`Invalid definition for ${className}`);
              continue;
            }
            
            // Create a definition object with the class name as key
            const definitionObj = {};
            definitionObj[className] = definition;
            
            // Register the definition
            this._modelManager.loadDefinitions(definitionObj);
            console.log(`Definition for ${className} loaded successfully`);
          } catch (defError) {
            console.warn(`Error loading definition for ${className}:`, defError);
          }
        }
        
        // Check if all definitions are loaded
        for (const className of registeredClasses) {
          const status = this._modelManager.getRegistrationStatus(className);
          if (!status.hasDefinition) {
            console.warn(`Definition for ${className} not loaded`);
          }
        }
        
        return true;
      } catch (error) {
        console.error('Error loading definitions from data-model folder:', error);
      }
      
      // For MATLAB environment, if loading definitions fails, we should throw an error
      // rather than masking the issue with placeholder definitions
      if (this._isMatlabEnv) {
        throw new Error('Failed to load model definitions in MATLAB environment. This indicates a problem with the data-model folder structure or file access.');
      }
      
      console.warn('Failed to load model definitions');
      return false;
    } catch (error) {
      console.error('Error in _loadModelDefinitions:', error);
      return false;
    }
  }
  
  /**
   * Create a new instance of a model class
   * @param {string} className - The name of the class to instantiate
   * @param {Object} data - The data to initialize the instance with
   * @returns {Object} The created instance
   */
  createInstance(className, data = {}) {
    if (!className) {
      throw new Error('Class name is required');
    }
    
    // Ensure the model is initialized
    if (!this._initialized) {
      console.warn('Model not initialized, attempting to initialize');
      this._ensureModelRegistration();
    }
    
    // Verify class registration
    if (!this._modelManager.isClassRegistered(className)) {
      throw new Error(`Class '${className}' is not registered`);
    }
    
    try {
      // Get the class constructor
      const ClassConstructor = this._modelClasses[className];
      if (!ClassConstructor) {
        throw new Error(`Constructor for class '${className}' not found`);
      }
      
      // Process data with property info
      const processedData = this._processDataWithPropInfo(className, data);
      
      // Create the instance
      const instance = new ClassConstructor(processedData);
      
      // If the instance has a UID, store it in the instances map
      if (instance.uid) {
        this.instances.set(instance.uid, instance);
      }
      
      return instance;
    } catch (error) {
      console.error(`Error creating instance of ${className}:`, error);
      
      // Notify about the error
      if (this._app?.eventManager) {
        this._app.eventManager.dispatchEvent(EventTypes.CLIENT_ERROR, {
          ID: 'CREATE_INSTANCE_ERROR',
          Message: `Failed to create instance of ${className}`,
          Error: error.message,
          Stack: error.stack
        });
      }
      
      throw error;
    }
  }
  
  /**
   * Get an instance by its UID
   * @param {number} uid - The UID of the instance to get
   * @returns {Object|null} The instance or null if not found
   */
  getInstance(uid) {
    return this.instances.get(uid) || null;
  }
  
  /**
   * Process data with property info to ensure arrays and objects are handled correctly
   * @param {string} className - The class name
   * @param {Object} data - The data to process
   * @returns {Object} The processed data
   * @private
   */
  _processDataWithPropInfo(className, data) {
    if (!className || !data || typeof data !== 'object') {
      return data;
    }
    
    // For simplicity, just return the data as is
    // In a full implementation, this would process nested objects and arrays
    // based on the property definitions
    return data;
  }
  
  /**
   * Ensure all model classes are registered
   * This is called before creating instances to make sure all required classes are available
   * @private
   */
  _ensureModelRegistration() {
    if (!this._initialized) {
      console.warn('Model not fully initialized, attempting to reload models');
      this._loadAndRegisterModels().catch(error => {
        console.error('Error reloading models:', error);
      });
    }
  }
  
  /**
   * Handle view-to-model property change events
   * @param {Object} event - The event object
   */
  handleViewToModelPropertyChanged(event) {
    if (!event || !event.detail) {
      console.error('Invalid event in handleViewToModelPropertyChanged');
      return;
    }
    
    const { uid, property, value } = event.detail;
    
    if (!uid || !property) {
      console.error('Missing required event details in handleViewToModelPropertyChanged');
      return;
    }
    
    try {
      // Get the instance
      const instance = this.getInstance(uid);
      if (!instance) {
        console.warn(`Instance with ID ${uid} not found`);
        return;
      }
      
      // Update the property
      instance[property] = value;
      
      // Dispatch model-to-view property changed event
      if (this._app?.eventManager) {
        this._app.eventManager.dispatchEvent(EventTypes.MODEL_TO_VIEW_PROPERTY_CHANGED, {
          uid,
          property,
          value
        });
      }
    } catch (error) {
      console.error(`Error updating property ${property} for instance ${uid}:`, error);
      
      // Notify about the error
      if (this._app?.eventManager) {
        this._app.eventManager.dispatchEvent(EventTypes.CLIENT_ERROR, {
          ID: 'UPDATE_PROPERTY_ERROR',
          Message: `Failed to update property ${property} for instance ${uid}`,
          Error: error.message,
          Stack: error.stack
        });
      }
    }
  }
  
  /**
   * Load data from a JSON structure
   * @param {Object} data - The data to load (should be an instance of the root class)
   * @param {boolean} [clearExisting=false] - Whether to clear existing instances
   * @returns {Object} The created root instance
   */
  loadData(data, clearExisting = false) {
    if (!data || typeof data !== 'object') {
      throw new Error('Data must be an object');
    }
    
    if (!this._modelManager) {
      throw new Error('ModelClassDefinitionManager not initialized');
    }
    
    // Verify the root class is registered
    if (!this._modelManager.isClassRegistered(this._rootClassName)) {
      console.warn(`Root class '${this._rootClassName}' is not registered. Attempting to reload models...`);
      // Try to reload models
      this._ensureModelRegistration();
      
      // Check again after reload attempt
      if (!this._modelManager.isClassRegistered(this._rootClassName)) {
        throw new Error(`Root class '${this._rootClassName}' is not registered after reload attempt`);
      }
    }
    
    try {
      if (clearExisting) {
        this.instances.clear();
        if (this._pendingChanges) {
          this._pendingChanges.clear();
        }
      }
      
      // Create root instance from the data
      const rootInstance = this.createInstance(this._rootClassName, data);
      
      // Dispatch model updated event
      if (this._app?.eventManager) {
        this._app.eventManager.dispatchEvent(EventTypes.CLIENT_MODEL_UPDATED, {
          Data: rootInstance
        });
      }
      
      return rootInstance;
    } catch (error) {
      console.error('Error loading data:', error);
      
      // Notify about the error
      if (this._app?.eventManager) {
        this._app.eventManager.dispatchEvent(EventTypes.CLIENT_ERROR, {
          ID: 'LOAD_DATA_ERROR',
          Message: 'Failed to load model data',
          Error: error.message,
          Stack: error.stack
        });
      }
      
      throw error;
    }
  }
  
  /**
   * Register event handlers for the client model
   * This is called during initialization
   * @private
   */
  _registerEventHandlers() {
    if (!this._app?.eventManager) {
      console.error('EventManager not available, cannot register event handlers');
      return;
    }
    
    // Register for view-to-model property changed events
    this._app.eventManager.addEventListener(
      EventTypes.VIEW_TO_MODEL_PROPERTY_CHANGED,
      this.handleViewToModelPropertyChanged.bind(this)
    );
    
    console.log('Event handlers registered');
  }
}
