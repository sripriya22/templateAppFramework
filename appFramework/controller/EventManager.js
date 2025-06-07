import { EventTypes } from './EventTypes.js';

/**
 * EventManager - Handles event registration and dispatching
 * Manages event listeners and dispatches events to registered handlers
 */
class EventManager {
  constructor() {
    /** @private */
    this.listeners = new Map();
  }

  /**
   * Register an event listener for a specific event type
   * @param {string} eventType - The type of event to listen for
   * @param {Function} listener - The callback function to be called when the event is dispatched
   * @returns {Function} A function to unregister this listener
   */
  addEventListener(eventType, listener) {
    console.log(`Adding event listener for: ${eventType}`);
    
    if (typeof eventType !== 'string' || !eventType) {
      throw new Error('Event type must be a non-empty string');
    }
    
    if (typeof listener !== 'function') {
      throw new Error('Listener must be a function');
    }

    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, new Set());
    }

    const listeners = this.listeners.get(eventType);
    listeners.add(listener);

    // Return a function to remove this specific listener
    return () => this.removeEventListener(eventType, listener);
  }

  /**
   * Remove a specific listener for an event type
   * @param {string} eventType - The event type to remove the listener from
   * @param {Function} listener - The listener function to remove
   */
  removeEventListener(eventType, listener) {
    if (!this.listeners.has(eventType)) return;
    
    const listeners = this.listeners.get(eventType);
    listeners.delete(listener);

    // Clean up empty listener sets
    if (listeners.size === 0) {
      this.listeners.delete(eventType);
    }
  }

  /**
   * Remove all listeners for a specific event type, or all events if no type is provided
   * @param {string} [eventType] - Optional event type to clear listeners for
   */
  removeAllEventListeners(eventType) {
    if (eventType) {
      this.listeners.delete(eventType);
    } else {
      this.listeners.clear();
    }
  }

  /**
   * Dispatch an event to all registered listeners
   * @param {string} eventType - The type of event to dispatch (must be a valid EventType)
   * @param {Object} [data={}] - Event data to pass to the listeners
   * @throws {Error} If the event type is invalid or the event data doesn't match the schema
   */
  dispatchEvent(eventType, data = {}) {
    console.log(`Dispatching event: ${eventType}`, data);
    
    if (!eventType) {
      const error = new Error('Cannot dispatch event: eventType is required');
      console.error(error);
      throw error; // Throw hard error to expose implementation bugs
    }

    let eventData;
    try {
      // Create and validate the event data using EventTypes
      // This will throw if the event type is not defined in EventTypes or if the data doesn't match the schema
      eventData = EventTypes.create(eventType, data);
    } catch (error) {
      // Add more context to the error to help debugging
      const enhancedError = new Error(`Failed to dispatch event '${eventType}': ${error.message}`);
      enhancedError.originalError = error;
      enhancedError.eventType = eventType;
      enhancedError.eventData = data;
      console.error(enhancedError);
      throw enhancedError; // Throw hard error to expose implementation bugs
    }

    // Get all listeners for this event type
    const listeners = this.listeners.get(eventType) || [];
    
    // Call each listener with the event data
    listeners.forEach(listener => {
      try {
        if (typeof listener !== 'function') {
          console.error(`Invalid listener for event ${eventType}:`, listener);
          return;
        }
        listener(eventData);
      } catch (error) {
        console.error(`Error in event listener for ${eventType}:`, error);
        console.error('Listener function:', listener);
      }
    });
  }

  /**
   * Check if there are any listeners for a specific event type
   * @param {string} eventType - The event type to check
   * @returns {boolean} True if there are listeners for this event type
   */
  hasListeners(eventType) {
    return this.listeners.has(eventType) && this.listeners.get(eventType).size > 0;
  }
}

// Export the class and a default instance
export { EventManager };

export const eventManager = new EventManager();

export default EventManager;
