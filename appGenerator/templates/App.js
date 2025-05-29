/**
 * App - Main application class that extends AbstractApp
 * Override createModel and createView methods to customize behavior
 * 
 * This file is the main entry point for your application.
 * Customize the createModel and createView methods to use your custom classes.
 */

// Import from the appFramework package using absolute paths
import AbstractApp from '/appFramework/controller/AbstractApp.js';
import BasicView from '/appFramework/view/BasicView.js';

export class App extends AbstractApp {
  /**
   * Get the default client-side event subscriptions for the app
   * @returns {string[]} Array of client event IDs to subscribe to
   */
  static getDefaultClientSubscriptions() {
    // Add your custom client subscriptions here
    return [
      ...AbstractApp.getDefaultClientSubscriptions(),
      // 'customClientEvent'
    ];
  }

  /**
   * Get the default server-side event subscriptions for the app
   * @returns {string[]} Array of server event IDs to subscribe to
   */
  static getDefaultServerSubscriptions() {
    // Add your custom server subscriptions here
    return [
      ...AbstractApp.getDefaultServerSubscriptions(),
      // 'customServerEvent'
    ];
  }

  /**
   * Create a new App instance
   */
  constructor() {
    super();
    
    // Add any additional initialization here
    console.log('Custom App instance created');
  }

  /**
   * Get the root class name for the model
   * @returns {string} The root class name
   */
  getRootClassName() {
    return ''; // Default root class name, override in your app
  }

  /**
   * Get the root folder path for the model
   * @returns {string} The root folder path
   */
  getRootFolderPath() {
    return '.'; // Default folder name, override in your app
  }

  /**
   * Get the application title
   * @returns {string} The application title
   */
  getAppTitle() {
    return '';
  }

  /**
   * Create the view instance
   * @returns {BasicView} The view instance
   */
  createView() {
    const container = (this.config && this.config.container) || '#app';
    return new BasicView({
      app: this,
      container: container,
      title: this.getAppTitle()
    });
  }

  /**
   * Create the model instance - override to use a custom model class
   * @returns {ClientModel} The model instance
   * @protected
   */
  // createModel() {
  //   // Implement to override default generic ClientModel
  //   // Example:
  //   // return new CustomModel({ app: this });
  // }
}

// Export the App class
export default App;

// Create and export a singleton instance
export const app = new App();

// For debugging and MATLAB integration
if (typeof window !== 'undefined') {
  window.app = app;
  
  // Set the app instance for MATLAB integration
  if (typeof window.setAppInstance === 'function') {
    window.setAppInstance(app);
  }
}
