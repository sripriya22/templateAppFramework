/**
 * MockMATLABComponent - Simulates MATLAB's HTML component for browser testing
 */

/**
 * A mock implementation of MATLAB's HTML component for testing in browser
 */
export class MockMATLABComponent {
    constructor() {
        this._events = {};
        this.isMock = true;
    }

    /**
     * Add an event listener
     * @param {string} eventName - The name of the event to listen for
     * @param {Function} callback - The callback function
     */
    addEventListener(eventName, callback) {
        console.log(`[MockMATLAB] Adding listener for event: ${eventName}`);
        if (!this._events[eventName]) {
            this._events[eventName] = [];
        }
        this._events[eventName].push(callback);
    }

    /**
     * Remove an event listener
     * @param {string} eventName - The name of the event
     * @param {Function} callback - The callback function to remove
     */
    removeEventListener(eventName, callback) {
        if (!this._events[eventName]) return;
        
        const index = this._events[eventName].indexOf(callback);
        if (index > -1) {
            this._events[eventName].splice(index, 1);
            console.log(`[MockMATLAB] Removed listener for event: ${eventName}`);
        }
    }

    /**
     * Dispatch an event
     * @param {Object} event - The event object with type and data
     */
    dispatchEvent(event) {
        const eventName = event.type;
        console.log(`[MockMATLAB] Dispatching event: ${eventName}`, event);

        if (this._events[eventName]) {
            this._events[eventName].forEach(callback => {
                try {
                    callback(event);
                } catch (error) {
                    console.error(`[MockMATLAB] Error in event handler for ${eventName}:`, error);
                }
            });
        }
    }

    /**
     * Send a message to MATLAB (mock implementation)
     * @param {string} message - The message to send
     */
    sendMessageToMATLAB(message) {
        console.log(`[MockMATLAB] Message sent to MATLAB:`, message);
        
        try {
            // Parse the message if it's a JSON string
            const data = typeof message === 'string' ? JSON.parse(message) : message;
            
            // Simulate MATLAB response with a slight delay
            setTimeout(() => {
                this._simulateMatlabResponse(data);
            }, 300);
            
        } catch (error) {
            console.error('[MockMATLAB] Error parsing message:', error);
        }
    }

    /**
     * Simulate MATLAB's response to a message
     * @param {Object} data - The message data
     * @private
     */
    _simulateMatlabResponse(data) {
        const { type } = data;
        
        switch (type) {
            case 'getModel':
                // Simulate returning model data
                this.dispatchEvent({
                    type: 'message',
                    data: {
                        type: 'getModelResponse',
                        uid: data.uid,
                        data: {
                            // Mock model data
                            Model: { name: 'MockModel', properties: {} },
                            Parameters: [
                                { name: 'param1', value: 10 },
                                { name: 'param2', value: 20 }
                            ]
                        }
                    }
                });
                break;
                
            case 'dataRequested':
                // Simulate returning requested data
                this.dispatchEvent({
                    type: 'message',
                    data: {
                        type: 'dataResponse',
                        uid: data.uid,
                        data: {
                            // Mock data response
                            items: [
                                { id: 1, name: 'Item 1' },
                                { id: 2, name: 'Item 2' }
                            ]
                        }
                    }
                });
                break;
                
            default:
                // Echo back the request with a generic response
                this.dispatchEvent({
                    type: 'message',
                    data: {
                        type: `${type}Response`,
                        uid: data.uid,
                        data: { success: true, message: 'Mock response' }
                    }
                });
        }
    }
}

// Export a singleton instance for convenience
export const mockMatlabComponent = new MockMATLABComponent();
