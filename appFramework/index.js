// Core framework exports
export * from './model/ModelClassDefinitionManager.js';
export * from './model/AbstractModelObject.js';

// View exports
export * from './view/components/BaseComponent.js';
export * from './view/components/ModelInspector.js';
export * from './view/widgets/TreeTable.js';

// Controller exports
export * from './controller/EventManager.js';

// Utility functions
export * from './utils/generateClasses.js';

// Export main classes with their default exports
import ClientView from './view/ClientView.js';
import DebugView from './view/DebugView.js';
import ClientModel from './model/ClientModel.js';
import AbstractApp from './controller/AbstractApp.js';

// Re-export for easier imports
export { ClientView, DebugView, ClientModel, AbstractApp };