# templateAppFramework

Use this README as a Cascade prompt

A framework for building data-driven web applications with MATLAB integration, following a clean MVC architecture with vanilla JavaScript.

## Table of Contents

1. [Overview](#overview)
2. [Project Structure](#project-structure)
3. [Core Architecture](#core-architecture)
   1. [ModelClassDefinitionManager](#1-modelclassdefinitionmanager)
   2. [EventManager & EventListener](#2-eventmanager--eventlistener)
   3. [ClientModel](#3-clientmodel)
4. [Application Architecture](#4-application-architecture)
5. [View Architecture & Component System](#5-view-architecture--component-system)
6. [App Generator](#6-using-appgenerator-to-develop-a-template-app)
7. [Testing](#7-testing-the-framework-and-applications)
8. [Additional Notes](#additional-notes)

## Overview

I am working on the `templateAppFramework` project. Please follow these rules and explanations to ensure consistency and maintainability:

## Project Structure

```
templateAppFramework/
├── appFramework/      # Core framework (model, view, controller, utils)
├── appGenerator/      # Tools & templates for app creation
├── apps/              # User-created apps (not tracked in framework repo)
└── resources/         # Example/shared data (not tracked in framework repo)
```

## Core Architecture

### 1. ModelClassDefinitionManager

- **Purpose**: Validates and manages model objects based on language-agnostic JSON class definitions.
- **How it works**:
  - Reads JSON files from `data-model/` (one per class)
  - Each JSON defines class name, parent, properties, types, etc.
  - Ensures that all instantiated model objects conform to their definitions
  - Supports inheritance: child classes extend parent definitions
- **Usage**: Used by the app at runtime to validate and construct model instances from JSON data.

### 2. EventManager & EventListener

- **EventManager**:
  - Central hub for event dispatching and listening between components
  - Supports registering listeners, emitting events, and removing listeners
  - Decouples components, enabling modular and testable code
- **EventListener**:
  - Interface/mixin for components to subscribe to and handle specific events
  - Used by model, view, and controller classes to react to changes or user interactions

### 3. ClientModel

- **Role**: Represents the application's data on the client side
- **Responsibilities**:
  - Loads model definitions and classes dynamically
  - Instantiates model objects from JSON
  - Handles synchronization with MATLAB via the HTML component API
  - Provides APIs for querying and updating the model
- **MATLAB Integration**: Can receive/set data via MATLAB's `uihtml` interface

## Application Architecture

- **AbstractApp (Base Class)**:
  - Core application class that manages the application lifecycle
  - Handles initialization of Model and View
  - Manages communication with MATLAB when running in MATLAB environment
  - Provides default implementations for common functionality
  - Manages event subscriptions and dispatching

- **App Implementation (Subclass of AbstractApp)**:
  - Each app must extend AbstractApp and implement required abstract methods:

```javascript
class MyApp extends AbstractApp {
  // Required: Return the root class name for model instantiation
  getRootClassName() {
    return 'MyRootClass';
  }
  
  // Required: Return the root folder path for model loading
  getRootFolderPath() {
    return 'myApp';
  }
  
  // Required: Return the application title
  getAppTitle() {
    return 'My Custom App';
  }
  
  // Optional: Override for custom view initialization
  createView() {
    return new CustomView({
      app: this,
      container: '#app',
      title: this.getAppTitle()
    });
  }
  
  // Optional: Override for custom model initialization
  createModel() {
    return new CustomModel({
      app: this,
      rootClassName: this.getRootClassName(),
      rootFolderPath: this.getRootFolderPath()
    });
  }
}
```

- **Lifecycle**:
  1. App instance is created
  2. `_initializeApp()` is called automatically
  3. `createModel()` and `createView()` are called to instantiate components
  4. Components are initialized in the correct order (model first, then view)
  5. App is ready for user interaction

## View Architecture & Component System

### Core Principles
- `index.html` is minimal, containing only the root container and script tags
- `AbstractApp.js` is lightweight, delegating UI rendering to View classes
- All UI elements are managed by View classes in the `view/` directory

### View Hierarchy
- **AbstractView** (base class in `appFramework/view/`):
  - Holds a reference to the app instance (`this._app`)
  - Manages the root DOM element (`this.element`)
  - Owns a `Layout` instance for component arrangement
- **BasicView** (example implementation) extends `AbstractView`
- App-specific views extend either `AbstractView` or `BasicView`

### Layout System
- `Layout` class manages the page structure with configurable panels
- Supports multiple regions: header, left sidebar, main content, right sidebar, bottom
- Components are placed into these regions using `_setComponent(position, element)`
- Handles responsive behavior and panel resizing

### Component Architecture
- `BaseComponent` is the foundation for all UI components
- Components are self-contained and receive their parent View instance
- Common components include:
  - `ModelPanel`: Displays and edits model data
  - `Toolstrip`: Horizontal toolbar with buttons
  - `LogConsole`: Displays application logs
  - `JSONViewer`: Shows JSON representation of data

### Widget Library
- Reusable UI widgets in `appFramework/view/widgets/`
- Examples:
  - `TreeTable`: Hierarchical data display
  - `FormField`: Input fields with validation
- Widgets are used by components to build complex interfaces

## 6. Using `appGenerator` to Develop a Template App

- **Purpose**: Automates creation of new app skeletons with the correct structure
- **How to use**:
  1. From the project root, run:
     ```bash
     node appGenerator/utils/create-app.js <AppName> <path/to/example.json>
     ```
     This creates a new folder in `/apps/<AppName>/` with all required subfolders and copies the example data.
  2. Edit the generated `data-model/` JSONs to define your model classes.
  3. Generate model classes using the class generator.
  4. Implement your custom logic in `App.js` and custom views/controllers as needed.
- **No build step required**: All code runs directly in the browser and is compatible with MATLAB's HTML integration.

## 7. Testing the Framework and Applications

### Running Unit Tests
- The framework includes a comprehensive test suite using Jest
- Run all tests:
  ```bash
  npm test
  ```
- Run tests with coverage report:
  ```bash
  npm run test:coverage
  ```
- Test files should be placed alongside the code they test with `.test.js` suffix

### Browser Testing
1. Run live-server from the project root directory
2. Open the server address provided in your browser
3. Navigate to `apps/<AppName>/index.html` in your browser

### Testing with MATLAB
1. In MATLAB, navigate to your app's directory
2. Run the app using the appropriate MATLAB command
3. The app should launch in a MATLAB figure window
4. Test all MATLAB-specific functionality including:
   - Data synchronization between MATLAB and the web view
   - Event handling between MATLAB and JavaScript
   - Error conditions and edge cases

### Testing New Applications
1. After creating a new app with the appGenerator:
   ```bash
   node appGenerator/utils/create-app.js MyNewApp path/to/example.json
   ```
2. Navigate to the app's directory
3. Run the tests to verify the basic functionality:
   ```bash
   cd apps/MyNewApp
   npm test
   ```
4. Test the app in a browser as described above

### Debugging Tips
- Use browser developer tools (F12) for client-side debugging
- Check the JavaScript console for errors and log messages
- For MATLAB integration issues, verify that:
  - The MATLAB web component is properly initialized
  - All required MATLAB toolboxes are installed
  - The MATLAB path includes all necessary directories

## Additional Notes

- **Documentation**: Refer to `appGenerator/templates/README.md` for up-to-date instructions and project structure.
- **promptLog* Files**: For historical context, see the `promptLog_*` files in the project root (not tracked by git).

---

**If you need to add new features, fix bugs, or refactor, always follow these principles:**

- **Vanilla JavaScript Only**: Use ES modules, no frameworks or build tools (no React, Vite, Webpack, etc.)
- **Modular Design**: All core logic is separated into modules (model, view, controller, utils)
- **Relative/Absolute Imports**: Use import paths that work in a vanilla JS environment
- **Apps Are Modular**: Each app is self-contained in `/apps/` and can extend, but not modify, the core framework
- **MATLAB Integration**: Works with MATLAB's HTML component (`uihtml`) and runs standalone

- **Data Binding**:
  - To be implemented

---

### **(6) Using `appGenerator` to Develop a Template App**

- **Purpose**: Automates creation of new app skeletons with the correct structure.
- **How to use**:
  1. From the project root, run:
     ```bash
     node appGenerator/utils/create-app.js <AppName> --data <path/to/example.json> [options]
     ```
     This creates a new folder in `/apps/<AppName>/` with all required subfolders and copies the example data.
     
  **Available options**:
     
  - `--data <path>` (required): Path to example JSON data file
  - `--model-defs-dir <path>`: Path to directory containing model definition JSON files
  - `--root-class <className>`: Name of the root class for the application
  - `--force` or `-f`: Overwrite existing app if it exists
  - `--title <title>`: Custom title for the application

  **Example with all options**:
  ```bash
  node appGenerator/utils/create-app.js MyApp --data example.json --model-defs-dir ./model-defs --root-class Configuration --force --title "My Custom App"
  ```
  2. Edit the generated `data-model/` JSONs to define your model classes.
  3. Generate model classes using the class generator.
  4. Implement your custom logic in `App.js` and custom views/controllers as needed.
- **No build step required**: All code runs directly in the browser and is compatible with MATLAB's HTML integration.

### **(7) Testing the Framework and Applications**

#### **Running Unit Tests**
- The framework includes a comprehensive test suite using Jest
- Run all tests:
  ```bash
  npm test
  ```
- Run tests with coverage report:
  ```bash
  npm run test:coverage
  ```
- Test files should be placed alongside the code they test with `.test.js` suffix

#### **Browser Testing**
1. Run live-server from the project root directory
2. Open the server address provided in your browser
3. Navigate to `apps/<AppName>/index.html` in your browser

#### **Testing with MATLAB**
1. In MATLAB, navigate to your app's directory
2. Run the app using the appropriate MATLAB command
3. The app should launch in a MATLAB figure window
4. Test all MATLAB-specific functionality including:
   - Data synchronization between MATLAB and the web view
   - Event handling between MATLAB and JavaScript
   - Error conditions and edge cases

#### **Testing New Applications**
1. After creating a new app with the appGenerator:
   ```bash
   node appGenerator/utils/create-app.js MyNewApp path/to/example.json
   ```
2. Navigate to the app's directory
3. Run the tests to verify the basic functionality:
   ```bash
   cd apps/MyNewApp
   npm test
   ```
4. Test the app in a browser as described above

#### **Debugging Tips**
- Use browser developer tools (F12) for client-side debugging
- Check the JavaScript console for errors and log messages
- For MATLAB integration issues, verify that:
  - The MATLAB web component is properly initialized
  - All required MATLAB toolboxes are installed
  - The MATLAB path includes all necessary directories

---

### **Additional Notes**

- **Testing**: You can test apps in a web browser by serving the project root with a simple static server (e.g., `npx serve .` or Python's `http.server`).
- **Documentation**: Refer to `appGenerator/templates/README.md` for up-to-date instructions and project structure.
- **promptLog* Files**: For historical context, see the `promptLog_*` files in the project root (not tracked by git).

---

**If you need to add new features, fix bugs, or refactor, always follow the modular, vanilla JS, and ES module principles described above. If you have questions about architecture or design, ask for clarification before making changes.**

---
