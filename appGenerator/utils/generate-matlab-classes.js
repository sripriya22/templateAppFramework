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
  const classFilePath = join(targetDir, `${className}.m`);
  
  if (!overwrite && fs.existsSync(classFilePath)) {
    throw new Error(`Class file already exists: ${classFilePath}`);
  }
  
  await fsPromises.writeFile(classFilePath, classContent, 'utf8');
  
  return classFilePath;
}

/**
 * Generate MATLAB class file content from a model definition
 * @param {Object} modelDef - Model definition object
 * @param {string} superClass - Superclass name
 * @param {string} appName - Application name
 * @returns {string} - MATLAB class file content
 */
function generateClassFileContent(modelDef, superClass, appName) {
  const className = modelDef.ClassName || 'UnnamedClass';
  const description = modelDef.Description || `${className} class`;
  const properties = modelDef.Properties || {};
  const constraints = modelDef.Constraints || [];
  
  // Collect properties that need setters because they're involved in constraints
  const constrainedProps = new Set();
  if (constraints.length > 0) {
    constraints.forEach(constraint => {
      if (constraint.properties && Array.isArray(constraint.properties)) {
        constraint.properties.forEach(prop => constrainedProps.add(prop));
      }
    });
  }
  
  // Start with the class definition and documentation
  let content = `classdef ${className} < ${superClass}\n`;
  content += '    %\n';
  content += `    % ${description}\n`;
  content += '    %\n';
  content += '    % This class was automatically generated from a JSON model definition.\n';
  
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
  content += '\n    properties (SetObservable, GetAccess=public, SetAccess=?server.model.BaseObject)\n';
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
  
  // Methods section
  content += '    methods\n';
  
  // Constructor
  content += `        function obj = ${className}()\n`;
  content += '            % Constructor\n';
  content += `            obj = obj@${superClass}();\n`;
  content += '        end\n\n';
  
  // Generate property setters for constrained properties
  if (constrainedProps.size > 0) {
    // Iterate through the constrained properties and generate setters
    for (const propName of constrainedProps) {
      // Skip properties that don't exist in the model definition
      if (!properties[propName]) continue;
      // Skip read-only properties
      if (properties[propName].ReadOnly) continue;
      
      content += `        function set.${propName}(obj, value)\n`;
      content += `            % Setter for ${propName} with constraint validation\n`;
      
      // Add type checking for arrays if applicable
      const propDef = properties[propName];
      if (propDef.IsArray && propDef.Type && !propDef.IsPrimitive) {
        // For arrays of custom objects
        content += '            % Verify array elements are of correct type\n';
        
        // Type checking switch based on whether it's a primitive type or custom class
        if (['cell', 'struct', 'table', 'char', 'string', 'double', 'single', 
             'int8', 'int16', 'int32', 'int64', 'uint8', 'uint16', 'uint32', 'uint64', 'logical'].includes(propDef.Type)) {
          // Built-in MATLAB type
          content += `            if ~isempty(value) && ~isa(value, '${propDef.Type}')\n`;
          content += `                error('Value must be of type ${propDef.Type}');\n`;
          content += '            end\n';
        } else {
          // Custom class type - needs app namespace qualification
          const fullClassName = propDef.Type.includes('.') ? propDef.Type : `${appName}.${propDef.Type}`;
          content += '            if ~isempty(value)\n';
          content += '                % Check each element in the array\n';
          content += '                for i = 1:numel(value)\n';
          content += `                    if ~isa(value(i), '${fullClassName}')\n`;
          content += `                        error('All elements must be of type ${fullClassName}');\n`;
          content += '                    end\n';
          content += '                end\n';
          content += '            end\n';
        }
      }
      
      content += `            obj.${propName} = value;\n`;
      content += '            % Validate constraints after setting the value\n';
      content += '            obj.validateConstraints();\n'; // Call method as obj.validateConstraints()
      content += '        end\n\n';
    }
  }
  
  // Generate constraint validation method if constraints exist
  if (constraints.length > 0) {
    content += '        function validateConstraints(obj)\n';
    content += '            % Validate cross-property constraints\n';
    content += '            % This method is called from property setters and can be invoked manually\n';
    
    // Add each constraint check
    constraints.forEach(constraint => {
      const condition = constraint.condition;
      const errorMessage = constraint.errorMessage || 'Constraint violation';
      
      // Create a MATLAB if statement that checks the condition
      // Condition is JS-like, needs translation for MATLAB:
      // 1. Replace JavaScript equality operators
      // 2. Replace JavaScript logical operators
      // 3. Replace JavaScript property access (this.propertyName) with MATLAB style (obj.propertyName)
      // 4. Handle any numeric operators consistently
      
      let matlabCondition = condition
        // Replace equality operators
        .replace(/===/g, '==')
        .replace(/!==/g, '~=')
        .replace(/!=/g, '~=')
        
        // Replace logical operators
        .replace(/&&/g, '&')
        .replace(/\|\|/g, '|')
        .replace(/!/g, '~')
        
        // Replace property access - this is the key fix
        // Pattern to match this.property or this['property']
        .replace(/this\.([a-zA-Z0-9_]+)/g, 'obj.$1')
        .replace(/this\['([a-zA-Z0-9_]+)'\]/g, 'obj.$1')
        .replace(/this\["([a-zA-Z0-9_]+)"\]/g, 'obj.$1');
      
      content += `            % Check constraint: ${constraint.id || 'unnamed'}\n`;
      content += `            if ~(${matlabCondition})\n`;
      content += `                error('${errorMessage.replace(/'/g, "''")}');\n`;
      content += '            end\n';
    });
    
    content += '        end\n\n';
  }
  
  content += '    end\n';
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
  
  // Add validation from the Validation block
  if (prop.Validation) {
    const validation = prop.Validation;
    const validations = [];
    
    // Handle minimum value constraint
    if (validation.minimum !== undefined) {
      validations.push(`mustBeGreaterThanOrEqual(${propName}, ${validation.minimum})`);
    }
    
    // Handle maximum value constraint
    if (validation.maximum !== undefined) {
      validations.push(`mustBeLessThanOrEqual(${propName}, ${validation.maximum})`);
    }
    
    // Handle non-negative constraint
    if (validation.nonNegative === true) {
      validations.push(`mustBeNonnegative(${propName})`);
    }
    
    // Add custom validation functions if specified
    if (validation.customValidation) {
      // Support array of custom validations or a single string
      if (Array.isArray(validation.customValidation)) {
        validation.customValidation.forEach(customVal => {
          validations.push(customVal.replace(/\${propName}/g, propName));
        });
      } else {
        validations.push(validation.customValidation.replace(/\${propName}/g, propName));
      }
    }
    
    // Apply the validations if any exist
    if (validations.length > 0) {
      propDef += ` {${validations.join(', ')}}`;      
    }
  }
  
  // Add validation for enum values 
  if (prop.ValidValues && Array.isArray(prop.ValidValues) && prop.ValidValues.length > 0) {
    const validValuesStr = prop.ValidValues.map(v => `"${v}"`).join(', ');
    // If we already have other validations, don't add a new block
    if (propDef.includes('{')) {
      // Extract the existing validation block and add to it
      const match = propDef.match(/\{([^}]*)\}/);
      if (match) {
        const existingValidations = match[1];
        propDef = propDef.replace(`{${existingValidations}}`, `{${existingValidations}, mustBeMember(${propName}, [${validValuesStr}])}`);
      }
    } else {
      propDef += ` {mustBeMember(${propName}, [${validValuesStr}])}`;  
    }
  }
  
  // Add default value
  if (prop.DefaultValue !== undefined) {
    let defaultValue = prop.DefaultValue;
    
    if (typeof defaultValue === 'string') {
      defaultValue = `"${defaultValue}"`;
    } else if (Array.isArray(defaultValue) && defaultValue.length === 0) {
      // Handle empty arrays for object types
      if (prop.Type) {
        if (prop.Type.includes('.')) {
          // Already qualified type
          defaultValue = `${prop.Type}.empty`;
        } else if (!prop.IsPrimitive && 
                  !['cell', 'struct', 'table', 'char', 'string', 'double', 'single', 
                    'int8', 'int16', 'int32', 'int64', 'uint8', 'uint16', 'uint32', 'uint64', 'logical'].includes(prop.Type)) {
          // Custom object class that needs qualification
          defaultValue = `${appName}.${prop.Type}.empty`;
        } else {
          // Primitive type or builtin
          defaultValue = '[]';
        }
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
    // Already qualified type
    propDef += ` = ${prop.Type}.empty`;
  } else if (prop.Type && !prop.IsPrimitive && 
            !['cell', 'struct', 'table', 'char', 'string', 'double', 'single', 
              'int8', 'int16', 'int32', 'int64', 'uint8', 'uint16', 'uint32', 'uint64', 'logical'].includes(prop.Type)) {
    // Custom object class that needs qualification
    propDef += ` = ${appName}.${prop.Type}.empty`;
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
