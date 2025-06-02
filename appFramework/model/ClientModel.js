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
      // Subscribe to events before loading models
      this.subscribeToEvents();
      
      // Load and register all model classes and their definitions
      await this._loadAndRegisterModels();
      
      // Mark as initialized
      this._initialized = true;
      console.log(`Root class ${this._rootClassName} is initialized and ready`);
      
      // Print diagnostic information
      this._printRegistrationDiagnostics();
      
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
   * Print diagnostic information about class registrations
   * @private
   */
  _printRegistrationDiagnostics() {
    console.log('--- Class Registration Diagnostics ---');
    const classNames = this._modelManager.getAllRegisteredClassNames();
    console.log(`Total registered classes: ${classNames.length}`);
    
    for (const className of classNames) {
      const status = this._modelManager.getRegistrationStatus(className);
      console.log(`${className}: Constructor: ${status.hasConstructor ? 'YES' : 'NO'}, Definition: ${status.hasDefinition ? 'YES' : 'NO'}`);
    }
    
    // Check root class specifically
    const rootStatus = this._modelManager.getRegistrationStatus(this._rootClassName);
    if (!rootStatus.registered) {
      console.warn(`WARNING: Root class '${this._rootClassName}' is not registered at all!`);
    } else if (!rootStatus.hasDefinition) {
      console.warn(`WARNING: Root class '${this._rootClassName}' has no definition!`);
    } else if (!rootStatus.hasConstructor) {
      console.warn(`WARNING: Root class '${this._rootClassName}' has no constructor!`);
    } else {
      console.log(`Root class '${this._rootClassName}' is fully registered.`);
    }
    console.log('--- End Diagnostics ---');
  }
  
  /**
   * Load and register model classes and their definitions synchronously
   * @private
   */
  /**
   * Gets the full path to a model file
   * @param {string} modelName - The name of the model file (without extension)
   * @returns {string} The full path to the model file
   */
  /**
   * Gets the full path to a model file
   * @param {string} modelName - The name of the model file (without extension)
   * @returns {string} The full path to the model file
   * @private
   */
  _getModelImportPath(modelName) {
    // For dynamic imports, we need to use a path that works with the browser's module loading system
    // The path should be relative to the current file's location in the appFramework/model directory
    return `../../apps/${this._rootFolderPath}/model/${modelName}.js`;
  }

  /**
   * Gets the full path to a data model definition file
   * @param {string} modelName - The name of the data model file (without extension)
   * @returns {string} The full path to the data model file
   * @private
   */
  _getDataModelFetchPath(modelName) {
    // For fetch requests, we need to use a path that works with the browser's fetch API
    // The path should be relative to the web root when served by live-server
    // Since live-server serves from the gQSPSimConfig directory, we need to go up one level
    return `/apps/${this._rootFolderPath}/data-model/${modelName}.json`;
  }
  
  /**
   * Loads all model classes and their definitions
   * @private
   * @returns {Promise<boolean>} True if all models were loaded successfully
   */
  async _loadAndRegisterModels() {
    console.log('Starting to load model classes and definitions...');
    console.log('Root folder path:', this._rootFolderPath);
    
    try {
      // The path to the model index file relative to the current file
      const indexPath = this._getModelImportPath('index');
      console.log(`Loading model index from: ${indexPath}`);
      
      // Dynamic import using relative path
      const indexModule = await import(indexPath);
      // Get all exported model names (excluding default exports)
      const modelNames = Object.keys(indexModule).filter(key => key !== 'default');
      //console.log(`Found ${modelNames.length} models in index: ${modelNames.join(', ')}`);
      
      if (modelNames.length === 0) {
        throw new Error('No models found in index.js');
      }
      
      // Store the model classes for later use
      this._modelClasses = {};
      
      // First pass: Register all model classes
      for (const modelName of modelNames) {
        const ModelClass = indexModule[modelName];
        
        // Ensure the model class has either a static className property or modelName getter
        if (!ModelClass.className && !ModelClass.modelName) {
          console.log(`Adding static className '${modelName}' to model class`);
          ModelClass.className = modelName;
        } else if (ModelClass.className && ModelClass.className !== modelName) {
          console.warn(`Model class ${modelName} has className '${ModelClass.className}' that doesn't match its export name`);
        } else if (ModelClass.modelName && ModelClass.modelName !== modelName) {
          console.warn(`Model class ${modelName} has modelName '${ModelClass.modelName}' that doesn't match its export name`);
        }
        
        // Store the class in our local cache
        const className = ModelClass.className || modelName;
        this._modelClasses[className] = ModelClass;
        
        // Register the class with the manager
        this._modelManager.registerClass(className, ModelClass);
        console.log(`Registered model class: ${className}`);
      }
      
      // Second pass: Load and register all model definitions
      const loadDefinitions = Object.keys(this._modelClasses).map(async (className) => {
        const ModelClass = this._modelClasses[className];
        
        try {
          // Load the model definition
          const dataModelPath = this._getDataModelFetchPath(className);
          console.log(`Loading definition for ${className} from: ${dataModelPath}`);
          
          const response = await fetch(new URL(dataModelPath, window.location.origin + window.location.pathname));
          if (!response.ok) {
            console.warn(`Definition not found for ${className}: ${response.status}`);
            return { className, success: false, error: `HTTP ${response.status}` };
          }
          
          const definition = await response.json();
          
          // Store the definition on the class for reference
          ModelClass.modelDefinition = definition;
          
          // Register the definition with the manager
          this._modelManager.registerClassDefinition(className, definition, ModelClass);
          console.log(`Successfully registered definition for ${className}`);
          
          return { className, success: true };
        } catch (error) {
          console.error(`Error loading definition for ${className}:`, error);
          return { className, success: false, error };
        }
      });
      
      // Wait for all definitions to load
      const results = await Promise.all(loadDefinitions);
      const failed = results.filter(r => !r.success);
      
      if (failed.length > 0) {
        console.warn(`Failed to load ${failed.length} model definitions`);
        failed.forEach(f => console.warn(`- ${f.className}: ${f.error?.message || f.error || 'Unknown error'}`));
      }
      
      // Verify the root class is registered and has a definition
      if (!this._modelManager.isClassRegistered(this._rootClassName)) {
        throw new Error(`Root class ${this._rootClassName} was not registered!`);
      }
      
      const rootClassDef = this._modelManager.getDefinition(this._rootClassName);
      if (!rootClassDef) {
        throw new Error(`No definition found for root class: ${this._rootClassName}`);
      }
      
      // Verify all classes are properly registered
      for (const className of Object.keys(this._modelClasses)) {
        if (!this._modelManager.isClassRegistered(className)) {
          // Re-register the class if it's missing
          this._modelManager.registerClass(className, this._modelClasses[className]);
          console.warn(`Re-registered missing class: ${className}`);
        }
      }
      
      console.log(`Model loading complete. Root class ${this._rootClassName} is registered with definition.`);
      this._initialized = true;
      
      return true;
      
    } catch (error) {
      console.error('Error in _loadAndRegisterModels:', error);
      this._initialized = false;
      
      // Re-throw to be handled by the caller if needed
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
  
  /**
   * Handle client model updated event
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
   * Get the current model data
   * @returns {Object} The current model data
   */
  getData() {
    return this._data;
  }
  
  /**
   * Get the root instance of the model
   * @returns {Object|null} The root instance or null if not loaded yet
   */
  getRootInstance() {
    return this._rootInstance || null;
  }
  
  /**
   * Process a data object and create model instances
   * @private
   */
  _processDataObject(key, value) {
    // Implementation details...
  }
  
  /**
   * Convert the model to JSON
   * @returns {Object} The model data as JSON
   */
  toJSON() {
    const rootInstance = this.getRootInstance();
    if (!rootInstance) return null;
    
    return rootInstance.toJSON ? rootInstance.toJSON() : rootInstance;
  }
  
  /**
   * Clean up resources
   */
  destroy() {
    this.instances.clear();
    this._pendingChanges.clear();
    this._data = null;
    this._rootInstance = null;
  }

  /**
   * Get the model class definition manager
   * @returns {ModelClassDefinitionManager} The model class definition manager
   */
  get modelManager() {
    return this._modelManager;
  }

  /**
   * Create a model instance
   * @param {string} className - The name of the class to instantiate
   * @param {Object} data - The data to initialize the instance with
   * @returns {Object} The created instance
   */
  createInstance(className, data = {}) {
    if (!className) {
      throw new Error('Class name is required');
    }
    
    if (!this._modelManager) {
      throw new Error('ModelClassDefinitionManager not initialized');
    }
    
    try {
      // Ensure all models are registered before creating instances
      this._ensureModelRegistration();
      
      // Get the class constructor
      const ObjectClass = this._modelManager.getClass(className);
      if (!ObjectClass) {
        // Log all registered classes for debugging
        const registeredClasses = this._modelManager.getAllRegisteredClassNames();
        console.error(`Class not found: ${className}. Registered classes: ${registeredClasses.join(', ')}`);
        throw new Error(`Class not found: ${className}`);
      }
      
      // Create the instance using the class constructor and pass the manager
      const instance = new ObjectClass(data, this._modelManager);
      
      // Store the instance in our map
      this.instances.set(instance.id, instance);
      
      // If this is the root class instance, store a reference to it
      if (className === this._rootClassName) {
        this._rootInstance = instance;
      }
      
      return instance;
    } catch (error) {
      console.error(`Error creating instance of ${className}:`, error);
      throw error;
    }
  }
  
  /**
   * Get a model instance by ID
   * @param {number} uid - The ID of the instance to retrieve
   * @returns {Object|undefined} The instance, or undefined if not found
   */
  getInstance(uid) {
    // Handle string UIDs by converting to number if possible
    if (typeof uid === 'string') {
      const numUid = parseInt(uid, 10);
      if (!isNaN(numUid)) {
        uid = numUid;
      }
    }
    return this.instances.get(uid);
  }
  
  /**
   * Get all model instances of a specific class
   * @param {string} [className] - Optional class name to filter by
   * @returns {Array} Array of model instances
   */
  getAllInstances(className) {
    const instances = Array.from(this.instances.values());
    
    if (!className) {
      return instances;
    }
    
    return instances.filter(instance => instance.constructor.name === className);
  }
  
  /**
   * Update a model instance from server data
   * @param {number} uid - The ID of the instance to update
   * @param {Object} updates - The updates to apply (property/value pairs)
   * @returns {Object|null} The updated instance, or null if not found
   */
  updateInstanceFromServer(uid, updates) {
    try {
      const instance = this.getInstance(uid);
      if (!instance) {
        console.warn(`Instance with ID ${uid} not found`);
        
        // Notify about the missing instance
        if (this._app?.eventManager) {
          this._app.eventManager.dispatchEvent(EventTypes.CLIENT_ERROR, {
            ID: 'INSTANCE_NOT_FOUND',
            Message: `Instance with ID ${uid} not found`
          });
        }
        
        return null;
      }
      
      // Update the instance with the new data
      Object.assign(instance, updates);
      
      // Dispatch model updated event
      if (this._app?.eventManager) {
        this._app.eventManager.dispatchEvent(EventTypes.CLIENT_MODEL_UPDATED, {
          Data: instance
        });
      }
      
      return instance;
    } catch (error) {
      console.error(`Error updating instance ${uid} from server:`, error);
      
      // Notify about the error
      if (this._app?.eventManager) {
        this._app.eventManager.dispatchEvent(EventTypes.CLIENT_ERROR, {
          ID: 'UPDATE_INSTANCE_ERROR',
          Message: `Failed to update instance ${uid} from server`,
          Error: error.message,
          Stack: error.stack
        });
      }
      
      return null;
    }
  }
  
  /**
   * Update a model instance from view (client-side) changes
   * @param {number} uid - The ID of the instance to update
   * @param {string} propName - The property name to update
   * @param {*} value - The new value
   * @returns {Object|null} The updated instance, or null if not found
   */
  updateInstanceFromView(uid, propName, value) {
    try {
      // Find the instance
      const instance = this.getInstance(uid);
      if (!instance) {
        console.warn(`Instance with ID ${uid} not found`);
        return null;
      }
      
      // Get the class name
      const className = instance.constructor.name;
      
      // Validate property exists on the class
      if (!this._modelManager.hasProperty(className, propName)) {
        console.warn(`Property '${propName}' does not exist on class '${className}'`);
        return null;
      }
      
      // Get property info to validate the value
      const propInfo = this._modelManager.getPropertyInfo(className, propName);
      if (!propInfo) {
        console.warn(`Property info for '${className}.${propName}' not found`);
        return null;
      }
      
      // TODO: Validate value against property type
      
      // Store old value for comparison
      const oldValue = instance[propName];
      
      // Update the property
      instance[propName] = value;
      
      // Add to pending changes
      if (!this._pendingChanges.has(uid)) {
        this._pendingChanges.set(uid, new Map());
      }
      this._pendingChanges.get(uid).set(propName, value);
      
      // Dispatch model property changed event
      if (this._app?.eventManager) {
        // Create a path for the property (e.g., 'parameters.0.name')
        const path = `${className.toLowerCase()}.${uid}.${propName}`;
        
        // Dispatch the property change event
        this._app.eventManager.dispatchEvent(EventTypes.MODEL_TO_VIEW_PROPERTY_CHANGED, {
          path: path,
          oldValue: oldValue,
          newValue: value,
          instance: instance,
          uid: uid,
          className: className,
          property: propName,
          source: 'view'
        });
        
        // Also dispatch the general model updated event
        this._app.eventManager.dispatch(EventTypes.CLIENT_MODEL_UPDATED, {
          uid: uid,
          className: className,
          property: propName,
          value: value
        });
      }
      
      return instance;
    } catch (error) {
      console.error(`Error updating instance ${uid} property ${propName}:`, error);
      
      // Notify about the error
      if (this._app?.eventManager) {
        this._app.eventManager.dispatchEvent(EventTypes.CLIENT_ERROR, {
          ID: 'UPDATE_INSTANCE_ERROR',
          Message: `Failed to update instance ${uid} property ${propName}`,
          Error: error.message,
          Stack: error.stack
        });
      }
      
      return null;
    }
  }
  
  /**
   * Delete a model instance
   * @param {number} uid - The ID of the instance to delete
   * @returns {boolean} True if the instance was deleted, false otherwise
   */
  deleteInstance(uid) {
    try {
      const instance = this.getInstance(uid);
      if (!instance) {
        console.warn(`Instance with ID ${uid} not found`);
        
        // Notify about the missing instance
        if (this._app?.eventManager) {
          this._app.eventManager.dispatchEvent(EventTypes.CLIENT_ERROR, {
            ID: 'INSTANCE_NOT_FOUND',
            Message: `Instance with ID ${uid} not found`
          });
        }
        
        return false;
      }
      
      // Remove the instance from the map
      this.instances.delete(uid);
      
      // Dispatch model updated event
      if (this._app?.eventManager) {
        this._app.eventManager.dispatchEvent(EventTypes.CLIENT_MODEL_UPDATED, {
          Data: null
        });
      }
      
      return true;
    } catch (error) {
      console.error(`Error deleting instance ${uid}:`, error);
      
      // Notify about the error
      if (this._app?.eventManager) {
        this._app.eventManager.dispatchEvent(EventTypes.CLIENT_ERROR, {
          ID: 'DELETE_INSTANCE_ERROR',
          Message: `Failed to delete instance ${uid}`,
          Error: error.message,
          Stack: error.stack
        });
      }
      
      return false;
    }
  }
  
  /**
   * Clean up object references when an object is deleted or replaced
   * @param {Object} obj - The object to clean up
   * @private
   */
  _cleanupObjectReferences(obj) {
    if (!obj || typeof obj !== 'object') {
      return;
    }
    
    // If this is a model instance with a UID, remove it from the instances map
    if (obj.uid && this.instances.has(obj.uid)) {
      this.instances.delete(obj.uid);
    }
    
    // Recursively clean up object properties
    for (const [key, value] of Object.entries(obj)) {
      if (value && typeof value === 'object') {
        this._cleanupObjectReferences(value);
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
      
      // Log diagnostic information about registered classes
      console.log('--- Class Registration Diagnostics ---');
      const registeredClasses = this._modelManager.getAllRegisteredClassNames();
      console.log(`Total registered classes: ${registeredClasses.length}`);
      
      for (const className of registeredClasses) {
        const status = this._modelManager.getRegistrationStatus(className);
        console.log(`${className}: Constructor: ${status.hasConstructor ? 'YES' : 'NO'}, Definition: ${status.hasDefinition ? 'YES' : 'NO'}`);
      }
      
      console.log(`Root class '${this._rootClassName}' is fully registered.`);
      console.log('--- End Diagnostics ---');
      
      // Create root instance from the data
      const rootInstance = this.createInstance(this._rootClassName, data);
      
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
    
    // Verify all required classes are registered
    const registeredClasses = this._modelManager.getAllRegisteredClassNames();
    console.log(`Registered classes before instance creation: ${registeredClasses.join(', ')}`);
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
    
    if (!this._modelManager) {
      console.error('ModelClassDefinitionManager not initialized');
      return data;
    }
    
    // Verify class registration status
    const status = this._modelManager.getRegistrationStatus(className);
    if (!status.registered) {
      console.warn(`Class not registered: ${className}`);
      return data;
    }
    
    if (!status.hasDefinition) {
      console.warn(`Class registered but no definition found: ${className}`);
      return data;
    }
    
    // Get the class definition
    const definition = this._modelManager.getDefinition(className);
    if (!definition || !definition.Properties) {
      console.warn(`Invalid definition for class: ${className}`);
      return data;
    }
    
    try {
      const result = { ...data };
      
      // Process each property according to its definition
      for (const [propName, propInfo] of Object.entries(definition.Properties)) {
        if (data.hasOwnProperty(propName)) {
          result[propName] = this._processPropertyValue(propInfo, data[propName]);
        }
      }
      
      return result;
    } catch (error) {
      console.error(`Error processing data for ${className}:`, error);
      return data;
    }
  }
  
  /**
   * Process a property value based on its property info
   * @param {Object} propInfo - The property info
   * @param {*} value - The value to process
   * @returns {*} The processed value
   * @private
   */
  _processPropertyValue(propInfo, value) {
    // Implementation details...
  }
  
  /**
   * Get property info for a class property
   * @param {string} className - The class name
   * @param {string} propName - The property name
   * @returns {Object|null} The property info or null if not found
   * @private
   */
  _getPropertyInfo(className, propName) {
    if (!this._modelManager) {
      console.error('ModelClassDefinitionManager not initialized');
      return null;
    }
    
    try {
      return this._modelManager.getPropertyInfo(className, propName);
    } catch (error) {
      console.error(`Error getting property info for ${className}.${propName}:`, error);
      return null;
    }
  }
}

// Export as default for easier imports
export default ClientModel;
