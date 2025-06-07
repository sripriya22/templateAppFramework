/**
 * UIHTMLServiceLayer - Implementation of ServiceLayer for MATLAB uihtml communication
 * Handles the specifics of communicating with MATLAB through the HTML component
 */
import { ServiceLayer } from './ServiceLayer.js';
import { EventTypes } from '../EventTypes.js';
import { MockMATLABComponent } from '../MockMATLABComponent.js';

/**
 * UIHTMLServiceLayer class that implements the ServiceLayer interface for MATLAB communication
 * Uses the HTML component to send and receive events from MATLAB
 */
export class UIHTMLServiceLayer extends ServiceLayer {
    /**
     * Creates a new UIHTMLServiceLayer
     * @param {Object} app - The application instance
     * @param {Object} [htmlComponent] - The HTML component for MATLAB communication
     */
    constructor(app, htmlComponent = null) {
        super(app);
        
        /**
         * The HTML component instance for MATLAB communication
         * @private
         */
        this._htmlComponent = null;
        
        /**
         * Map to store method calls in progress
         * @private
         */
        this._pendingCalls = new Map();
        
        /**
         * Flag to track if the service layer has been initialized
         * @private
         */
        this._initialized = false;
        
        // Bind methods
        this._handleMatlabResponse = this._handleMatlabResponse.bind(this);
        this._handleMatlabError = this._handleMatlabError.bind(this);
        
        // If HTML component is provided, store it (but don't initialize yet)
        if (htmlComponent) {
            this._htmlComponent = htmlComponent;
        }
    }
    
    /**
     * Initialize the service layer
     * Waits for HTML component to be set or timeout, then sets up event listeners
     * @param {number} [timeoutMs=1000] - Timeout in milliseconds
     * @returns {Promise<void>}
     */
    async init(timeoutMs = 1000) {
        if (this._initialized) return;
        
        // If component already set, just set up listeners
        if (this._htmlComponent) {
            this._setupMatlabEventListeners();
            this._initialized = true;
            return;
        }
        
        // Wait for component with timeout
        const startTime = Date.now();
        
        while (!this._htmlComponent && (Date.now() - startTime < timeoutMs)) {
            await new Promise(resolve => setTimeout(resolve, 100));
        }
        
        // If no component by timeout, create mock
        if (!this._htmlComponent) {
            console.warn(`HTML component not available after ${timeoutMs}ms, creating mock component`);
            this._htmlComponent = new MockMATLABComponent({ debug: true });
        }
        
        // Set up event listeners
        this._setupMatlabEventListeners();
        this._initialized = true;
    }
    
    /**
     * Set the HTML component
     * @param {Object} htmlComponent - The HTML component for MATLAB communication
     */
    setHTMLComponent(htmlComponent) {
        if (!htmlComponent) {
            console.error('Invalid HTML component provided');
            return;
        }
        
        // Store the HTML component
        this._htmlComponent = htmlComponent;
        console.log('MATLAB HTML component set in ServiceLayer');
    }
    
    /**
     * Set up event listeners for MATLAB responses
     * @private
     */
    _setupMatlabEventListeners() {
        if (!this._htmlComponent) {
            console.warn('Cannot set up MATLAB event listeners: No HTML component available');
            return;
        }
        
        // Listen for method call responses from MATLAB
        this._htmlComponent.addEventListener('matlab_method_call_response', this._handleMatlabResponse);
        
        // Listen for method call errors from MATLAB
        this._htmlComponent.addEventListener('matlab_method_call_error', this._handleMatlabError);
    }
    
    /**
     * Handles MATLAB method call requests from the application
     * @param {Object} event - The event object containing request details
     */
    handle_matlab_method_call_request(event) {
        // Hard error if not initialized - no waiting
        if (!this._initialized || !this._htmlComponent) {
            throw new Error('Cannot handle MATLAB method call: ServiceLayer not initialized');
        }
        
        // Validate event data
        const { requestId, methodName, objectPath, args } = event;
        
        if (!requestId) {
            throw new Error('Invalid MATLAB method call request: missing requestId');
        }
        
        if (!methodName) {
            throw new Error('Invalid MATLAB method call request: missing methodName');
        }
        
        // Store the pending call
        this._pendingCalls.set(requestId, {
            timestamp: Date.now(),
            method: methodName,
            objectPath
        });
        
        // Process arguments to ensure they are serializable
        const serializedArgs = (args || []).map(arg => {
            // Check if the argument is a model object with toJSON method
            if (arg && typeof arg === 'object' && typeof arg.toJSON === 'function') {
                console.log(`Serializing model object for MATLAB call: ${methodName}`);
                return arg.toJSON();
            }
            return arg;
        });
        
        // Prepare data for MATLAB
        const eventData = {
            requestId,
            method: methodName,
            objectPath: objectPath || '',
            args: serializedArgs
        };
        
        try {
            // Send the event to MATLAB
            this._htmlComponent.sendEventToMATLAB('matlab_method_call_request', eventData);
            console.log(`Sent MATLAB method call request: ${methodName} (ID: ${requestId})`);
        } catch (error) {
            // Clean up pending call
            this._pendingCalls.delete(requestId);
            
            // Dispatch server error event
            this._eventManager.dispatchEvent(EventTypes.SERVER_ERROR, {
                id: 'MATLAB_CALL_FAILED',
                message: `Failed to send MATLAB method call: ${methodName}`,
                details: {
                    requestId,
                    method: methodName,
                    error: error.message
                }
            });
        }
    }
    
    /**
     * Handle responses from MATLAB method calls
     * @param {Object} response - The response data from MATLAB
     * @private
     */
    _handleMatlabResponse(response) {
        const { requestId, result } = response;
        
        if (!requestId) {
            // Hard error for invalid response
            throw new Error('Invalid MATLAB response: missing requestId');
        }
        
        const pendingCall = this._pendingCalls.get(requestId);
        if (!pendingCall) {
            console.warn(`Received MATLAB response for unknown request ID: ${requestId}`);
            return;
        }
        
        // Remove from pending calls
        this._pendingCalls.delete(requestId);
        
        // Execute callback if registered
        this._executeCallback(requestId, result, null);
        
        console.log(`Received MATLAB response for ${pendingCall.method} (ID: ${requestId})`);
    }
    
    /**
     * Handle errors from MATLAB method calls
     * @param {Object} errorData - The error data from MATLAB
     * @private
     */
    _handleMatlabError(errorData) {
        const { requestId, error } = errorData;
        
        if (!requestId) {
            // Hard error for invalid error data
            throw new Error('Invalid MATLAB error response: missing requestId');
        }
        
        const pendingCall = this._pendingCalls.get(requestId);
        if (!pendingCall) {
            console.warn(`Received MATLAB error for unknown request ID: ${requestId}`);
            return;
        }
        
        // Remove from pending calls
        this._pendingCalls.delete(requestId);
        
        // Execute callback if registered
        this._executeCallback(requestId, null, error);
        
        // Also dispatch a SERVER_ERROR event for general error handling
        this._eventManager.dispatchEvent({
            type: EventTypes.SERVER_ERROR,
            ID: 'MATLAB_METHOD_ERROR',
            Message: `Error calling MATLAB method ${pendingCall.method}`,
            Details: {
                requestId,
                method: pendingCall.method,
                error
            }
        });
    }
    
    /**
     * Clean up MATLAB event listeners and pending calls
     */
    destroy() {
        if (this._htmlComponent) {
            // Remove MATLAB event listeners
            this._htmlComponent.removeEventListener('matlab_method_call_response', this._handleMatlabResponse);
            this._htmlComponent.removeEventListener('matlab_method_call_error', this._handleMatlabError);
        }
        
        // Clean up references
        this._htmlComponent = null;
        this._initialized = false;
        
        // Clear pending calls
        this._pendingCalls.clear();
        
        // Call parent destroy
        super.destroy();
    }
}
