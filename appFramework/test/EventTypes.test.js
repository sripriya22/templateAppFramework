import { EventTypes } from '../controller/EventTypes.js';

describe('EventTypes', () => {
  // Test all event type constants
  describe('Constants', () => {
    const expectedConstants = [
      'CLIENT_ERROR',
      'CLIENT_MODEL_UPDATED',
      'APP_INITIALIZED',
      'VIEW_TO_MODEL_PROPERTY_CHANGED',
      'MODEL_TO_VIEW_PROPERTY_CHANGED',
      'INSTANCE_CREATED',
      'INSTANCE_DELETED',
      'SERVER_ERROR',
      'SERVER_MODEL_UPDATED',
      'CLIENT_WARNING',
      'SERVER_WARNING'
    ];

    expectedConstants.forEach(constant => {
      test(`should have ${constant} constant`, () => {
        expect(EventTypes[constant]).toBeDefined();
        expect(typeof EventTypes[constant]).toBe('string');
      });
    });
  });

  describe('_getSchema', () => {
    test('should return schema for a valid event type', () => {
      const schema = EventTypes._getSchema(EventTypes.CLIENT_MODEL_UPDATED);
      expect(schema).toBeDefined();
      expect(schema.required).toBeDefined();
      expect(schema.required.Data).toBeDefined();
    });

    test('should resolve schema references', () => {
      // SERVER_MODEL_UPDATED references CLIENT_MODEL_UPDATED
      const schema = EventTypes._getSchema(EventTypes.SERVER_MODEL_UPDATED);
      expect(schema).toBeDefined();
      expect(schema.required.Data).toBeDefined();
    });

    test('should throw for unknown event type', () => {
      expect(() => {
        EventTypes._getSchema('UNKNOWN_EVENT_TYPE');
      }).toThrow('Unknown event type: UNKNOWN_EVENT_TYPE');
    });

    test('should throw for null or undefined event type', () => {
      expect(() => EventTypes._getSchema(null)).toThrow('Invalid event type: null or undefined');
      expect(() => EventTypes._getSchema(undefined)).toThrow('Invalid event type: null or undefined');
      expect(() => EventTypes._getSchema('UNKNOWN_EVENT')).toThrow('Unknown event type: UNKNOWN_EVENT');
    });
  });

  describe('create', () => {
    test('should create a valid event with all required fields', () => {
      const eventData = {
        Data: { some: 'data' }
      };
      const event = EventTypes.create(EventTypes.CLIENT_MODEL_UPDATED, eventData);
      
      expect(event).toBeDefined();
      expect(event.type).toBe(EventTypes.CLIENT_MODEL_UPDATED);
      expect(event.Data).toEqual(eventData.Data);
      expect(event.timestamp).toBeDefined();
    });

    test('should include optional fields when provided', () => {
      const eventData = {
        Data: { some: 'data' },
        source: 'test',
        customField: 'value'
      };
      const event = EventTypes.create(EventTypes.CLIENT_MODEL_UPDATED, eventData);
      
      expect(event.source).toBe('test');
      expect(event.customField).toBe('value');
    });

    test('should throw for missing required fields', () => {
      expect(() => {
        EventTypes.create(EventTypes.CLIENT_MODEL_UPDATED, {});
      }).toThrow("Event 'client_model_updated': Missing required field 'Data' (The model data)");
    });

    test('should validate field types', () => {
      expect(() => {
        EventTypes.create(EventTypes.CLIENT_MODEL_UPDATED, { Data: 'not-an-object' });
      }).toThrow("Event 'client_model_updated': Field 'Data' must be of type 'object', got string");
    });

    test('should handle VIEW_TO_MODEL_PROPERTY_CHANGED event', () => {
      const eventData = {
        path: 'some.path',
        value: 'test value',
        oldValue: 'old value',
        model: {},
        source: 'test',
        uid: 123,
        className: 'TestClass',
        property: 'testProperty'
      };
      
      const event = EventTypes.create(EventTypes.VIEW_TO_MODEL_PROPERTY_CHANGED, eventData);
      
      expect(event.type).toBe(EventTypes.VIEW_TO_MODEL_PROPERTY_CHANGED);
      expect(event.path).toBe(eventData.path);
      expect(event.value).toBe(eventData.value);
      expect(event.oldValue).toBe(eventData.oldValue);
      expect(event.source).toBe(eventData.source);
      expect(event.uid).toBe(eventData.uid);
      expect(event.className).toBe(eventData.className);
      expect(event.property).toBe(eventData.property);
    });

    test('should handle MODEL_TO_VIEW_PROPERTY_CHANGED event', () => {
      const eventData = {
        path: 'some.path',
        value: 'test value',
        oldValue: 'old value',
        model: {},
        source: 'calculation'
      };
      
      const event = EventTypes.create(EventTypes.MODEL_TO_VIEW_PROPERTY_CHANGED, eventData);
      
      expect(event.type).toBe(EventTypes.MODEL_TO_VIEW_PROPERTY_CHANGED);
      expect(event.path).toBe(eventData.path);
      expect(event.value).toBe(eventData.value);
      expect(event.oldValue).toBe(eventData.oldValue);
      expect(event.model).toBe(eventData.model);
      expect(event.source).toBe(eventData.source);
    });

    test('should handle INSTANCE_CREATED event', () => {
      const instance = { id: 1, name: 'Test' };
      const eventData = {
        instance,
        className: 'TestClass',
        uid: 123,
        parent: { id: 'parent' },
        parentPath: 'parent.path'
      };
      
      const event = EventTypes.create(EventTypes.INSTANCE_CREATED, eventData);
      
      expect(event.type).toBe(EventTypes.INSTANCE_CREATED);
      expect(event.instance).toBe(instance);
      expect(event.className).toBe(eventData.className);
      expect(event.uid).toBe(eventData.uid);
      expect(event.parent).toBe(eventData.parent);
      expect(event.parentPath).toBe(eventData.parentPath);
    });
  });

  describe('_validateRequiredFields', () => {
    test('should not throw for valid data', () => {
      const event = { name: 'test', count: 42 };
      const schema = {
        required: {
          name: { type: 'string', description: 'The name' },
          count: { type: 'number', description: 'The count' }
        }
      };
      
      // Mock console.warn to suppress the warning during test
      const originalWarn = console.warn;
      console.warn = jest.fn();
      
      expect(() => {
        EventTypes._validateRequiredFields(event, 'TEST_EVENT', schema);
      }).not.toThrow();
      
      // Restore console.warn
      console.warn = originalWarn;
    });

    test('should throw for missing required fields', () => {
      const event = { name: 'test' }; // Missing count field
      const schema = {
        required: {
          name: { type: 'string', description: 'The name' },
          count: { type: 'number', description: 'The count' }
        }
      };
      
      // Mock console.warn to suppress the warning during test
      const originalWarn = console.warn;
      console.warn = jest.fn();
      
      expect(() => {
        EventTypes._validateRequiredFields(event, 'TEST_EVENT', schema);
      }).toThrow("Event 'TEST_EVENT': Missing required field 'count' (The count)");
      
      // Restore console.warn
      console.warn = originalWarn;
    });

    test('should validate field types', () => {
      const event = { name: 123, count: 42 }; // name is a number, should be string
      const schema = {
        required: {
          name: { type: 'string', description: 'The name' },
          count: { type: 'number', description: 'The count' }
        }
      };
      
      // Mock console.warn to suppress the warning during test
      const originalWarn = console.warn;
      console.warn = jest.fn();
      
      expect(() => {
        EventTypes._validateRequiredFields(event, 'TEST_EVENT', schema);
      }).toThrow("Event 'TEST_EVENT': Field 'name' must be of type 'string', got number");
      
      // Restore console.warn
      console.warn = originalWarn;
    });
    
    test('should warn about unexpected fields', () => {
      const event = { name: 'test', count: 42, extra: 'field' }; // extra is unexpected
      const schema = {
        required: {
          name: { type: 'string', description: 'The name' },
          count: { type: 'number', description: 'The count' }
        }
      };
      
      // Mock console.warn to test the warning
      const originalWarn = console.warn;
      console.warn = jest.fn();
      
      // This should not throw, just log a warning
      EventTypes._validateRequiredFields(event, 'TEST_EVENT', schema);
      
      // Verify the warning was logged
      expect(console.warn).toHaveBeenCalledWith(
        "Event 'TEST_EVENT': Unexpected fields: extra"
      );
      
      // Restore console.warn
      console.warn = originalWarn;
    });
  });
});
