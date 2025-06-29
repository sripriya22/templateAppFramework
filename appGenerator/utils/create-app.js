#!/usr/bin/env node
// utils/create-app.js
import { mkdir, readFile, writeFile, unlink, rm } from 'fs/promises';
import { dirname, join, basename, resolve } from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { promises as fsPromises } from 'fs';
import { exec } from 'child_process';
import { promisify } from 'util';
import { generateAppModels } from './generate-matlab-classes.js';

const execPromise = promisify(exec);

const __dirname = dirname(fileURLToPath(import.meta.url));

// Path to the templates directory
const TEMPLATES_DIR = join(__dirname, '../templates');
const ROOT_PATH = dirname(dirname(__dirname));
const APPS_DIR = join(ROOT_PATH, 'apps');

// List of files to copy from templates
const FILES_TO_COPY = [
  { src: 'App.js', dest: 'js/App.js' },
  { src: 'README.md', dest: 'README.md' },
  { src: 'package.json', dest: 'package.json' }
];

// List of directories to create
const DIRS_TO_CREATE = [
  'js',
  'js/view',
  'js/view/config',
  'matlab',
  'matlab/server',
  'matlab/server/model',
  'shared',
  'shared/data-model',
  'shared/resources'
];

// Create a simple read stream wrapper that handles errors better
function createReadStreamSafe(path, options) {
  const stream = fs.createReadStream(path, options);
  stream.on('error', (err) => {
    console.error(`  - Read stream error: ${err.message}`);
  });
  return stream;
}

// Create a simple write stream wrapper that handles errors better
function createWriteStreamSafe(path, options) {
  const stream = fs.createWriteStream(path, options);
  stream.on('error', (err) => {
    console.error(`  - Write stream error: ${err.message}`);
  });
  return stream;
}

/**
 * Reads a file with multiple retry attempts using different encodings
 * @param {string} filePath - Path to the file to read
 * @returns {Promise<string>} File contents as a string
 */
async function readFileWithRetry(filePath, retries = 3) {
  try {
    return await readFile(filePath, 'utf8');
  } catch (utf8Err) {
    // If UTF-8 fails, try with binary encoding
    try {
      const data = await readFile(filePath, 'binary');
      return data;
    } catch (binaryErr) {
      // If binary fails, try one more time with UTF-8
      try {
        return await readFile(filePath, 'utf8');
      } catch (finalErr) {
        throw new Error(`Failed to read file after multiple attempts: ${finalErr.message}`);
      }
    }
  }
}

/**
 * Get a list of all model classes from JSON definition files
 * @param {string} dataModelDir - Directory containing JSON model definitions
 * @returns {Promise<string[]>} Array of model class names
 */
async function getModelClassNames(dataModelDir) {
  try {
    // Check if directory exists
    if (!fs.existsSync(dataModelDir)) {
      console.warn(`Warning: Model definitions directory does not exist: ${dataModelDir}`);
      return [];
    }
    
    const files = await fsPromises.readdir(dataModelDir);
    const jsonFiles = files.filter(file => file.endsWith('.json'));
    
    if (jsonFiles.length === 0) {
      console.warn('Warning: No JSON model definition files found');
      return [];
    }
    
    const classNames = [];
    
    for (const file of jsonFiles) {
      try {
        const content = await readFile(join(dataModelDir, file), 'utf8');
        const def = JSON.parse(content);
        const className = def.ClassName || basename(file, '.json');
        classNames.push(className);
      } catch (err) {
        console.warn(`Warning: Could not process model file ${file}:`, err);
      }
    }
    
    return classNames;
  } catch (error) {
    console.warn('Warning: Error reading model class names:', error);
    return [];
  }
}

// Removed older version of generateModelPanelConfig function to avoid duplication

/**
 * Finds the root class in model definitions
 * @param {string} modelDefsDir - Path to model definitions directory
 * @returns {Promise<string>} - Name of the root class
 */
async function findRootClass(modelDefsDir) {
  const files = fs.readdirSync(modelDefsDir);
  
  for (const file of files) {
    if (file.endsWith('.json')) {
      try {
        const content = fs.readFileSync(join(modelDefsDir, file), 'utf8');
        const def = JSON.parse(content);
        if (def.IsRoot) {
          return def.ClassName;
        }
      } catch (err) {
        console.warn(`Warning: Could not parse model file ${file}:`, err);
      }
    }
  }
  
  throw new Error('No root class found in model definitions. Add "IsRoot: true" to one of the model definitions.');
}

/**
 * Main function to create a new app
 * @param {string} targetPath - Target directory for the app
 * @param {string} dataFile - Path to data file to use
 * @param {object} options - Options for app creation
 * @param {string} options.title - App title
 * @param {boolean} options.force - Whether to force overwriting
 * @param {string} options.modelDefsDir - Path to model definitions directory
 * @returns {Promise<void>}
 */
async function createApp(targetPath, dataFile, options = {}) {
  console.log(`Creating new app at ${targetPath}`);
  
  // Validate required parameters
  if (!targetPath) {
    throw new Error('Target path is required');
  }
  if (!dataFile) {
    throw new Error('Data file is required');
  }
  if (!options.modelDefsDir) {
    throw new Error('Model definitions directory is required');
  }
  
  // Set up basic variables
  const appName = basename(targetPath);
  const appTitle = options.title || `${appName} Application`;
  const modelDefsDir = options.modelDefsDir;
  
  if (!modelDefsDir) {
    throw new Error('Model definitions directory (--model-defs-dir) is required');
  }
  
  // Find the root class from model definitions
  const rootClass = await findRootClass(modelDefsDir);
  console.log(`Found root class: ${rootClass}`);
  
  let testDataPath = null;

  try {
    // Create target directory and standard subdirectories
    await mkdir(targetPath, { recursive: true });
    for (const dir of DIRS_TO_CREATE) {
      await mkdir(join(targetPath, dir), { recursive: true });
    }
    
    // Step 1: Copy the data file (required)
    testDataPath = await copyDataFile(dataFile, targetPath);
    
    // Step 2: Copy model definitions to the shared/data-model directory
    if (options.modelDefsDir) {
      const dataModelDir = join(targetPath, 'shared/data-model');
      await mkdir(dataModelDir, { recursive: true });
      
      // Copy model definitions to shared/data-model directory
      await copyModelDefinitions(options.modelDefsDir, targetPath, appName, rootClass);
      
      // Step 2b: Generate MATLAB class files from JSON model definitions
      console.log('Generating MATLAB class files from model definitions...');
      try {
        await generateAppModels(appName, targetPath, {
          overwrite: options.force,
          verbose: true
        });
        console.log('  ✓ Successfully generated MATLAB class files');
      } catch (err) {
        console.warn(`Warning: Failed to generate MATLAB class files: ${err.message}`);
      }
    } else {
      console.warn('Warning: No model definitions directory specified. Using auto-generated model definitions.');
      // App will use the auto-generated model definition from the data file
    }
    
    // Step 3: Get all model class names
    // Look in the shared/data-model directory where we copied the model definitions
    const dataModelDir = join(targetPath, 'shared/data-model');
    const modelClassNames = await getModelClassNames(dataModelDir);
    if (modelClassNames.length === 0) {
      throw new Error('No model classes found after copying model definitions.');
    }
    
    // Step 4: Copy all template files
    await copyAllTemplateFiles(TEMPLATES_DIR, targetPath, appName, appTitle, modelClassNames, rootClass, testDataPath);
    
    // Step 5: Generate ModelPanelConfig.json dynamically from model definitions
    console.log('Generating ModelPanelConfig.json...');
    const modelPanelConfigDir = join(targetPath, 'js', 'view', 'config');
    await mkdir(modelPanelConfigDir, { recursive: true });
    
    try {
      // Use the specified model definitions directory or the app's shared/data-model directory
      const sourceModelDir = options.modelDefsDir || dataModelDir;
      
      // Generate the model panel configuration
      const config = await generateModelPanelConfig(sourceModelDir, appName);
      
      // Write the configuration to file
      const configPath = join(modelPanelConfigDir, 'ModelPanelConfig.json');
      await writeFile(configPath, JSON.stringify(config, null, 2), 'utf8');
      console.log(`  ✓ Created ModelPanelConfig.json from model definition`);
    } catch (configError) {
      // Don't mask the error - let it fail hard so issues are exposed
      throw new Error(`Failed to generate ModelPanelConfig.json: ${configError.message}`);
    }

    console.log('\n✅ Successfully created app at', targetPath);
    console.log('\nNext steps:');
    console.log(`  1. Review ${appName}.html and apps/${appName}/App.js`);
    console.log(`  2. Start a local server to test your app`);
    console.log(`  3. Visit http://localhost:<port>/${appName}.html`);
    console.log('\nFor more information, see the README.md file.');
  } catch (error) {
    console.error('Error creating app:', error.message);
    process.exit(1);
  }
  
  // NOTE: The previous copyWithDirs function was removed as it was no longer being used
}

async function copyDataFile(dataFile, targetPath) {
  const sourceFile = resolve(process.cwd(), dataFile);
  const destFile = join(targetPath, 'resources', basename(dataFile));
  
  console.log(`Copying data file from ${sourceFile} to ${destFile}`);
  
  try {
    // Check if source file exists
    if (!fs.existsSync(sourceFile)) {
      throw new Error(`Data file not found: ${sourceFile}`);
    }
    
    // Ensure resources directory exists
    const resourcesPath = join(targetPath, 'resources');
    await mkdir(resourcesPath, { recursive: true });
    
    // Copy the file
    const fileContent = await readFile(sourceFile);
    await writeFile(destFile, fileContent);
    
    // Get the path relative to the app directory for use in App.js
    const relativePath = `resources/${basename(dataFile)}`;
    console.log(`  ✓ Copied data file to: ${relativePath}`);
    
    // Note: Not auto-generating model definition files anymore, as they should be provided via --model-defs-dir
    
    // Return the relative path to the data file
    return relativePath;
  } catch (error) {
    console.error(`  ✗ Error copying data file:`, error.message);
    throw error; // Re-throw to enforce hard error handling
  }
}

/**
 * Copy model definition files from a source directory
 * @param {string} modelDefsDir - Path to directory containing model definition files
 * @param {string} targetPath - Path to app directory
 * @param {string} appName - Name of the app
 * @param {string} rootClassName - Name of the root class
 * @returns {Promise<void>}
 */
async function copyModelDefinitions(modelDefsDir, targetPath, appName, rootClassName) {
  try {
    if (!modelDefsDir || !fs.existsSync(modelDefsDir)) {
      console.log('No model definitions directory provided. Skipping model definitions copy.');
      return;
    }
    
    console.log('\nCopying model definitions...');
    
    // Get list of JSON files in the source directory
    const files = fs.readdirSync(modelDefsDir);
    const jsonFiles = files.filter(file => file.endsWith('.json'));
    
    if (jsonFiles.length === 0) {
      console.log('  - No JSON model definitions found in source directory');
      return;
    }
    
    // Ensure target directory exists
    const targetDir = join(targetPath, 'shared/data-model');
    await mkdir(targetDir, { recursive: true });
    
    // Copy each JSON file
    const copiedFiles = [];
    for (const file of jsonFiles) {
      const sourcePath = join(modelDefsDir, file);
      const targetFilePath = join(targetDir, file);
      
      await fsPromises.copyFile(sourcePath, targetFilePath);
      copiedFiles.push(file);
      console.log(`  - Copied ${file}`);
    }
    
    if (copiedFiles.length > 0) {
      console.log(`  - Successfully copied ${copiedFiles.length} model definition files`);
    }
  } catch (error) {
    console.error(`Error copying model definitions: ${error.message}`);
    throw error;
  }
}

/**
 * Copy all template files to the app directory
 * @param {string} templatesDir - Path to templates directory
 * @param {string} targetPath - Path to target app directory
 * @param {string} appName - Name of the app
 * @param {string} appTitle - Title of the app
 * @param {string[]} modelClassNames - Array of all model class names
 * @param {string} rootClassName - Name of the root class
 * @param {string} testDataPath - Relative path to test data file
 * @returns {Promise<void>}
 */
async function copyAllTemplateFiles(templatesDir, targetPath, appName, appTitle, modelClassNames, rootClassName, testDataPath) {
  // Validate inputs
  if (!templatesDir || !targetPath || !appName) {
    throw new Error('Missing required parameters for copying template files');
  }
  
  if (!fs.existsSync(templatesDir)) {
    throw new Error(`Templates directory not found: ${templatesDir}`);
  }
  
  // Create necessary directories
  for (const dir of DIRS_TO_CREATE) {
    await mkdir(join(targetPath, dir), { recursive: true });
  }
  
  // Copy static files
  for (const file of FILES_TO_COPY) {
    const sourcePath = join(templatesDir, file.src);
    const destPath = join(targetPath, file.dest);
    
    if (!fs.existsSync(sourcePath)) {
      throw new Error(`Template file not found: ${sourcePath}`);
    }
    
    // Ensure the destination directory exists
    await mkdir(dirname(destPath), { recursive: true });
    
    // Read template content
    let content = await readFile(sourcePath, 'utf8');
    
    // Replace variables in template
    content = content
      .replace(/\{\{APP_NAME\}\}/g, appName)
      .replace(/\{\{APP_TITLE\}\}/g, appTitle || appName)
      .replace(/\{\{APP_FOLDER_PATH\}\}/g, appName) // Fix app folder path for model loading
      .replace(/\{\{TEST_DATA_PATH\}\}/g, testDataPath || '')
      .replace(/\{\{ROOT_CLASS_NAME\}\}/g, rootClassName || '') // Add root class name replacement
      // Ensure model class names are output as a flat array, not nested
      .replace(/\{\{MODEL_CLASS_NAMES\}\}/g, modelClassNames ? JSON.stringify(modelClassNames) : '[]');
    
    // Special handling for TEST_DATA_PATHS array
    if (content.includes('{{TEST_DATA_PATHS}}')) {
      // Always include the test data path - this is a mandatory parameter now
      if (testDataPath) {
        content = content.replace(/\{\{TEST_DATA_PATHS\}\}/g, `'${testDataPath}'`);
      } else {
        // This should not happen because we enforce the data file parameter
        // but handle it gracefully just in case
        console.warn('Warning: No test data path available for template replacement');
        content = content.replace(/return \[\s*\{\{TEST_DATA_PATHS\}\}\s*\];/g, "return ['resources/testData.json']; // Default fallback path");
      }
    }
    
    // Write processed file
    await writeFile(destPath, content, 'utf8');
    console.log(`  ✓ Created: ${destPath}`);
  }
  
  // Copy and process HTML template
  const htmlTemplatePath = join(templatesDir, 'index.html');
  if (!fs.existsSync(htmlTemplatePath)) {
    throw new Error(`HTML template not found: ${htmlTemplatePath}`);
  }
  
  // Read HTML template
  let htmlContent = await readFile(htmlTemplatePath, 'utf8');
  
  // Replace variables
  htmlContent = htmlContent
    .replace(/\{\{APP_TITLE\}\}/g, appTitle || appName)
    // CSS_PATH and IMPORT_PATH are no longer used, as we've hardcoded them in the template
    // But we'll keep the replacements for backwards compatibility
    .replace(/\{\{CSS_PATH\}\}/g, ``)
    .replace(/\{\{IMPORT_PATH\}\}/g, ``)
    // Set the correct path to the app's main JavaScript file in the new directory structure
    .replace(/\{\{SCRIPT_PATH\}\}/g, `apps/${appName}/js/App.js`);
  
  // Write app HTML file to app directory
  const appHtmlPath = join(targetPath, `${appName}.html`);
  await writeFile(appHtmlPath, htmlContent, 'utf8');
  console.log(`  ✓ Created: ${appHtmlPath}`);
  
  // Write root HTML file for easier access
  const rootHtmlPath = join(dirname(dirname(targetPath)), `${appName}.html`);
  await writeFile(rootHtmlPath, htmlContent, 'utf8');
  console.log(`  ✓ Created: ${rootHtmlPath}`);
  
  console.log(`  ✓ Successfully copied all template files`);
}

/**
 * Generates a valid ModelPanelConfig.json from the root model class
 * @param {string} modelDefsDir - Path to model definitions directory
 * @param {string} appName - Name of the app
 * @returns {Promise<object>} Generated ModelPanel configuration
 */
async function generateModelPanelConfig(modelDefsDir, appName) {
  // Validate inputs
  if (!modelDefsDir) {
    throw new Error('Model definitions directory is required');
  }
  
  if (!fs.existsSync(modelDefsDir)) {
    throw new Error(`Model definitions directory not found: ${modelDefsDir}`);
  }
  
  // Read root class file
  let rootClassFile = null;
  const files = await fsPromises.readdir(modelDefsDir);
  const jsonFiles = files.filter(file => file.endsWith('.json'));
  
  for (const file of jsonFiles) {
    try {
      const content = await readFile(join(modelDefsDir, file), 'utf8');
      const def = JSON.parse(content);
      if (def.IsRoot) {
        rootClassFile = file;
        break;
      }
    } catch (err) {
      // Silently continue if a file can't be parsed
    }
  }
  
  if (!rootClassFile) {
    throw new Error(`Root class definition not found in model definitions directory`);
  }
  
  // Read root class definition
  const content = await readFile(join(modelDefsDir, rootClassFile), 'utf8');
  const rootClassDef = JSON.parse(content);
  
  // Generate configuration that matches the working app format
  const config = {
    "ConfigName": "ModelPanelConfig",
    "Description": `Configuration for the Model Panel view in ${appName}`,
    "ModelClass": `${rootClassDef.ClassName}`,
    "PropertyGroups": [],
    "ArrayConfigs": []
  };
  
  if (!rootClassDef.Properties) {
    return config;
  }
  
  // Process properties into property groups that match expected format
  const basicGroup = {
    "GroupName": "Basic Settings",
    "Order": 1,
    "Properties": []
  };
  
  const additionalGroups = [];
  let propertyOrder = 1;
  
  for (const [propName, propDef] of Object.entries(rootClassDef.Properties)) {
    if (propDef.IsArray) {
      // Handle array properties in ArrayConfigs section with proper structure
      // Try to find the class definition for the array items to get proper property names
      const arrayType = propDef.Type.replace(/\[\]$/, ''); // Remove [] if present
      let arrayItemDef = null;
      let displayPropertyName = "Name"; // Default to properly cased Name
      
      // Look for the array item's class definition
      for (const file of jsonFiles) {
        try {
          const content = await readFile(join(modelDefsDir, file), 'utf8');
          const def = JSON.parse(content);
          if (def.ClassName === arrayType) {
            arrayItemDef = def;
            break;
          }
        } catch (err) {
          // Continue if file can't be parsed
        }
      }
      
      // Build DisplayProperties for all primitive properties in the array item class
      const displayProperties = [];
      let displayPropOrder = 1;
      
      if (arrayItemDef && arrayItemDef.Properties) {
        // Create a display property for each primitive property in the item class
        for (const [itemPropName, itemPropDef] of Object.entries(arrayItemDef.Properties)) {
          if (itemPropDef.IsPrimitive) {
            displayProperties.push({
              "PropertyPath": itemPropName, // Use exact case from class definition
              "Label": itemPropName.charAt(0).toUpperCase() + itemPropName.slice(1),
              "Order": displayPropOrder++
            });
          }
        }
      } else {
        // Fallback if we couldn't find the array item's class definition
        displayProperties.push({
          "PropertyPath": "Name", // Default with proper casing
          "Label": "Name", 
          "Order": 1
        });
      }
      
      // Create array config with proper casing and all primitive properties
      config.ArrayConfigs.push({
        "PropertyPath": propName,
        "Label": propName.charAt(0).toUpperCase() + propName.slice(1),
        "Order": config.ArrayConfigs.length + 1,
        "DisplayProperties": displayProperties
      });
    } else if (propDef.IsPrimitive) {
      // Handle primitive properties
      // Use the exact property name with original casing from the model definition
      basicGroup.Properties.push({
        "PropertyPath": propName, // Keep original case from model definition
        "Label": propName.charAt(0).toUpperCase() + propName.slice(1),
        "Order": propertyOrder++
      });
    } else {
      // Handle complex object properties as their own top-level property
      // The ModelPanel component doesn't handle dot notation for nested properties
      try {
        // Instead of using dot notation, add the object property itself with original casing
        basicGroup.Properties.push({
          "PropertyPath": propName, // Preserve original case from model definition
          "Label": propName.charAt(0).toUpperCase() + propName.slice(1),
          "Order": propertyOrder++
        });
        
        // Find and load the class definition
        const type = propDef.Type;
        let typeDefFile = null;
        
        for (const file of jsonFiles) {
          try {
            const content = await readFile(join(modelDefsDir, file), 'utf8');
            const def = JSON.parse(content);
            if (def.ClassName === type) {
              typeDefFile = file;
              break;
            }
          } catch (err) {
            // Continue if this file can't be parsed
          }
        }
        
        // We skip creating additional property groups for complex objects
        // because the ModelPanel component can't handle dot notation paths
        // The object itself will be editable in the UI
      } catch (err) {
        // Don't silently mask errors - log them clearly for debugging
        console.error(`Error processing nested property ${propName}: ${err.message}`);
        throw new Error(`Failed to process property ${propName}: ${err.message}`);
      }
    }
  }
  
  // Add basic group if it has properties
  if (basicGroup.Properties.length > 0) {
    config.PropertyGroups.push(basicGroup);
  }
  
  // Add additional groups
  for (const group of additionalGroups) {
    config.PropertyGroups.push(group);
  }
  
  return config;
}

// Command-line processing
const args = process.argv.slice(2);
let appName, dataFile, force = false, title, modelDefsDir;
let i = 0;

// Parse command-line arguments
while (i < args.length) {
  const arg = args[i];
  
  if (arg === '--force' || arg === '-f') {
    force = true;
  } else if (arg === '--title' && i+1 < args.length) {
    title = args[++i];
  } else if (arg === '--data' && i+1 < args.length) {
    dataFile = args[++i];
  } else if (arg === '--model-defs-dir' && i+1 < args.length) {
    modelDefsDir = args[++i];
  } else if (!appName) {
    appName = arg;
  } else {
    console.warn(`Warning: Ignoring unexpected argument: ${arg}`);
  }
  i++;
}

// Validate app name
if (!appName) {
  console.error('Error: Please provide an app name');
  console.error('Usage: node create-app.js [options] <app-name> --data <data-file>');
  console.error('Options:');
  console.error('  --force, -f           Force overwrite if app directory already exists');
  console.error('  --title <title>       Set the application title');
  console.error('  --data <data-file>    Path to a data file to copy to resources/');
  console.error('  --model-defs-dir <dir> Path to a directory containing model definitions');
  console.error('');
  console.error('Arguments:');
  console.error('  app-name:  Name for your application (will be created in apps/ directory)');
  console.error('  data-file: Optional path to a data file to copy to resources/');
  process.exit(1);
}

// Check if required parameters are provided
if (!dataFile) {
  console.error('Error: Data file is mandatory. Please provide using --data parameter');
  console.error('Usage: node create-app.js [options] <app-name> --data <data-file>');
  process.exit(1);
}

// Create the target path inside the apps directory
const targetPath = join(APPS_DIR, appName);

// Check if target directory already exists
if (fs.existsSync(targetPath)) {
  if (force) {
    console.warn(`WARNING: App directory ${targetPath} already exists and will be overwritten`);
    await rm(targetPath, { recursive: true, force: true });
  } else {
    console.error(`Error: App directory ${targetPath} already exists`);
    console.error('Use --force to overwrite existing app');
    process.exit(1);
  }
}

// Check if root HTML already exists
const rootHtmlPath = join(ROOT_PATH, `${appName}.html`);
if (fs.existsSync(rootHtmlPath)) {
  if (force) {
    console.warn(`WARNING: Root HTML file ${rootHtmlPath} already exists and will be overwritten`);
  } else {
    console.error(`Error: Root HTML file ${rootHtmlPath} already exists`);
    console.error('Use --force to overwrite the existing file');
    process.exit(1);
  }
}

// Create the apps directory if it doesn't exist
await mkdir(APPS_DIR, { recursive: true });

// Run the app creation process
try {
  await createApp(targetPath, dataFile, { 
    force,
    title: title || `${appName} Application`,
    modelDefsDir: modelDefsDir
  });
  console.log(`\n✅ Successfully created app at ${targetPath}\n`);
  console.log('Next steps:');
  console.log(`  1. Review ${appName}.html and apps/${appName}/js/App.js`);
  console.log(`  2. Update js/view/config/ModelPanelConfig.json with your model properties`);
  console.log(`  3. Start a local server to test your app`);
  console.log(`  4. Visit http://localhost:<port>/${appName}.html\n`);
  console.log('For more information, see the README.md file.');
} catch (error) {
  console.error(`Error creating app: ${error.message}`);
  process.exit(1);
}
