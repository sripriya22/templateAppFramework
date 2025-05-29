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
        
        const events = this.getSubscribedEvents();
        
        events.forEach(eventType => {
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
