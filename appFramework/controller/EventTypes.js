/**
 * Event Types and their schemas
 * @readonly
 * @namespace
 */
export const EventTypes = Object.freeze({
  // Event Type Constants
  CLIENT_MODEL_UPDATED: 'CLIENT_MODEL_UPDATED',
  SERVER_MODEL_UPDATED: 'SERVER_MODEL_UPDATED',
  CLIENT_ERROR: 'CLIENT_ERROR',
  SERVER_ERROR: 'SERVER_ERROR',
  CLIENT_WARNING: 'CLIENT_WARNING',
  SERVER_WARNING: 'SERVER_WARNING',

  // Schema Definitions
  _schemas: {
    // Model Update Event
    CLIENT_MODEL_UPDATED: {
      required: {
        Data: { type: 'object', description: 'The model data' }
      },
      optional: {
        // Removed Source and Timestamp as they'll be handled by the event system
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
    SERVER_WARNING: 'CLIENT_WARNING'
  },

  /**
   * Get the schema for an event type
   * @param {string} eventType - The event type
   * @returns {Object} The schema for the event type
   * @private
   */
  _getSchema(eventType) {
    const schema = this._schemas[eventType];
    if (!schema) {
      throw new Error(`Unknown event type: ${eventType}`);
    }
    return typeof schema === 'string' ? this._schemas[schema] : schema;
  },

  /**
   * Create a properly formatted event
   * @param {string} type - The event type (must be one of the defined constants)
   * @param {Object} [data={}] - The event data
   * @returns {Object} The formatted event object with all required and optional fields
   * @throws {Error} If required fields are missing or invalid
   */
  create(type, data = {}) {
    const schema = this._getSchema(type);
    const event = { ...data };
    
    // Add default null for missing optional fields
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
      throw new Error('Event must be an object');
    }
    
    // Check required fields
    for (const [field, { type: expectedType, description }] of Object.entries(schema.required || {})) {
      if (!(field in event)) {
        throw new Error(`Missing required field '${field}' (${description})`);
      }
      
      // Check field type if specified
      if (expectedType !== 'any' && 
          event[field] !== null && 
          event[field] !== undefined && 
          typeof event[field] !== expectedType) {
        throw new Error(`Field '${field}' must be of type '${expectedType}'`);
      }
    }
  }
});
