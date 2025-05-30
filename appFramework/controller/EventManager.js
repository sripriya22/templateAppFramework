import { EventTypes } from './EventTypes.js';

/**
 * EventManager - Handles event registration and dispatching
 * Manages event listeners and dispatches events to registered handlers
 */
class EventManager {
  constructor() {
    /** @private */
    this.listeners = new Map();
    
    // Store one-time event listeners
    this.onceListeners = new Map();
  }

  /**
   * Register an event listener for a specific event type
   * @param {string} eventType - The type of event to listen for
   * @param {Function} listener - The callback function to be called when the event is dispatched
   * @returns {Function} A function to unregister this listener
   */
  addEventListener(eventType, listener) {
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
      this.onceListeners.delete(eventType);
    } else {
      this.listeners.clear();
      this.onceListeners.clear();
    }
  }

  /**
   * Register a one-time event listener that will be automatically removed after being called
   * @param {string} eventType - The type of event to listen for
   * @param {Function} listener - The callback function to be called when the event is dispatched
   * @returns {Function} A function to unregister this listener
   */
  once(eventType, listener) {
    if (typeof eventType !== 'string' || !eventType) {
      throw new Error('Event type must be a non-empty string');
    }
    
    if (typeof listener !== 'function') {
      throw new Error('Listener must be a function');
    }
    
    if (!this.onceListeners.has(eventType)) {
      this.onceListeners.set(eventType, new Set());
    }
    
    const onceListeners = this.onceListeners.get(eventType);
    onceListeners.add(listener);
    
    // Return a function to remove this specific once listener
    return () => {
      if (this.onceListeners.has(eventType)) {
        const listeners = this.onceListeners.get(eventType);
        listeners.delete(listener);
        
        if (listeners.size === 0) {
          this.onceListeners.delete(eventType);
        }
      }
    };
  }

  /**
   * Dispatch an event to all registered listeners
   * @param {string} eventType - The type of event to dispatch (must be a valid EventType)
   * @param {Object} [data={}] - Event data to pass to the listeners
   */
  dispatchEvent(eventType, data = {}) {
    if (!eventType) {
      console.error('Cannot dispatch event: eventType is required');
      return;
    }

    let eventData;
    try {
      // Create and validate the event data using EventTypes
      eventData = EventTypes.create(eventType, data);
    } catch (error) {
      console.error(`Failed to create event ${eventType}:`, error);
      return;
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
    
    // Handle one-time listeners
    const onceListeners = this.onceListeners.get(eventType);
    if (onceListeners && onceListeners.size > 0) {
      // Create a copy of the set to avoid modification during iteration
      const listenersToCall = new Set(onceListeners);
      
      // Clear all once listeners for this event
      this.onceListeners.set(eventType, new Set());
      
      // Call each once listener
      listenersToCall.forEach(listener => {
        try {
          listener(eventData);
        } catch (error) {
          console.error(`Error in once event listener for ${eventType}:`, error);
        }
      });
    }
  }

  /**
   * Add a one-time event listener
   * @param {string} eventType - The type of event to listen for
   * @param {Function} listener - The callback function
   * @returns {Function} A function to remove this listener
   */
  once(eventType, listener) {
    if (this.onceListeners.has(eventType)) {
      console.warn(`Overwriting existing one-time listener for ${eventType}`);
    }
    
    this.onceListeners.set(eventType, listener);
    
    // Return a function to remove this one-time listener
    return () => this.onceListeners.delete(eventType);
  }

  /**
   * Check if there are any listeners for a specific event type
   * @param {string} eventType - The event type to check
   * @returns {boolean} True if there are listeners for this event type
   */
  hasListeners(eventType) {
    const hasRegular = this.listeners.has(eventType) && this.listeners.get(eventType).size > 0;
    const hasOnce = this.onceListeners.has(eventType) && this.onceListeners.get(eventType).size > 0;
    return hasRegular || hasOnce;
  }
}

// Export the class and a default instance
export { EventManager };

export const eventManager = new EventManager();

export default EventManager;
