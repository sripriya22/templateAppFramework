import { EventTypes } from './EventTypes.js';

/**
 * Base class for all event listeners in the application.
 * Provides common functionality for handling events and managing subscriptions.
 */
export class EventListener {
    /**
     * Creates a new EventListener instance
     * @param {Object} app - The application instance that contains the event manager
     */
    constructor(app) {
        /** @private */
        this._app = app;
        this.isSubscribed = false;
    }
    
    /**
     * Get the event manager from the app
     * @returns {Object} The event manager instance
     * @private
     */
    get _eventManager() {
        return this._app.eventManager;
    }

    /**
     * Returns an array of event types this listener is interested in.
     * Should be overridden by subclasses.
     * @returns {Array<string>} Array of event types
     */
    getSubscribedEvents() {
        return [];
    }

    /**
     * Initialize the event listener
     * @param {...any} args - Arguments to be passed to the subclass init method
     * @returns {Promise<void>}
     */
    async init(...args) {
        this.subscribeToEvents();
        await this.onInit?.(...args);
    }

    /**
     * Optional method that can be overridden by subclasses
     * to perform additional initialization after event subscription
     * @param {...any} args - Arguments passed from init
     * @returns {Promise<void>}
     */
    async onInit(...args) {
        // Can be overridden by subclasses
    }

    /**
     * Subscribes to all events returned by getSubscribedEvents()
     * @returns {void}
     */
    subscribeToEvents() {
        if (this.isSubscribed) return;
        
        try {
            // Get events from the implementation
            const events = this.getSubscribedEvents();
            
            // Validate the events array to catch implementation bugs early
            if (!Array.isArray(events)) {
                throw new Error(`getSubscribedEvents() must return an array, got ${typeof events} instead`);
            }
            
            // Create a new array with only valid events and track any invalid ones
            const validEvents = [];
            const invalidEvents = [];
            
            for (let i = 0; i < events.length; i++) {
                const eventType = events[i];
                
                // Check for null/undefined events
                if (!eventType) {
                    // This is the critical error we want to catch and expose
                    // Instead of silently filtering it out, throw a hard error with detailed info
                    const error = new Error(`Invalid event type: null or undefined at index ${i}. Check the implementation of getSubscribedEvents() in ${this.constructor.name}`);
                    error.eventIndex = i;
                    error.className = this.constructor.name;
                    error.events = [...events]; // Copy the array for debugging
                    throw error;
                }
                
                // Check for non-string events
                if (typeof eventType !== 'string') {
                    const error = new Error(`Invalid event type: expected string, got ${typeof eventType} at index ${i}. Check the implementation of getSubscribedEvents() in ${this.constructor.name}`);
                    error.eventIndex = i;
                    error.className = this.constructor.name;
                    error.events = [...events]; // Copy the array for debugging
                    throw error;
                }
                
                // Validate against EventTypes - ensure event type is defined in EventTypes
                // This enforces EventTypes as the single source of truth
                try {
                    // This will throw if the event type is not defined in EventTypes
                    EventTypes._getSchema(eventType);
                } catch (schemaError) {
                    const error = new Error(`Invalid event type: '${eventType}' at index ${i} is not defined in EventTypes. ${schemaError.message}`);
                    error.eventIndex = i;
                    error.className = this.constructor.name;
                    error.eventType = eventType;
                    throw error;
                }
                
                validEvents.push(eventType);
            }
            
            // Subscribe to all valid events
            validEvents.forEach(eventType => {
                // Convert event type to lowercase but preserve underscores
                const eventName = eventType.toLowerCase();
                // Use the original event type with preserved underscores for the handler method name
                const handlerMethod = `handle_${eventName}`;
                
                if (typeof this[handlerMethod] !== 'function') {
                    console.error(`Event handler method '${handlerMethod}' is not implemented for event '${eventType}'`);
                    return;
                }
                
                console.log(`Subscribing to event: ${eventType} with handler: ${handlerMethod}`);
                this._eventManager.addEventListener(
                    eventType,
                    this[handlerMethod].bind(this)
                );
            });
            
            this.isSubscribed = true;
        } catch (error) {
            // Re-throw the error with additional context to help identify the source of null events
            if (error.message && error.message.includes('null or undefined')) {
                throw new Error(`Invalid event type: null or undefined in ${this.constructor.name}.getSubscribedEvents(). ${error.message}`);
            }
            throw error;
        }
    }

    /**
     * Unsubscribes from all events
     * @returns {void}
     */
    unsubscribeFromEvents() {
        if (!this.isSubscribed) return;
        
        const events = this.getSubscribedEvents();
        
        events.forEach(eventType => {
            // Convert event type to lowercase and replace underscores
            const eventName = eventType.toLowerCase();
            const handlerMethod = `handle_${eventName}`;
            
            if (typeof this[handlerMethod] === 'function') {
                this._eventManager.removeEventListener(
                    eventType,
                    this[handlerMethod].bind(this)
                );
            }
        });
        
        this.isSubscribed = false;
    }

    /**
     * Dispatches an event
     * @param {string} eventType - The type of event to dispatch
     * @param {*} data - The data to pass to event listeners
     * @returns {void}
     */
    dispatchEvent(eventType, data) {
        this.eventManager.dispatchEvent(eventType, data);
    }

    /**
     * Clean up resources and unsubscribe from events
     */
    destroy() {
        this.unsubscribeFromEvents();
    }
}
