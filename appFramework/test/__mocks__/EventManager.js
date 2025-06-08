/**
 * Mock EventManager for testing
 */
class MockEventManager {
  constructor() {
    this.listeners = new Map();
    this.dispatchEvent = jest.fn((eventType, data) => {
      const handlers = this.listeners.get(eventType) || [];
      handlers.forEach(handler => handler({ type: eventType, ...data }));
    });
  }

  addEventListener(eventType, handler) {
    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, []);
    }
    this.listeners.get(eventType).push(handler);
  }

  removeEventListener(eventType, handler) {
    const handlers = this.listeners.get(eventType);
    if (handlers) {
      const index = handlers.indexOf(handler);
      if (index > -1) {
        handlers.splice(index, 1);
      }
    }
  }

  // Helper method for testing
  clear() {
    this.listeners.clear();
    this.dispatchEvent.mockClear();
  }
}

export default MockEventManager;
