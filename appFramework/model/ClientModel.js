// js/model/ClientModel.js
import { ModelClassDefinitionManager } from './ModelClassDefinitionManager.js';
import { EventListener } from '../controller/EventListener.js';
import { EventTypes } from '../controller/EventTypes.js';
import { ModelPathUtils } from '../utils/ModelPathUtils.js';

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
   * @param {Object} options.modelDefinitions - Map of model definitions keyed by class name (required)
   * @param {Array<Function>} options.modelClasses - Array of model class constructors (required)
   */
  constructor(options = {}) {
    const { app, rootClassName, modelDefinitions, modelClasses } = options;
    
    if (!app) {
      throw new Error('App instance is required');
    }
    
    if (!rootClassName) {
      throw new Error('Root class name is required');
    }
    
    if (!modelDefinitions || Object.keys(modelDefinitions).length === 0) {
      throw new Error('Model definitions are required');
    }
    
    // Model classes are now optional - we can operate with just JSON definitions
    // if no custom model classes are provided
    
    // Initialize EventListener with the app
    super(app);
    
    /** @private */
    this._app = app;
    
    /** @private */
    this._rootClassName = rootClassName;
    
    /** @private */
    this._modelDefinitions = modelDefinitions;
    
    /** @private */
    this._modelClasses = {};
    
    // Convert array of model classes to object keyed by className
    if (modelClasses) {
      for (const ModelClass of modelClasses) {
        // Use className or name property to identify the class
        const className = ModelClass.className || ModelClass.name;
        if (className) {
          this._modelClasses[className] = ModelClass;
        }
      }
    }
    
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
   * Registers all provided model classes and their definitions
   * If model classes are not provided, synthetic classes will be created from JSON definitions
   * @private
   * @returns {Promise<boolean>} True if all models were registered successfully
   */
  async _loadAndRegisterModels() {
    console.log('Starting to register model classes and definitions...');
    
    try {
      // First, check if we have JSON definitions
      const definitionNames = Object.keys(this._modelDefinitions);
      console.log(`Found ${definitionNames.length} model definitions...`);
      
      if (definitionNames.length === 0) {
        throw new Error('No model definitions provided');
      }
      
      // Initialize synthetic classes if real ones aren't provided
      if (!this._modelClasses || Object.keys(this._modelClasses).length === 0) {
        console.log('No model classes provided, generating synthetic classes from JSON definitions');
        this._modelClasses = {};
        
        // Create synthetic class for each definition
        for (const className of definitionNames) {
          const definition = this._modelDefinitions[className];
          this._modelClasses[className] = this._createSyntheticModelClass(className, definition);
        }
      }
      
      // Register all model classes
      const classNames = Object.keys(this._modelClasses);
      console.log(`Registering ${classNames.length} model classes...`);
      
      for (const className of classNames) {
        const ModelClass = this._modelClasses[className];
        
        // Ensure the class has a className property
        if (!ModelClass.className) {
          console.log(`Setting className '${className}' on model class`);
          ModelClass.className = className;
        }
        
        // Register the class with the manager
        this._modelManager.registerClass(className, ModelClass);
        console.log(`Registered model class: ${className}`);
      }
      
      // Register all model definitions
      console.log(`Registering model definitions...`);
      
      for (const className of definitionNames) {
        try {
          const definition = this._modelDefinitions[className];
          if (!definition) {
            console.warn(`Missing definition for ${className}, skipping`);
            continue;
          }
          
          const ModelClass = this._modelClasses[className];
          if (ModelClass) {
            // Store the definition on the class for reference
            ModelClass.modelDefinition = definition;
          }
          
          // Register the definition with the manager
          this._modelManager.registerClassDefinition(className, definition, ModelClass);
          console.log(`Successfully registered definition for ${className}`);
        } catch (error) {
          console.error(`Error registering definition for ${className}:`, error);
          throw new Error(`Failed to register definition for ${className}: ${error.message}`);
        }
      }
      
      // Verify the root class is registered and has a definition
      if (!this._modelManager.isClassRegistered(this._rootClassName)) {
        throw new Error(`Root class ${this._rootClassName} was not registered`);
      }
      
      const rootClassDef = this._modelManager.getDefinition(this._rootClassName);
      if (!rootClassDef) {
        throw new Error(`No definition found for root class: ${this._rootClassName}`);
      }
      
      console.log(`Model registration complete. Root class ${this._rootClassName} is registered with definition.`);
      this._initialized = true;
      
      return true;
      
    } catch (error) {
      console.error('Error in _loadAndRegisterModels:', error);
      this._initialized = false;
      
      // Re-throw to be handled by the caller
      throw error;
    }
  }
  
  /**
   * Creates a synthetic model class from a JSON definition
   * @param {string} className - The name of the class to create
   * @param {Object} classDefinition - The class definition from JSON
   * @returns {Function} A synthetic model class constructor
   * @private
   */
  _createSyntheticModelClass(className, classDefinition = {}) {
    // Extract property definitions to understand types
    const propertyDefs = classDefinition?.Properties || {};
    
    // Create a simple class constructor that accepts properties via object
    const SyntheticModelClass = function(data = {}) {
      // Set the _className property first - critical for view components
      this._className = className;
      
      // Process each property based on its type
      for (const [key, value] of Object.entries(data)) {
        // Special handling for boolean values to ensure proper type
        if (typeof value === 'boolean' || 
            value === 'true' || value === 'false' || 
            propertyDefs[key]?.Type === 'Boolean') {
          this[key] = typeof value === 'string' 
            ? value.toLowerCase() === 'true'
            : Boolean(value);
        } else if (value === null || value === undefined) {
          this[key] = value;
        } else if (typeof value === 'object') {
          this[key] = value;
        } else if (!isNaN(Number(value)) && propertyDefs[key]?.Type === 'Number') {
          this[key] = Number(value);
        } else {
          this[key] = value;
        }
      }
      
      // Ensure the instance has an ID
      if (!this.id && !this.ID) {
        this.id = Math.floor(Math.random() * 1000000);
      }
    };
    
    // Add static properties
    SyntheticModelClass.className = className;
    
    // Add prototype methods
    SyntheticModelClass.prototype.toJSON = function() {
      // Simple serialization - convert the instance to a plain object
      const serialized = {};
      for (const [key, value] of Object.entries(this)) {
        // Skip functions and private properties
        if (typeof value !== 'function' && !key.startsWith('_')) {
          serialized[key] = value;
        }
      }
      return serialized;
    };
    
    console.log(`Created synthetic model class: ${className}`);
    return SyntheticModelClass;
  }

  /**
   * Get the events this component subscribes to
   * @returns {Object} Map of event types to handler methods
   */
  getSubscribedEvents() {
    return [
      EventTypes.SERVER_MODEL_UPDATED,
      EventTypes.SERVER_MODEL_PROPERTY_UPDATED,
      EventTypes.VIEW_TO_MODEL_PROPERTY_CHANGED
    ];
  }
  
  /**
   * Handle property updates from the server
   * @param {Object} eventData - The event data containing the property update
   * @param {string} eventData.ObjectPath - The path to the object containing the property
   * @param {string} eventData.PropertyName - The name of the property that changed
   * @param {any} eventData.Value - The new value of the property
   */
  handle_server_model_property_updated(eventData) {
    try {
      // Extract data using PascalCase field names from server
      const { ObjectPath, PropertyName, Value, Source } = eventData;
      
      if (!ObjectPath || !PropertyName) {
        console.error('Invalid property update event - missing ObjectPath or PropertyName:', eventData);
        return;
      }
      
      // Construct the full path using standardized utilities
      // Server provides ObjectPath as the path to the object containing the property
      // We need to create a standardized path including the PropertyName
      const { segments, indices } = ModelPathUtils.parseObjectPath(ObjectPath);
      const fullPathSegments = [...segments, PropertyName];
      const fullPath = ModelPathUtils.createObjectPath(fullPathSegments, indices);
      
      // Get the root instance from the client model
      const rootInstance = this.getRootInstance();
      if (!rootInstance) {
        console.warn('Cannot update property: No model loaded');
        return;
      }
      
      // Get the current value for comparison using standardized utility
      const oldValue = ModelPathUtils.getValueFromObjectPath(rootInstance, fullPath);
      
      // Check if this is confirming a pending change from this client
      if (this._pendingChanges.has(fullPath)) {
        // This is a confirmation of a client-initiated change - mark it confirmed
        this.confirmPendingChange(fullPath);
        
        // If the value matches what we already have, no need to update the model
        if (JSON.stringify(oldValue) === JSON.stringify(Value)) {
          console.debug(`Server confirmed change for ${fullPath}, value already matches`);
          return;
        }
      }
      
      // Update the property in the model using standardized utility
      const success = ModelPathUtils.setValueAtObjectPath(rootInstance, fullPath, Value);
      
      if (success) {
        console.debug(`Updated property at path ${fullPath} to:`, Value);
        
        // Let the BindingManager handle the view updates by dispatching a MODEL_TO_VIEW_PROPERTY_CHANGED event
        // The BindingManager subscribes to this event and will update all relevant view components
        if (this._app?.eventManager) {
          this._app.eventManager.dispatchEvent(EventTypes.MODEL_TO_VIEW_PROPERTY_CHANGED, {
            ObjectPath: ObjectPath,
            Property: PropertyName,
            Value: Value,
            OldValue: oldValue,
            Source: Source || 'server'
          });
        }
      } else {
        console.error(`Failed to update property at path ${fullPath}`);
        
        // Notify about the error
        if (this._app?.eventManager) {
          this._app.eventManager.dispatchEvent(EventTypes.CLIENT_ERROR, {
            ID: 'PROPERTY_UPDATE_ERROR',
            Message: `Failed to update property at path ${fullPath}`,
            Error: 'Path not found in model'
          });
        }
      }
      
    } catch (error) {
      console.error('Error handling server property update:', error);
      
      // Notify about the error
      if (this._app?.eventManager) {
        this._app.eventManager.dispatchEvent(EventTypes.CLIENT_ERROR, {
          ID: 'PROPERTY_UPDATE_ERROR',
          Message: 'Failed to process server property update',
          Error: error.message,
          Stack: error.stack
        });
      }
    }
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
   * Handle view-to-model property changes
   * @param {Object} eventData - The event data containing the property change
   * @param {string} eventData.path - The full path to the property (backward compatibility)
   * @param {string} eventData.objectPath - The path to the object containing the property
   * @param {string} eventData.property - The name of the property that changed
   * @param {any} eventData.value - The new value of the property
   * @param {any} eventData.oldValue - The previous value of the property (optional)
   * @param {string} eventData.source - The source of the change (optional)
   */
  handle_view_to_model_property_changed(eventData) {
    try {
      // Extract data using lowercase field names from binding framework
      const { path, objectPath, property, value, oldValue, source } = eventData;
      
      if (!path || !property) {
        console.error('Invalid property change event - missing required fields:', eventData);
        return;
      }
      
      // Use the path from the event - either as provided or reconstructed from objectPath and property
      // This ensures backward compatibility with code that might still use path only
      let standardizedPath = path;
      
      // If we have both objectPath and property, prefer using those to construct the path
      if (objectPath !== undefined && property !== undefined) {
        try {
          // Construct the full path from objectPath and property
          standardizedPath = objectPath ? `${objectPath}.${property}` : property;
        } catch (err) {
          console.error(`Failed to construct path from objectPath and property:`, err);
          return;
        }
      }
      
      // Ensure the path is in standardized format
      let standardizedFullPath;
      try {
        const { segments, indices } = ModelPathUtils.parseObjectPath(standardizedPath);
        standardizedFullPath = ModelPathUtils.createObjectPath(segments, indices);
      } catch (err) {
        console.error(`Failed to standardize path format for ${standardizedPath}:`, err);
        return;
      }
      
      // Get the root instance from the client model
      const rootInstance = this.getRootInstance();
      if (!rootInstance) {
        console.warn('Cannot update property: No model loaded');
        return;
      }
      
      // Update the property in the model using standardized utility
      const success = ModelPathUtils.setValueAtObjectPath(rootInstance, standardizedFullPath, value);
      
      if (success) {
        console.debug(`Updated property at path ${standardizedFullPath} to:`, value);
        
        // Track this change as pending until confirmed by server
        this.trackPendingChange(standardizedFullPath, value, oldValue);
        
        // Send the change to the server
        this.sendPropertyChangeToServer(standardizedFullPath, value);
        
        // Dispatch MODEL_TO_VIEW_PROPERTY_CHANGED to update all views
        if (this._app?.eventManager) {
          // Use the property from the event data directly when available, otherwise extract it
          const propertyName = property || (() => {
            const parsedPath = ModelPathUtils.parseObjectPath(standardizedFullPath);
            return parsedPath.segments[parsedPath.segments.length - 1];
          })();
          
          // Use the objectPath from the event data when available, otherwise extract it
          const objectPathValue = objectPath || (() => {
            const parsedPath = ModelPathUtils.parseObjectPath(standardizedFullPath);
            const objectSegments = parsedPath.segments.slice(0, -1);
            const objectIndices = parsedPath.indices.slice(0, parsedPath.indices.length - (parsedPath.segments.length - objectSegments.length));
            return objectSegments.length > 0 ? 
              ModelPathUtils.createObjectPath(objectSegments, objectIndices) : '';
          })();
          
          this._app.eventManager.dispatchEvent(EventTypes.MODEL_TO_VIEW_PROPERTY_CHANGED, {
            ObjectPath: objectPathValue,
            Property: propertyName,
            Value: value,
            OldValue: oldValue,
            Source: source || 'view'
          });
          console.debug(`Dispatched MODEL_TO_VIEW_PROPERTY_CHANGED for path ${standardizedPath}`);
        }
      } else {
        console.error(`Failed to update property at path ${standardizedPath}`);
        
        // Notify about the error
        if (this._app?.eventManager) {
          this._app.eventManager.dispatchEvent(EventTypes.CLIENT_ERROR, {
            ID: 'PROPERTY_UPDATE_ERROR',
            Message: `Failed to update property at path ${standardizedPath}`,
            Error: 'Path not found in model'
          });
        }
      }
      
    } catch (error) {
      console.error('Error handling view-to-model property change:', error);
      
      // Notify about the error
      if (this._app?.eventManager) {
        this._app.eventManager.dispatchEvent(EventTypes.CLIENT_ERROR, {
          ID: 'PROPERTY_UPDATE_ERROR',
          Message: 'Failed to process view-to-model property change',
          Error: error.message,
          Stack: error.stack
        });
      }
    }
  }
  
  /**
   * Track a pending property change
   * @param {string} path - The path to the property
   * @param {any} value - The new value
   * @param {any} oldValue - The previous value
   */
  trackPendingChange(path, value, oldValue) {
    if (!path) return;
    
    this._pendingChanges.set(path, {
      path,
      value,
      oldValue,
      timestamp: Date.now(),
      status: 'pending'
    });
    
    console.debug(`Tracked pending change for ${path}:`, { value, oldValue });
  }
  
  /**
   * Mark a pending change as rejected
   * @param {string} path - The path to the property
   * @param {string} errorMessage - The error message
   * @private
   */
  _markPendingChangeAsRejected(path, errorMessage) {
    if (!path || !this._pendingChanges.has(path)) return;
    
    const pendingChange = this._pendingChanges.get(path);
    pendingChange.status = 'rejected';
    pendingChange.error = errorMessage || 'Change rejected by server';
    
    console.debug(`Marked pending change as rejected for ${path}:`, pendingChange);
    
    // Dispatch an error event
    if (this._app?.eventManager) {
      this._app.eventManager.dispatchEvent(EventTypes.CLIENT_ERROR, {
        ID: 'PROPERTY_CHANGE_REJECTED',
        Message: `Property change for ${path} was rejected by the server`,
        Error: errorMessage || 'No error details provided'
      });
    }
    
    // Roll back the change in the model
    this._rollBackRejectedChange(path, pendingChange.oldValue);
    
    // Clean up the rejected change after a delay
    setTimeout(() => {
      if (this._pendingChanges.has(path) && 
          this._pendingChanges.get(path).status === 'rejected') {
        this._pendingChanges.delete(path);
        console.debug(`Cleaned up rejected change for ${path}`);
      }
    }, 5000); // Clean up after 5 seconds
  }
  
  /**
   * Roll back a rejected property change
   * @param {string} path - The path to the property
   * @param {any} oldValue - The previous value to restore
   * @private
   */
  _rollBackRejectedChange(path, oldValue) {
    if (!path) return;
    
    const rootInstance = this.getRootInstance();
    if (!rootInstance) {
      console.warn('Cannot rollback rejected change: No model loaded');
      return;
    }
    
    // Restore the old value in the model
    const success = ModelPathUtils.setValueAtPath(rootInstance, path, oldValue);
    
    if (success) {
      console.debug(`Rolled back rejected change for ${path} to:`, oldValue);
      
      // Dispatch MODEL_TO_VIEW_PROPERTY_CHANGED to update all views with the original value
      if (this._app?.eventManager) {
        // Parse the path to get property name using standardized utilities
        const { segments } = ModelPathUtils.parseObjectPath(path);
        const propertyName = segments[segments.length - 1];
        
        this._app.eventManager.dispatchEvent(EventTypes.MODEL_TO_VIEW_PROPERTY_CHANGED, {
          Path: path,
          Property: propertyName,
          Value: oldValue,
          Source: 'rollback'
        });
        console.debug(`Dispatched MODEL_TO_VIEW_PROPERTY_CHANGED for rolled back value at ${path}`);
      }
    } else {
      console.error(`Failed to rollback rejected change for path ${path}`);
    }
  }
  
  /**
   * Send a property change to the server
   * @param {string} path - The path to the property
   * @param {any} value - The new value
   */
  sendPropertyChangeToServer(path, value) {
    if (!path) {
      console.error('Cannot send property change to server: Path is required');
      return;
    }
    
    // Parse the path using standardized utilities
    const { segments, indices } = ModelPathUtils.parseObjectPath(path);
    
    // Extract property name (last segment) and create object path (all but last segment)
    const propertyName = segments[segments.length - 1];
    const objectPathSegments = segments.slice(0, segments.length - 1);
    const objectPath = ModelPathUtils.createObjectPath(objectPathSegments, indices);
    
    // If event manager is not available, just keep the pending change tracked
    // We'll have a way to resend these later
    if (!this._app?.eventManager) {
      console.warn('Cannot send property change to server: Event manager not available, keeping as pending');
      return; // Keep the pending change, don't mark as rejected
    }
    
    // Define success callback for the method call
    const successCallback = (response) => {
      console.debug(`Server processed property change for ${path}:`, response);
      
      // If the server returned an error in the response, mark as rejected
      if (response && response.Success === false) {
        this._markPendingChangeAsRejected(path, response.Error || 'Server rejected the change');
      }
      // Otherwise, we'll wait for the SERVER_MODEL_PROPERTY_UPDATED event
      // to confirm and clear the pending change
    };
    
    // Define error callback for the method call
    const errorCallback = (error) => {
      console.error(`Error updating property ${path}:`, error);
      // Mark the pending change as rejected and roll back
      this._markPendingChangeAsRejected(path, error.message || 'Server communication error');
    };
    
    // Prepare method arguments using PascalCase field names for consistency in server communication
    const methodArgs = {
      MethodName: 'updateProperty', // Method to call
      ObjectPath: objectPath,
      Args: { 
        PropertyName: propertyName,
        Value: value,
        Source: 'Client' // Use PascalCase for consistency
      },
      // Include callbacks for handling the response
      Callback: successCallback,
      ErrorCallback: errorCallback
    };
    
    // Dispatch MATLAB_METHOD_CALL_REQUEST event through the event system
    // The service layer will pick this up, forward it to the server, and handle the response
    this._app.eventManager.dispatchEvent(EventTypes.MATLAB_METHOD_CALL_REQUEST, methodArgs);
    
    console.debug(`Sent property change to server via service layer:`, { path, value, objectPath, propertyName });
  }

/**
 * Track a pending property change
 * @param {string} path - The path to the property
 * @param {any} value - The new value
 * @param {any} oldValue - The previous value
 */
trackPendingChange(path, value, oldValue) {
  if (!path) return;
  
  this._pendingChanges.set(path, {
    path,
    value,
    oldValue,
    timestamp: Date.now(),
    status: 'pending'
  });
  
  console.debug(`Tracked pending change for ${path}:`, { value, oldValue });
}

/**
 * Mark a pending change as rejected
 * @param {string} path - The path to the property
 * @param {string} errorMessage - The error message
 * @private
 */
_markPendingChangeAsRejected(path, errorMessage) {
  if (!path || !this._pendingChanges.has(path)) return;
  
  const pendingChange = this._pendingChanges.get(path);
  pendingChange.status = 'rejected';
  pendingChange.error = errorMessage || 'Change rejected by server';
  
  console.debug(`Marked pending change as rejected for ${path}:`, pendingChange);
  
  // Dispatch an error event
  if (this._app?.eventManager) {
    this._app.eventManager.dispatchEvent(EventTypes.CLIENT_ERROR, {
      ID: 'PROPERTY_CHANGE_REJECTED',
      Message: `Property change for ${path} was rejected by the server`,
      Error: errorMessage || 'No error details provided'
    });
  }
  
  // Roll back the change in the model
  this._rollBackRejectedChange(path, pendingChange.oldValue);
  
  // Clean up the rejected change after a delay
  setTimeout(() => {
    if (this._pendingChanges.has(path) && 
        this._pendingChanges.get(path).status === 'rejected') {
      this._pendingChanges.delete(path);
      console.debug(`Cleaned up rejected change for ${path}`);
    }
  }, 5000); // Clean up after 5 seconds
}

/**
 * Roll back a rejected property change
 * @param {string} path - The path to the property
 * @param {any} oldValue - The previous value to restore
 * @private
 */
_rollBackRejectedChange(path, oldValue) {
  if (!path) return;
  
  const rootInstance = this.getRootInstance();
  if (!rootInstance) {
    console.warn('Cannot rollback rejected change: No model loaded');
    return;
  }
  
  // Restore the old value in the model
  const success = ModelPathUtils.setValueAtObjectPath(rootInstance, path, oldValue);
  
  if (success) {
    console.debug(`Rolled back rejected change for ${path} to:`, oldValue);
    
    // Dispatch MODEL_TO_VIEW_PROPERTY_CHANGED to update all views with the original value
    if (this._app?.eventManager) {
      // Parse the path to get property name using standardized utilities
      const { segments } = ModelPathUtils.parseObjectPath(path);
      const propertyName = segments[segments.length - 1];
      
      this._app.eventManager.dispatchEvent(EventTypes.MODEL_TO_VIEW_PROPERTY_CHANGED, {
        Path: path,
        Property: propertyName,
        Value: oldValue,
        Source: 'rollback'
      });
      console.debug(`Dispatched MODEL_TO_VIEW_PROPERTY_CHANGED for rolled back value at ${path}`);
    }
  } else {
    console.error(`Failed to rollback rejected change for path ${path}`);
  }
}

/**
 * Send a property change to the server
 * @param {string} path - The path to the property
 * @param {any} value - The new value
 */
sendPropertyChangeToServer(path, value) {
  if (!path) return;
  
  // Parse the path using standardized utilities
  const { segments, indices } = ModelPathUtils.parseObjectPath(path);
  
  // Extract property name (last segment) and create object path (all but last segment)
  const propertyName = segments[segments.length - 1];
  const objectPathSegments = segments.slice(0, segments.length - 1);
  const objectPath = ModelPathUtils.createObjectPath(objectPathSegments, indices);
  
  // If event manager is not available, just keep the pending change tracked
  // We'll have a way to resend these later
  if (!this._app?.eventManager) {
    console.warn('Cannot send property change to server: Event manager not available, keeping as pending');
    return; // Keep the pending change, don't mark as rejected
  }
  
  // Request ID will be generated by the service layer
  
  // Define success callback for the method call
  const successCallback = (response) => {
    console.debug(`Server processed property change for ${path}:`, response);
    
    // If the server returned an error in the response, mark as rejected
    if (response && response.Success === false) {
      this._markPendingChangeAsRejected(path, response.Error || 'Server rejected the change');
    }
    // Otherwise, we'll wait for the SERVER_MODEL_PROPERTY_UPDATED event
    // to confirm and clear the pending change
  };
  
  // Define error callback for the method call
  const errorCallback = (error) => {
    console.error(`Error updating property ${path}:`, error);
    // Mark the pending change as rejected and roll back
    this._markPendingChangeAsRejected(path, error.message || 'Server communication error');
  };
  
  // Prepare method arguments using PascalCase field names for consistency in server communication
  const methodArgs = {
    MethodName: 'updateProperty', // Method to call
    ObjectPath: objectPath,
    Args: { // Method arguments
      PropertyName: propertyName,
      Value: value,
      Source: 'Client' // Use PascalCase for consistency
    },
    // Include callbacks for handling the response
    Callback: successCallback,
    ErrorCallback: errorCallback
  };
  
  // Dispatch MATLAB_METHOD_CALL_REQUEST event through the event system
  // The service layer will pick this up, forward it to the server, and handle the response
  this._app.eventManager.dispatchEvent(EventTypes.MATLAB_METHOD_CALL_REQUEST, methodArgs);
  
  console.debug(`Sent property change to server via event system:`, { path, value, objectPath, propertyName });
  }
  
  /**
   * Mark a pending change as confirmed by the server
   * @param {string} path - The path to the property
   */
  confirmPendingChange(path) {
    if (!path || !this._pendingChanges.has(path)) return;
    
    const pendingChange = this._pendingChanges.get(path);
    pendingChange.status = 'confirmed';
    pendingChange.confirmedAt = new Date().toISOString();
    
    // Keep the confirmed change for a short time for debugging
    setTimeout(() => {
      if (this._pendingChanges.has(path)) {
        this._pendingChanges.delete(path);
      }
    }, 5000); // Remove after 5 seconds
    
    console.debug(`Confirmed pending change for ${path}`);
  }
  
  /**
   * Get all pending changes
   * @returns {Array} Array of pending changes
   */
  getPendingChanges() {
    return Array.from(this._pendingChanges.values());
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
