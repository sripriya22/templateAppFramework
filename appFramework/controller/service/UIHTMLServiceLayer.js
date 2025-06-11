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
        this._handleServerNotification = this._handleServerNotification.bind(this);
        
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

        super.init();
        
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
        
        // Listen for server events (including property updates)
        this._htmlComponent.addEventListener('server_notification', this._handleServerNotification);
    }
    
    /**
     * Check if MATLAB is connected
     * @returns {boolean} True if connected to real MATLAB, false if using MockMATLABComponent
     */
    isMATLABConnected() {
        // Check if component exists and is not a mock
        return this._htmlComponent && 
               !this._htmlComponent.isMock;
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
        const { MethodName, ObjectPath, Args, Callback, ErrorCallback } = event;
        
        if (!MethodName) {
            throw new Error('Invalid MATLAB method call request: missing MethodName');
        }
        
        // Generate a unique request ID for tracking this request
        const requestId = this._generateRequestId(MethodName);
        
        // Store the pending call along with callbacks
        this._pendingCalls.set(requestId, {
            timestamp: Date.now(),
            MethodName,
            ObjectPath,
            Callback,       // Store success callback function
            ErrorCallback  // Store error callback function
        });
        
        // Helper function to recursively serialize model objects
        const serializeModelObjects = (data) => {
            // Handle arrays
            if (Array.isArray(data)) {
                return data.map(item => serializeModelObjects(item));
            }
            // Handle objects (but not null)
            else if (data && typeof data === 'object') {
                // If it's a model object with toJSON method, serialize it
                if (typeof data.toJSON === 'function') {
                    console.log(`Serializing model object for MATLAB call: ${MethodName}`);
                    return data.toJSON();
                }
                // Otherwise recursively process object properties
                const result = {};
                for (const key in data) {
                    if (Object.prototype.hasOwnProperty.call(data, key)) {
                        result[key] = serializeModelObjects(data[key]);
                    }
                }
                return result;
            }
            // Return primitives as-is
            return data;
        };
        
        // Serialize any model objects in the Args object
        const serializedArgs = Args ? serializeModelObjects(Args) : {};
        
        // Prepare data for MATLAB
        const eventData = {
            RequestId: requestId,
            MethodName,
            ObjectPath: ObjectPath || '',
            Args: serializedArgs
        };
        
        try {
            // Check if we're connected to MATLAB
            if (this.isMATLABConnected()) {
                // Send the event to MATLAB
                this._htmlComponent.sendEventToMATLAB('matlab_method_call_request', eventData);
                console.log(`Sent MATLAB method call request: ${MethodName} (ID: ${requestId})`);
            } else {
                console.log(`MATLAB is not connected. Method call request ${MethodName} (ID: ${requestId}) not sent.`);
                
                // Clean up pending call
                this._pendingCalls.delete(requestId);
                
                // Execute callback with mock response if one is provided
                if (typeof Callback === 'function') {
                    setTimeout(() => {
                        try {
                            Callback({ success: false, message: 'MATLAB is not connected', result: null });
                        } catch (callbackError) {
                            console.warn(`Error executing callback for mock response:`, callbackError);
                        }
                    }, 0);
                }
                
                return; // Exit early, don't throw an error
            }
        } catch (error) {
            // Execute error callback if provided
            if (typeof ErrorCallback === 'function') {
                try {
                    ErrorCallback(new Error(`Failed to send MATLAB method call: ${error.message}`));
                } catch (callbackError) {
                    console.error(`Error executing error callback for request ${requestId}:`, callbackError);
                }
            }
            
            // Clean up pending call
            this._pendingCalls.delete(requestId);
            
            // Dispatch server error event
            this._eventManager.dispatchEvent(EventTypes.SERVER_ERROR, {
                ID: 'MATLAB_CALL_FAILED',
                Message: `Failed to send MATLAB method call: ${MethodName}`,
                Details: {
                    RequestId: requestId,
                    Method: MethodName,
                    Error: error.message
                }
            });
        }
    }
    
    /**
     * Handle responses from MATLAB method calls
     * @param {Object} UIHTMLEventData - The event data from MATLAB containing the response
     * @private
     */
    _handleMatlabResponse(UIHTMLEventData) {
        // Extract the response data from the event
        if (!UIHTMLEventData || !UIHTMLEventData.Data) {
            console.error('Invalid MATLAB response event:', UIHTMLEventData);
            return;
        }
        
        const responseData = UIHTMLEventData.Data;
        const { RequestId, Results, MethodName } = responseData;
        
        if (!RequestId) {
            // Hard error for invalid response
            throw new Error('Invalid MATLAB response: missing RequestId');
        }
        
        const pendingCall = this._pendingCalls.get(RequestId);
        if (!pendingCall) {
            console.warn(`Received MATLAB response for unknown request ID: ${RequestId}`);
            return;
        }
        
        const { Callback } = pendingCall;
        
        // Execute success callback if provided
        if (typeof Callback === 'function') {
            try {
                Callback(Results);
            } catch (error) {
                console.error(`Error executing success callback for request ${RequestId}:`, error);
            }
        }
        
        // Remove from pending calls
        this._pendingCalls.delete(RequestId);
        
        console.log(`Received MATLAB response for ${MethodName || pendingCall.MethodName} (ID: ${RequestId})`);
    }
    
    /**
     * Handle server notifications from MATLAB
     * @param {Object} UIHTMLEventData - The server notification event from the UIHTML component
     * @private
     */
    _handleServerNotification(UIHTMLEventData) {
        // Extract the notification data from the event
        if (!UIHTMLEventData || !UIHTMLEventData.Data) {
            console.error('Invalid server notification received:', UIHTMLEventData);
            return;
        }
        
        // Extract the notification data
        const notification = UIHTMLEventData.Data;
        console.log('Received server notification:', notification);
        
        // Check if the notification has the expected structure
        if (!notification.EventID || !notification.EventData) {
            console.error('Invalid server notification format:', notification);
            return;
        }
        
        const { EventID, EventData } = notification;
        
        // Forward the event to the appropriate handlers using the EventID
        // This allows the server to specify which event type to dispatch
        if (EventTypes[EventID]) {
            console.log(`Dispatching ${EventID} event from server notification`);
            this._app.eventManager.dispatchEvent(EventTypes[EventID], EventData);
        } else {
            console.warn(`Unknown event type in server notification: ${EventID}`, EventData);
        }
    }
    
    /**
     * Generates a unique request ID for MATLAB method calls
     * @param {string} methodName - The method name being called
     * @returns {string} A unique request ID
     * @private
     */
    _generateRequestId(methodName) {
        const prefix = methodName.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
        const timestamp = Date.now().toString(36);
        const random = Math.random().toString(36).substring(2, 10);
        return `${prefix}_${timestamp}_${random}`;
    }

    /**
     * Handle errors from MATLAB method calls
     * @param {Object} UIHTMLEventData - The error event data from MATLAB
     * @private
     */
    _handleMatlabError(UIHTMLEventData) {
        // Extract the error data from the event
        if (!UIHTMLEventData || !UIHTMLEventData.Data) {
            console.error('Invalid MATLAB error event:', UIHTMLEventData);
            return;
        }
        
        const errorData = UIHTMLEventData.Data;
        const { RequestId, Error: errorMessage, Stack: errorStack } = errorData;
        
        if (!RequestId) {
            // Hard error for invalid response
            throw new Error('Invalid MATLAB error: missing RequestId');
        }
        
        const pendingCall = this._pendingCalls.get(RequestId);
        if (!pendingCall) {
            console.warn(`Received MATLAB error for unknown request ID: ${RequestId}`);
            return;
        }
        
        const { MethodName, ErrorCallback } = pendingCall;
        
        // Prepare error object
        const errorObj = new Error(errorMessage || 'Unknown MATLAB error');
        errorObj.stack = errorStack;
        errorObj.requestId = RequestId;
        errorObj.methodName = MethodName;
        
        // Execute error callback if provided
        if (typeof ErrorCallback === 'function') {
            try {
                ErrorCallback(errorObj);
            } catch (callbackError) {
                console.error(`Error executing error callback for request ${RequestId}:`, callbackError);
            }
        }
        
        // Remove from pending calls
        this._pendingCalls.delete(RequestId);
        
        // Dispatch server error event
        this._app.eventManager.dispatchEvent(EventTypes.SERVER_ERROR, {
            ID: 'MATLAB_ERROR',
            Message: `MATLAB error in method call ${MethodName}: ${errorMessage}`,
            Details: {
                RequestId: RequestId,
                Method: MethodName,
                Error: errorMessage,
                Stack: errorStack
            }
        });
        
        console.error(`MATLAB error for ${MethodName} (ID: ${RequestId}):`, errorMessage);
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
