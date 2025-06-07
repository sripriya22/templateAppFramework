/**
 * ServiceLayer - Interface for handling service requests to external systems
 * Acts as an adapter between the application event system and external
 * communication systems (MATLAB, REST APIs, etc.)
 */
import { EventListener } from '../EventListener.js';
import { EventTypes } from '../EventTypes.js';

/**
 * Base ServiceLayer class that defines the interface for service implementations
 * Handles routing of service calls and manages request IDs
 */
export class ServiceLayer extends EventListener {
    /**
     * Creates a new ServiceLayer
     * @param {Object} app - The application instance
     */
    constructor(app) {
        super(app);
        
        /**
         * Map of request IDs to callback functions
         * @private
         */
        this._requestCallbacks = new Map();
        
        /**
         * Counter for generating unique request IDs
         * @private
         */
        this._requestIdCounter = 0;
    }
    
    /**
     * Returns the event types this service layer is interested in
     * @returns {Array<string>} Array of event types
     */
    getSubscribedEvents() {
        return [
            EventTypes.MATLAB_METHOD_CALL_REQUEST
        ];
    }
    
    /**
     * Handles MATLAB method call requests
     * This function is called when a MATLAB_METHOD_CALL_REQUEST event is dispatched
     * @param {Object} event - The event object containing request details
     */
    handle_matlab_method_call_request(event) {
        throw new Error('handle_matlab_method_call_request must be implemented by a subclass');
    }
    
    /**
     * Generates a unique request ID for a service call
     * @returns {string} A unique request ID
     * @protected
     */
    _generateRequestId() {
        return `req_${Date.now()}_${this._requestIdCounter++}`;
    }
    
    /**
     * Registers a callback function for a given request ID
     * @param {string} requestId - The request ID
     * @param {Function} callback - The callback function to be called when a response is received
     * @protected
     */
    _registerCallback(requestId, callback) {
        if (this._requestCallbacks.has(requestId)) {
            throw new Error(`Request ID ${requestId} is already registered`);
        }
        
        this._requestCallbacks.set(requestId, callback);
    }
    
    /**
     * Calls the registered callback for a given request ID and removes it from the map
     * @param {string} requestId - The request ID
     * @param {*} result - The result to pass to the callback
     * @param {*} error - The error to pass to the callback (if any)
     * @protected
     */
    _executeCallback(requestId, result, error) {
        const callback = this._requestCallbacks.get(requestId);
        if (!callback) {
            console.warn(`No callback registered for request ID ${requestId}`);
            return;
        }
        
        try {
            callback(result, error);
        } catch (e) {
            console.error(`Error executing callback for request ID ${requestId}:`, e);
        } finally {
            this._requestCallbacks.delete(requestId);
        }
    }
    
    /**
     * Cleans up resources and cancels any pending requests
     * Should be called when the service layer is no longer needed
     */
    destroy() {
        // Clear all callbacks
        this._requestCallbacks.clear();
        
        // Call parent destroy to unsubscribe from events
        super.destroy();
    }
}
