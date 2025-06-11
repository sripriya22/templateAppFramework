/**
 * Event Types and their schemas
 * @readonly
 * @namespace
 */
export const EventTypes = Object.freeze({
  /**
   * Event type constants
   * These are the string values that should be used when dispatching events
   */
  CLIENT_ERROR: 'client_error',
  CLIENT_MODEL_UPDATED: 'client_model_updated',
  APP_INITIALIZED: 'app_initialized',
  VIEW_TO_MODEL_PROPERTY_CHANGED: 'view_to_model_property_changed',
  MODEL_TO_VIEW_PROPERTY_CHANGED: 'model_to_view_property_changed',
  INSTANCE_CREATED: 'instance_created',
  INSTANCE_DELETED: 'instance_deleted',
  SERVER_ERROR: 'server_error',
  SERVER_MODEL_UPDATED: 'server_model_updated',
  CLIENT_WARNING: 'client_warning',
  SERVER_WARNING: 'server_warning',
  MATLAB_METHOD_CALL_REQUEST: 'matlab_method_call_request',
  SERVER_NOTIFICATION: 'server_notification',

  // Server events
  SERVER_MODEL_PROPERTY_UPDATED: 'server_model_property_updated',
  
  /**
   * Event definitions map
   * Maps event type strings to their schema definitions
   * This is the single source of truth for event types and schemas
   */
  _eventDefinitions: {
    // Model Update Event
    CLIENT_MODEL_UPDATED: {
      required: {
        Data: { type: 'object', description: 'The model data' }
      },
      optional: {
        // Removed Source and Timestamp as they'll be handled by the event system
      }
    },
    
    // App Initialized Event
    APP_INITIALIZED: {
      required: {},
      optional: {
        appName: { type: 'string', description: 'The name of the application' },
        version: { type: 'string', description: 'The version of the application' },
        timestamp: { type: 'string', description: 'Timestamp when the app was initialized' }
      }
    },
    
    // View-to-Model Property Changed Event (when view updates model)
    VIEW_TO_MODEL_PROPERTY_CHANGED: {
      required: {
        path: { type: 'string', description: 'The full path to the property that changed (backward compatibility)' },
        objectPath: { type: 'string', description: 'The path to the object containing the property' },
        property: { type: 'string', description: 'The name of the property that changed' },
        value: { type: 'any', description: 'The new value of the property' }
      },
      optional: {
        oldValue: { type: 'any', description: 'The previous value of the property' },
        model: { type: 'object', description: 'The model object containing the property' },
        source: { type: 'string', description: 'The source of the change (e.g., "view", "binding", "component")' },
        uid: { type: 'number', description: 'The unique ID of the model instance' },
        className: { type: 'string', description: 'The class name of the model' }
      }
    },
    
    // Model-to-View Property Changed Event (when model updates itself)
    MODEL_TO_VIEW_PROPERTY_CHANGED: {
      required: {
        ObjectPath: { type: 'string', description: 'The path to the object containing the property (excludes property name)' },
        Property: { type: 'string', description: 'The name of the property that changed' },
        Value: { type: 'any', description: 'The new value of the property' }
      },
      optional: {
        OldValue: { type: 'any', description: 'The previous value of the property' },
        Model: { type: 'object', description: 'The model object that contains the property' },
        Source: { type: 'string', description: 'The source of the change (e.g., "api", "calculation")' }
      }
    },
    
    // Instance Created Event
    INSTANCE_CREATED: {
      required: {
        instance: { type: 'object', description: 'The created model instance' },
        className: { type: 'string', description: 'The class name of the created instance' }
      },
      optional: {
        uid: { type: 'number', description: 'The unique ID of the created instance' },
        parent: { type: 'object', description: 'The parent model object (if any)' },
        parentPath: { type: 'string', description: 'The path to the parent property' }
      }
    },
    
    // Instance Deleted Event
    INSTANCE_DELETED: {
      required: {
        uid: { type: 'number', description: 'The unique ID of the deleted instance' },
        className: { type: 'string', description: 'The class name of the deleted instance' }
      },
      optional: {
        parent: { type: 'object', description: 'The parent model object (if any)' },
        parentPath: { type: 'string', description: 'The path to the parent property' }
      }
    },
    
    // Server Model Update Event (same schema as client update)
    SERVER_MODEL_UPDATED: 'CLIENT_MODEL_UPDATED',
    
    // Error Event
    CLIENT_ERROR: {
      required: {
        ID: { type: 'string', description: 'Unique error identifier' },
        Message: { type: 'string', description: 'Human-readable error message' }
      },
      optional: {
        Error: { type: 'any', description: 'Additional error details' }
      }
    },
    
    // Server Error Event (same schema as client error)
    SERVER_ERROR: 'CLIENT_ERROR',
    
    // Warning Event
    CLIENT_WARNING: {
      required: {
        ID: { type: 'string', description: 'Unique warning identifier' },
        Message: { type: 'string', description: 'Human-readable warning message' }
      },
      optional: {
        Details: { type: 'any', description: 'Additional warning details' }
      }
    },
    
    // Server Warning Event (same schema as client warning)
    SERVER_WARNING: 'CLIENT_WARNING',
    
    // MATLAB Method Call Request Event
    MATLAB_METHOD_CALL_REQUEST: {
      required: {
        MethodName: { type: 'string', description: 'Method name to call' },
        ObjectPath: { type: 'string', description: 'Path to target object or empty array for static methods' },
      },
      optional: {
        Args: { type: 'object', description: 'Arguments for method call' },
        Callback: { type: 'function', description: 'Function to call when the response is received' },
        ErrorCallback: { type: 'function', description: 'Function to call when an error occurs' }
      }
    },
    
    // Server Model Property Updated Event
    SERVER_MODEL_PROPERTY_UPDATED: {
      required: {
        ObjectPath: { type: 'string', description: 'Path to the object containing the property' },
        PropertyName: { type: 'string', description: 'Name of the property that changed' },
        Value: { type: 'any', description: 'New value of the property' }
      },
      optional: {
        Source: { type: 'string', description: 'Source of the property change' }
      }
    },
    
    // Server Notification Event
    SERVER_NOTIFICATION: {
      required: {
        EventID: { type: 'string', description: 'The type of event being notified' },
        EventData: { type: 'object', description: 'The data associated with the event' }
      },
      optional: {
        Source: { type: 'string', description: 'Source of the notification' }
      }
    }
  },

  /**
   * Get the schema for an event type
   * @param {string} eventType - The event type
   * @returns {Object} The schema for the event type
   * @private
   */
  _getSchema(eventType) {
    // Validate that the event type is not null or undefined
    if (!eventType) {
      throw new Error('Invalid event type: null or undefined');
    }
    
    // Validate that this is a known event type
    const isValidEventType = Object.values(this).includes(eventType);
    if (!isValidEventType) {
      throw new Error(`Unknown event type: ${eventType}`);
    }
    
    // Find the schema key (constant name) for this event type
    const schemaKey = Object.keys(this).find(key => 
      !key.startsWith('_') && // Skip private properties
      typeof this[key] !== 'function' && // Skip methods
      this[key] === eventType
    );
    
    if (!schemaKey) {
      throw new Error(`Could not find schema key for event type: ${eventType}`);
    }
    
    // Get the schema from the event definitions
    const schema = this._eventDefinitions[schemaKey];
    if (!schema) {
      throw new Error(`Schema not defined for event type: ${eventType} (key: ${schemaKey})`);
    }
    
    // Handle schema references (when one schema references another)
    return typeof schema === 'string' ? this._eventDefinitions[schema] : schema;
  },

  /**
   * Create a properly formatted event
   * @param {string} type - The event type (must be one of the defined constants)
   * @param {Object} [data={}] - The event data
   * @returns {Object} The formatted event object with all required and optional fields
   * @throws {Error} If required fields are missing or invalid or if the event type is unknown
   */
  create(type, data = {}) {
    // Validate event type first
    if (!type) {
      throw new Error('Invalid event type: null or undefined');
    }
    
    // Get the schema for this event type (will throw if invalid)
    const schema = this._getSchema(type);
    
    // Create a new event object with the provided data
    const event = { 
      type, // Always include the event type
      timestamp: new Date().toISOString(), // Add timestamp for all events
      ...data 
    };
    
    // Add default values for missing optional fields
    for (const [field, { type: fieldType }] of Object.entries(schema.optional || {})) {
      if (!(field in event)) {
        event[field] = fieldType === 'string' ? '' : 
                      fieldType === 'number' ? 0 :
                      fieldType === 'boolean' ? false :
                      fieldType === 'object' ? {} :
                      fieldType === 'array' ? [] :
                      null;
      }
    }
    
    // Validate required fields
    this._validateRequiredFields(event, type, schema);
    
    return event;
  },

  /**
   * Validate that all required fields are present and of the correct type
   * @param {Object} event - The event to validate
   * @param {string} type - The event type (for error messages)
   * @param {Object} schema - The schema to validate against
   * @throws {Error} If validation fails
   * @private
   */
  _validateRequiredFields(event, type, schema) {
    if (!event || typeof event !== 'object') {
      throw new Error(`Event for '${type}' must be an object`);
    }
    
    // Check required fields
    for (const [field, { type: expectedType, description }] of Object.entries(schema.required || {})) {
      // Check if field exists
      if (!(field in event)) {
        throw new Error(`Event '${type}': Missing required field '${field}' (${description})`);
      }
      
      // Check if field is null or undefined when it shouldn't be
      if (event[field] === null || event[field] === undefined) {
        throw new Error(`Event '${type}': Field '${field}' cannot be null or undefined`);
      }
      
      // Check field type if specified (and not 'any')
      if (expectedType !== 'any' && 
          typeof event[field] !== expectedType && 
          // Special handling for arrays since typeof [] is 'object'
          !(expectedType === 'array' && Array.isArray(event[field]))) {
        throw new Error(`Event '${type}': Field '${field}' must be of type '${expectedType}', got ${typeof event[field]}`);
      }
    }
    
    // For better debugging, check if there are any unexpected fields
    const allValidFields = new Set([
      'type',      // Added by our create method
      'timestamp', // Added by our create method
      ...Object.keys(schema.required || {}),
      ...Object.keys(schema.optional || {})
    ]);
    
    // Find any fields in the event that aren't in our schema
    const unexpectedFields = Object.keys(event).filter(field => !allValidFields.has(field));
    if (unexpectedFields.length > 0) {
      // Just log a warning, don't throw an error
      console.warn(`Event '${type}': Unexpected fields: ${unexpectedFields.join(', ')}`);
    }
  }
});
