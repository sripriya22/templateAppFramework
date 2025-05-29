import { EventManager } from '../controller/EventManager.js';
import { EventTypes } from '../controller/EventTypes.js';

describe('Event System', () => {
  let eventManager;

  beforeEach(() => {
    eventManager = new EventManager();
  });

  afterEach(() => {
    eventManager.removeAllEventListeners();
  });

  test('should add and trigger event listener', () => {
    let callCount = 0;
    let receivedData = null;
    
    const listener = (data) => {
      callCount++;
      receivedData = data;
    };
    
    // Add listener
    eventManager.addEventListener('testEvent', listener);
    
    // Trigger event
    const testData = { message: 'test' };
    eventManager.dispatchEvent('testEvent', testData);
    
    expect(callCount).toBe(1);
    expect(receivedData).toEqual(testData);
    
    // Remove listener
    eventManager.removeEventListener('testEvent', listener);
    
    // Trigger event again - listener should not be called
    eventManager.dispatchEvent('testEvent', { message: 'test2' });
    
    expect(callCount).toBe(1); // Should still be 1
  });

  test('should validate event data', () => {
    // Test with valid data
    const validData = { Data: { key: 'value' } };
    expect(() => {
      EventTypes.validateEventData(EventTypes.CLIENT_MODEL_UPDATED, validData);
    }).not.toThrow();

    // Test with invalid data
    const invalidData = { /* Missing required Data field */ };
    expect(() => {
      EventTypes.validateEventData(EventTypes.CLIENT_MODEL_UPDATED, invalidData);
    }).toThrow();
  });
});
