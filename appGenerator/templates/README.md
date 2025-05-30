# Template App Framework Application

This is a template application created with the Template App Framework, designed to work with MATLAB integration.

## Quick Start with Cascade

Copy and paste the following prompt into Cascade, then follow the interactive steps:

```
I need to create a new application using the Template App Framework. Please help me complete the setup by following the steps in this README exactly as written. Do not change any existing code in the project folder or create any new files apart from those created explicitly through these instructions. If a command fails, report back but do not try to find a workaround without explicitly checking in. Here are the variables you'll need:

PROJECT_ROOT_FOLDER="templateAppFramework"    # The root folder of the project;
                                                must contain the `appFramework` "library" folder
APP_FOLDER_NAME="myApp"                       # The name for your application folder
                                                (will be created in the `apps/` directory)
ROOT_CLASS_NAME="RootModel"                   # The name for your root model class
APP_TITLE="My Application"                    # The display name of your application
EXAMPLE_OBJECT_PATH="resources/example.json"  # Path to your example object file

Please proceed with the setup steps in the README. If you encounter any issues, please stop and ask for clarification before proceeding.
```

## Setup Steps

### Step 1: Create a New Application
From the project root directory, `$PROJECT_ROOT_FOLDER`, run:

```bash
# This will create your app in the apps/ directory
node appGenerator/utils/create-app.js $APP_NAME $EXAMPLE_OBJECT_PATH
```

Your application will be created in the `$PROJECT_ROOT_FOLDER/apps/$APP_NAME` directory.

### Step 2: Create Data Model Definitions
Use the following prompt to interactively create the data-model JSONs:

Given the app root directory `$APP_FOLDER_NAME`, create data model definitions in `$APP_FOLDER_NAME/data-model` based on the sample object in the `$APP_FOLDER_NAME/resources` folder. The root class should be named `$ROOT_CLASS_NAME`. Use a JSON language-agnostic format with the following structure:

```json
{
    "ClassName": "ClassName",
    "SuperClass": "ParentClassName",
    "Description": "Description of the class",
    "Properties": {
        "PropertyName": {
            "Type": "string",
            "IsPrimitive": true,
            "IsArray": false,
            "DefaultValue": "",
            "Description": "Description of the property"
        },
        "Items": {
            "Type": "ItemType",
            "IsPrimitive": false,
            "IsArray": true,
            "DefaultValue": [],
            "Description": "Array of items"
        }
    }
}
```

Before creating the JSONs, confirm the proposed class hierarchy. You can then tweak it before finalizing the JSON files.

### Step 3: Generate JavaScript Classes
From the project root directory, `$PROJECT_ROOT_FOLDER`, generate the JavaScript class definitions:

```bash
node appGenerator/utils/generate-classes.js $APP_FOLDER_NAME
```

This will process the model definitions in `$APP_FOLDER_NAME/data-model` and generate the corresponding JavaScript classes in `$APP_FOLDER_NAME/model`.

### Step 4: Update App Configuration
Update `$PROJECT_ROOT_FOLDER/$APP_FOLDER_NAME/App.js` to implement these required methods:

```javascript
getRootClassName() {
    return '$ROOT_CLASS_NAME';
}

getRootFolderPath() {
    return '$APP_FOLDER_NAME';
}

getAppTitle() {
    return '$APP_TITLE';
}
```

### Step 5: Run the Application
Start live-server from the `$PROJECT_ROOT_FOLDER` directory and open your application:

```bash
live-server
```

The command will return a server address. Navigate to: `$APP_FOLDER_NAME/index.html` from the server address.

## Project Structure
Now you are ready to start customizing your application. Here is the project structure:
```
.
├── data-model/      # JSON model definitions (used to drive model verification and view settings)
├── model/           # Generated model classes & optional custom model classes that extend from appFramework
├── resources/       # Example data files
├── view/            # Optional custom view files that extend from appFramework
├── index.html       # Main HTML file including a `setup()` function in `index.html` to handle MATLAB integration
└── App.js           # Main application class that extends from appFramework/controller/AbstractApp.js
```

## Development Guidelines

- Uses vanilla JavaScript with ES modules
- No build step required
- Designed to work with MATLAB's HTML component (uihtml)

## License

MIT
