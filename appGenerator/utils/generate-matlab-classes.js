/**
 * JavaScript utility to generate MATLAB class files from JSON model definitions
 * This replicates the functionality of serverFramework/+server/+model/generateAppModels.m
 * and serverFramework/+server/+model/generateModelClasses.m
 */

import { promises as fsPromises } from 'fs';
import fs from 'fs';
import { join, basename, dirname } from 'path';
import { mkdir } from 'fs/promises';

/**
 * Generate MATLAB class files for an application from JSON model definitions
 * @param {string} appName - Name of the application
 * @param {string} dataModelDir - Path to directory containing JSON model definitions
 * @param {string} targetDir - Path to output directory for MATLAB class files
 * @param {Object} options - Additional options
 * @returns {Promise<string[]>} - Array of generated file paths
 */
export async function generateMatlabClasses(appName, dataModelDir, targetDir, options = {}) {
  const {
    overwrite = false,
    verbose = true
  } = options;
  
  // Ensure directories exist
  if (!fs.existsSync(dataModelDir)) {
    throw new Error(`Data model directory not found: ${dataModelDir}`);
  }
  
  // Create the package directory structure
  const packageDir = join(targetDir, `+${appName}`);
  await mkdir(packageDir, { recursive: true });
  
  if (verbose) {
    console.log(`Created package directory: ${packageDir}`);
  }
  
  // Get all JSON files in the data-model directory
  const files = await fsPromises.readdir(dataModelDir);
  const jsonFiles = files.filter(file => file.endsWith('.json'));
  
  if (jsonFiles.length === 0) {
    throw new Error(`No JSON files found in ${dataModelDir}`);
  }
  
  const generatedFiles = [];
  
  // Generate each model class
  for (const file of jsonFiles) {
    const jsonFile = join(dataModelDir, file);
    
    if (verbose) {
      console.log(`Generating class for ${file}...`);
    }
    
    try {
      // Read the JSON file to check if it's the root class
      const jsonText = await fsPromises.readFile(jsonFile, 'utf8');
      const classDef = JSON.parse(jsonText);
      
      // Determine if this is the root class
      const isRoot = classDef.IsRoot || false;
      
      // Generate the class file
      const classFile = await generateModelClass(
        jsonFile,
        packageDir,
        {
          overwrite,
          verbose,
          isRoot,
          appName
        }
      );
      
      generatedFiles.push(classFile);
      
      if (verbose) {
        console.log(`  -> Generated ${classDef.ClassName} in ${packageDir}`);
      }
    } catch (err) {
      console.warn(`Warning: Failed to generate class for ${file}: ${err.message}`);
    }
  }
  
  if (verbose) {
    console.log(`Done generating ${generatedFiles.length} model classes in ${targetDir}`);
  }
  
  return generatedFiles;
}

/**
 * Generate a MATLAB class file from a JSON model definition
 * @param {string} jsonFile - Path to JSON model definition file
 * @param {string} targetDir - Path to output directory
 * @param {Object} options - Additional options
 * @returns {Promise<string>} - Path to generated file
 */
async function generateModelClass(jsonFile, targetDir, options = {}) {
  const {
    overwrite = false,
    verbose = true,
    isRoot = false,
    appName = ''
  } = options;
  
  // Read and parse the JSON file
  const jsonText = await fsPromises.readFile(jsonFile, 'utf8');
  const modelDef = JSON.parse(jsonText);
  
  // Get class name from the definition or filename
  const className = modelDef.ClassName || basename(jsonFile, '.json');
  
  // Always use one of our two standard superclasses
  // Root classes use RootModel, all others use BaseObject
  let superClass;
  if (isRoot) {
    superClass = 'server.model.RootModel';
  } else {
    // Hardcode non-root models to always use server.model.BaseObject
    superClass = 'server.model.BaseObject';
  }
  
  // Generate the class file content
  const classContent = generateClassFileContent(modelDef, superClass, appName);
  
  // Write the class file directly in the package directory (no @ folders)
  const classFile = join(targetDir, `${className}.m`);
  
  // Check if file exists and should be overwritten
  if (fs.existsSync(classFile) && !overwrite) {
    if (verbose) {
      console.log(`  -> Skipping existing file: ${classFile}`);
    }
    return classFile;
  }
  
  await fsPromises.writeFile(classFile, classContent);
  return classFile;
}

/**
 * Generate MATLAB class file content from a model definition
 * @param {Object} modelDef - Model definition object
 * @param {string} superClass - Superclass name
 * @param {string} appName - Application name
 * @returns {string} - MATLAB class file content
 */
function generateClassFileContent(modelDef, superClass, appName) {
  const className = modelDef.ClassName;
  const properties = modelDef.Properties || {};
  const description = modelDef.Description || '';
  
  // Start with the class definition
  let content = `classdef ${className} < ${appName === className ? 'server.model.RootModel' : superClass}\n`;
  content += '    \n';
  content += '    %\n';
  
  // Separate properties into read-only and public
  const readOnlyProps = {};
  const publicProps = {};
  
  for (const propName in properties) {
    const prop = properties[propName];
    if (prop.ReadOnly) {
      readOnlyProps[propName] = prop;
    } else {
      publicProps[propName] = prop;
    }
  }
  
  // Read-only properties section
  content += '    properties (SetObservable, GetAccess=public, SetAccess=?server.model.BaseObject)\n';
  let hasReadOnlyProps = false;
  for (const propName in readOnlyProps) {
    hasReadOnlyProps = true;
    const prop = readOnlyProps[propName];
    content += generatePropertyDefinition(propName, prop, appName);
  }
  if (!hasReadOnlyProps) {
    content += '\n';
  }
  content += '    end\n\n';
  
  // Public properties section
  content += '    properties (SetObservable, Access=public)\n';
  let hasPublicProps = false;
  for (const propName in publicProps) {
    hasPublicProps = true;
    const prop = publicProps[propName];
    content += generatePropertyDefinition(propName, prop, appName);
  }
  if (!hasPublicProps) {
    content += '\n';
  }
  content += '    end\n\n';
  
  content += 'end  % classdef\n';
  
  return content;
}

/**
 * Generate a property definition with validation
 * @param {string} propName - Property name
 * @param {Object} prop - Property definition
 * @param {string} appName - Application name
 * @returns {string} - MATLAB property definition
 */
function generatePropertyDefinition(propName, prop, appName) {
  // Add property comment
  let propDef = `        % ${prop.Description || propName}\n`;
  propDef += `        ${propName}`;
  
  // Add size validation
  if (prop.Size) {
    propDef += ` (${prop.Size})`;
  } else if (prop.IsArray) {
    propDef += ` (:,1)`;
  } else {
    propDef += ` (1,1)`;
  }
  
  // Map JavaScript types to MATLAB types
  const typeMap = {
    'string': 'string',
    'number': 'double',
    'boolean': 'logical',
    'array': 'cell',
    'object': 'struct'
  };
  
  // Add type validation
  if (prop.Type) {
    let propType = prop.Type;
    
    // Convert JavaScript types to MATLAB types
    if (typeMap[propType]) {
      propType = typeMap[propType];
    }
    
    // Ensure non-primitive types are package-qualified
    if (!prop.IsPrimitive && !propType.includes('.') && 
        !['cell', 'struct', 'table', 'char', 'string', 'double', 'single', 
          'int8', 'int16', 'int32', 'int64', 'uint8', 'uint16', 'uint32', 'uint64', 'logical'].includes(propType)) {
      propType = `${appName}.${propType}`;
    }
    
    propDef += ` ${propType}`;
  }
  
  // Add validation for enum values
  if (prop.ValidValues && Array.isArray(prop.ValidValues) && prop.ValidValues.length > 0) {
    const validValuesStr = prop.ValidValues.map(v => `"${v}"`).join(', ');
    propDef += ` {mustBeMember(${propName}, [${validValuesStr}])}`;
  }
  
  // Add default value
  if (prop.DefaultValue !== undefined) {
    let defaultValue = prop.DefaultValue;
    
    if (typeof defaultValue === 'string') {
      defaultValue = `"${defaultValue}"`;
    } else if (Array.isArray(defaultValue) && defaultValue.length === 0) {
      if (prop.Type && prop.Type.includes('.')) {
        defaultValue = `${prop.Type}.empty`;
      } else {
        defaultValue = '[]';
      }
    } else if (defaultValue === null) {
      defaultValue = '[]';
    } else if (typeof defaultValue === 'boolean') {
      defaultValue = defaultValue ? 'true' : 'false';
    }
    
    propDef += ` = ${defaultValue}`;
  } else if (prop.Type === 'string') {
    propDef += ` = ""`;
  } else if (prop.Type === 'double' || prop.Type === 'single') {
    propDef += ` = 0`;
  } else if (prop.Type === 'logical') {
    propDef += ` = false`;
  } else if (prop.Type && prop.Type.includes('.')) {
    propDef += ` = ${prop.Type}.empty`;
  }
  
  propDef += '\n\n';  // Add extra newline after each parameter definition
  return propDef;
}

/**
 * Main function to generate MATLAB classes for an app
 * @param {string} appName - Name of the application
 * @param {string} appDir - Path to the app directory
 * @param {Object} options - Additional options
 * @returns {Promise<string[]>} - Array of generated file paths
 */
export async function generateAppModels(appName, appDir, options = {}) {
  const {
    overwrite = false,
    verbose = true
  } = options;
  
  // Set up directories
  const dataModelDir = join(appDir, 'data-model');
  const serverModelDir = join(appDir, 'server', 'model');
  
  // Ensure data model directory exists
  if (!fs.existsSync(dataModelDir)) {
    throw new Error(`Data model directory not found: ${dataModelDir}`);
  }
  
  // Create server model directory if it doesn't exist
  await mkdir(serverModelDir, { recursive: true });
  
  // Generate MATLAB classes
  return generateMatlabClasses(appName, dataModelDir, serverModelDir, {
    overwrite,
    verbose
  });
}
