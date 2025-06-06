/**
 * App - Main application class that extends AbstractApp
 * This class implements the required abstract methods from AbstractApp.
 * 
 * This is the main entry point for the {{APP_NAME}} application.
 * It provides app-specific implementations of AbstractApp methods.
 */

// Import from the appFramework package using relative paths
import { AbstractApp } from '../../../appFramework/controller/AbstractApp.js';
import { BasicView } from '../../../appFramework/view/BasicView.js';

// Import any additional components needed

export class App extends AbstractApp {
  // No constructor needed - AbstractApp handles initialization
  // Configuration is provided by implementing abstract methods

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
   * Get the root class name for the model
   * @returns {string} The root class name
   * @required - Implementation of AbstractApp abstract method
   */
  getRootClassName() {
    return '{{ROOT_CLASS_NAME}}'; // Set by app generator
  }

  /**
   * Get the root folder path for the app
   * @returns {string} The root folder path
   * @required - Implementation of AbstractApp abstract method
   */
  getRootFolderPath() {
    return '{{APP_FOLDER_PATH}}';
  }

  /**
   * Get the application title
   * @returns {string} The application title
   * @required - Implementation of AbstractApp abstract method
   */
  getAppTitle() {
    return '{{APP_TITLE}}';
  }

  /**
   * Get the view configuration name
   * @returns {string} The name of the view configuration (without extension)
   * @required - Implementation of AbstractApp abstract method
   */
  getViewConfigName() {
    return 'ModelPanelConfig';
  }

  /**
   * Get the names of all model classes used by this app
   * @returns {string[]} Array of model class names
   * @required - Implementation of AbstractApp abstract method
   */
  getModelClassNames() {
    return {{MODEL_CLASS_NAMES}};
  }

  /**
   * Get available test data paths
   * @returns {string[]} Array of paths to test data files
   * @required - Implementation of AbstractApp abstract method
   */
  getTestDataPaths() {
    return [
      {{TEST_DATA_PATHS}}
    ];
  }

  /**
   * Create the view instance
   * @returns {Promise<BasicView>|BasicView} The view instance
   * @override - Optional override of AbstractApp method
   */
  async createView() {
    const container = (this.config && this.config.container) || '#app';
    
    // Create view with component configurations
    return new BasicView({
      app: this,
      container: container,
      title: this.getAppTitle(),
      componentConfigs: {
        ModelPanel: this.viewConfig
      }
    });
  }

  /**
   * Create the model instance
   * @returns {ClientModel} The model instance
   * @override - Optional override of AbstractApp method
   * 
   * This method is commented out as we're using the default implementation
   * in AbstractApp. Uncomment and implement this method if you need a custom
   * model class or initialization.
   * 
   * Example implementation:
   * createModel() {
   *   return new CustomModel({ app: this });
   * }
   */
}

// Export the App class as default
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
