// src/models/AbstractModelObject.js
import { modelClassDefinitionManager } from './ModelClassDefinitionManager.js';

export class AbstractModelObject {
    // This will be overridden by child classes
    static className = 'AbstractModelObject';
    
    /**
     * Create a new model instance
     * @param {Object} [data={}] - The data to initialize the model with
     * @param {Object} [manager=modelClassDefinitionManager] - The model class definition manager to use
     */
    constructor(data = {}, manager) {
        if (!manager) {
            throw new Error('ModelClassDefinitionManager is required');
        }
        
        // Get the class name from the static className property
        const className = this.constructor.className;
        if (!className) {
            throw new Error('Class must define a static className property');
        }
        
        // Store the manager and class name on the instance
        this._manager = manager;
        this._className = className;
        
        // Initialize properties from the class definition
        this._initializeProperties(className, data);
    }

    _initializeProperties(className, data) {
        //console.log(`\nInitializing properties for ${className}`);
        //console.log('Input data:', JSON.stringify(data, null, 2));
        
        // Get the full class hierarchy
        const hierarchy = this._manager.getClassHierarchy(className);
        //console.log('Class hierarchy:', hierarchy.map(c => c.ClassName || c));
        
        // Process each class in the hierarchy from parent to child
        hierarchy.forEach(definition => {
            //console.log(`\nProcessing class: ${definition.ClassName}`);
            if (definition.Properties) {
                //console.log(`Found ${Object.keys(definition.Properties).length} properties`);
                Object.entries(definition.Properties).forEach(([propName, propDef]) => {
                    //console.log(`\nInitializing property: ${propName}`);
                    //console.log('Property definition:', JSON.stringify(propDef, null, 2));
                    
                    // Get the value from data or use undefined to get default
                    const value = data.hasOwnProperty(propName) ? data[propName] : undefined;
                    //console.log('Initial value:', value);
                    
                    this._initializeProperty(propName, propDef, value);
                    
                    //console.log(`After initialization: ${propName} =`, this[propName]);
                });
            } else {
                console.log('No properties defined');
            }
        });
        
        // Store the class name as a non-enumerable property
        Object.defineProperty(this, '_className', {
            value: this.constructor.className,
            enumerable: false,
            configurable: true,
            writable: false
        });
        
        //console.log('\nFinal instance state:', JSON.stringify(this, null, 2));
    }

    _initializeProperty(propName, propDef, value) {
        const defaultValue = this._getDefaultValue(propDef);
        const finalValue = value !== undefined ? value : defaultValue;
        
        // Set the property directly with validated value
        this[propName] = this._validateValue(finalValue, propDef);
    }

    _getDefaultValue(propDef) {
        if (propDef.DefaultValue !== undefined) {
            return propDef.DefaultValue;
        }
        return propDef.IsArray ? [] : undefined;
    }

    _validateValue(value, propDef) {
        // Handle null/undefined values
        if (value === null || value === undefined) {
            return this._getDefaultValue(propDef);
        }

        // Handle array types
        if (propDef.IsArray) {
            if (!Array.isArray(value)) {
                value = [value];
            }
            
            // Validate array items if they are objects
            if (!propDef.IsPrimitive && propDef.Type) {
                return value.map(item => {
                    if (item && typeof item === 'object' && !Array.isArray(item)) {
                        const Constructor = this._manager.getClass(propDef.Type);
                        return new Constructor(item, this._manager);
                    }
                    return item;
                });
            }
            
            return value;
        }

        // Handle primitive types
        if (propDef.IsPrimitive) {
            const expectedType = propDef.Type.toLowerCase();
            let convertedValue = value;
            
            // Try to convert to the expected type
            try {
                switch (expectedType) {
                    case 'number':
                        convertedValue = Number(value);
                        if (isNaN(convertedValue)) throw new Error('Not a number');
                        break;
                    case 'boolean':
                        if (typeof value === 'string') {
                            convertedValue = value.toLowerCase() === 'true';
                        } else {
                            convertedValue = Boolean(value);
                        }
                        break;
                    case 'string':
                        convertedValue = String(value);
                        break;
                }
                
                // Validate enum values
                if (propDef.Enum && !propDef.Enum.includes(convertedValue)) {
                    console.warn(`Value "${convertedValue}" is not in enum: ${propDef.Enum.join(', ')}`);
                }
                
                return convertedValue;
                
            } catch (error) {
                console.warn(`Failed to convert value "${value}" to type ${expectedType}:`, error.message);
                return this._getDefaultValue(propDef);
            }
        }
        
        // Handle object types
        if (propDef.Type && typeof value === 'object' && value !== null) {
            try {
                const Constructor = this._manager.getClass(propDef.Type);
                return new Constructor(value);
            } catch (error) {
                console.warn(`Failed to create instance of ${propDef.Type}:`, error.message);
                return this._getDefaultValue(propDef);
            }
        }

        return value;
    }

    getPrimitiveProperties() {
        return this._getPropertiesByType(true);
    }

    getObjectProperties() {
        return this._getPropertiesByType(false);
    }

    _getPropertiesByType(wantPrimitive) {
        const properties = [];
        const className = this.constructor.className;
        const hierarchy = this._manager.getClassHierarchy(className);
        
        hierarchy.forEach(definition => {
            if (definition.Properties) {
                Object.entries(definition.Properties).forEach(([propName, propDef]) => {
                    if (propDef.IsPrimitive === wantPrimitive) {
                        properties.push({
                            name: propName,
                            ...propDef
                        });
                    }
                });
            }
        });
        
        return properties;
    }

    toJSON() {
        const result = {};
        const properties = [
            ...this.getPrimitiveProperties(),
            ...this.getObjectProperties()
        ];
        
        properties.forEach(prop => {
            const value = this[prop.name];
            
            // Handle nested model instances
            if (value && typeof value === 'object' && !Array.isArray(value) && value.toJSON) {
                result[prop.name] = value.toJSON();
            } 
            // Handle arrays of model instances
            else if (Array.isArray(value) && value.length > 0 && value[0] && value[0].toJSON) {
                result[prop.name] = value.map(item => item.toJSON());
            }
            // Handle primitive values and arrays
            else {
                result[prop.name] = value;
            }
        });
        
        return result;
    }
}