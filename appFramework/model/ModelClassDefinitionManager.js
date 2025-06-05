// src/models/ModelClassDefinitionManager.js
/**
 * Manages model class definitions and their relationships
 * Uses a single map to store all class information to ensure consistency
 */
export class ModelClassDefinitionManager {
    constructor() {
        /**
         * Single map to store all class information
         * Each entry contains: 
         * - constructor: The class constructor function
         * - definition: The class definition object
         * - propertyCache: Map of property lookups for faster access
         * @private
         */
        this._classRegistry = new Map();
    }
    
    /**
     * Clear all class registrations
     * @returns {ModelClassDefinitionManager} Returns the manager instance for chaining
     */
    clear() {
        this._classRegistry.clear();
        return this;
    }

    /**
     * Load multiple class definitions at once
     * @param {Object} definitions - Object mapping class names to their definitions
     * @returns {ModelClassDefinitionManager} Returns the manager instance for chaining
     * @throws {Error} If any extended class is not found
     */
    loadDefinitions(definitions) {
        // Add new definitions
        Object.entries(definitions).forEach(([className, def]) => {
            const classInfo = this._classRegistry.get(className) || { propertyCache: new Map() };
            classInfo.definition = def;
            this._classRegistry.set(className, classInfo);
        });
        
        // Validate that all extended classes exist
        for (const [className, classInfo] of this._classRegistry.entries()) {
            const def = classInfo.definition;
            if (def && def.Extends && !this._classRegistry.has(def.Extends)) {
                throw new Error(`Extended class not found: ${def.Extends} (in ${className})`);
            }
        }
        
        return this;
    }

    /**
     * Register a class with its constructor
     * @param {string} className - The name of the class
     * @param {Function} classConstructor - The class constructor function
     * @returns {ModelClassDefinitionManager} Returns the manager instance for chaining
     */
    registerClass(className, classConstructor) {
        const classInfo = this._classRegistry.get(className) || { propertyCache: new Map() };
        classInfo.constructor = classConstructor;
        
        // If the class has a static modelDefinition property, use it
        if (classConstructor.modelDefinition) {
            classInfo.definition = classConstructor.modelDefinition;
        }
        
        this._classRegistry.set(className, classInfo);
        return this;
    }
    
    /**
     * Check if a class is already registered
     * @param {string} className - The name of the class to check
     * @returns {boolean} True if the class is registered, false otherwise
     */
    isClassRegistered(className) {
        const classInfo = this._classRegistry.get(className);
        return classInfo && classInfo.constructor !== undefined;
    }

    /**
     * Get a class constructor by name
     * @param {string} className - The name of the class to get
     * @returns {Function|undefined} The class constructor or undefined if not found
     */
    getClass(className) {
        const classInfo = this._classRegistry.get(className);
        return classInfo ? classInfo.constructor : undefined;
    }
    
    /**
     * Get a class definition by name
     * @param {string} className - The name of the class to get the definition for
     * @returns {Object|undefined} The class definition or undefined if not found
     */
    getDefinition(className) {
        const classInfo = this._classRegistry.get(className);
        return classInfo ? classInfo.definition : undefined;
    }
    
    /**
     * Get the class definition for a class (alias for getDefinition)
     * @param {string} className - The name of the class to get the definition for
     * @returns {Object|undefined} The class definition or undefined if not found
     */
    getClassDefinition(className) {
        return this.getDefinition(className);
    }
    
    /**
     * Get property info for a class property
     * @param {string} className - The name of the class
     * @param {string} propName - The name of the property
     * @returns {Object|undefined} The property definition or undefined if not found
     */
    getPropertyInfo(className, propName) {
        const classInfo = this._classRegistry.get(className);
        if (!classInfo) {
            return undefined;
        }
        
        // Check property cache first
        if (classInfo.propertyCache && classInfo.propertyCache.has(propName)) {
            return classInfo.propertyCache.get(propName);
        }
        
        // Get from definition if not in cache
        const classDef = classInfo.definition;
        if (!classDef || !classDef.Properties) {
            return undefined;
        }
        
        const propInfo = classDef.Properties[propName];
        
        // Cache the result
        if (propInfo && classInfo.propertyCache) {
            classInfo.propertyCache.set(propName, propInfo);
        }
        
        return propInfo;
    }
    
    /**
     * Register a class definition
     * @param {string} className - The name of the class
     * @param {Object} definition - The class definition
     * @param {Function} [constructor] - The class constructor (optional if already registered)
     * @returns {boolean} True if registration succeeded
     */
    registerClassDefinition(className, definition, constructor) {
        // Validate inputs
        if (!className) {
            throw new Error('Class name is required');
        }
        
        if (!definition || typeof definition !== 'object') {
            throw new Error('Definition must be a non-null object');
        }
        
        // Get existing class info or create new one
        let classInfo = this._classRegistry.get(className);
        
        if (!classInfo) {
            // If no constructor is provided, create a synthetic one
            const actualConstructor = constructor || this._createSyntheticConstructor(className);
            
            // Create new class info
            classInfo = {
                constructor: actualConstructor,
                definition: null,
                propertyCache: new Map()
            };
            
            this._classRegistry.set(className, classInfo);
            console.log(`Registered synthetic class for ${className}`);
        } else if (constructor && classInfo.constructor !== constructor) {
            // If constructor is provided and different from registered one, update it
            classInfo.constructor = constructor;
        }
        
        // Store the definition
        classInfo.definition = definition;
        
        // Clear property cache
        classInfo.propertyCache.clear();
        
        return true;
    }
    
    /**
     * Creates a synthetic constructor for a class
     * @param {string} className - The name of the class to create
     * @returns {Function} A simple constructor that sets _className
     * @private
     */
    _createSyntheticConstructor(className) {
        // Create a simple constructor that sets _className and copies properties
        const SyntheticClass = function(data = {}) {
            // Set class name
            this._className = className;
            
            // Copy all properties
            Object.assign(this, data);
            
            // Ensure ID
            if (!this.id && !this.ID) {
                this.id = Math.floor(Math.random() * 1000000);
            }
        };
        
        // Set static className property for consistency
        SyntheticClass.className = className;
        
        return SyntheticClass;
    }

    /**
     * Get a class by name, throwing an error if not found
     * @param {string} className - The name of the class to get
     * @returns {Function} The class constructor
     * @throws {Error} If the class is not found
     */
    getRequiredClass(className) {
        const constructor = this.getClass(className);
        if (!constructor) {
            throw new Error(`No class registered for: ${className}`);
        }
        return constructor;
    }

    /**
     * Get the class hierarchy (inheritance chain) for a class
     * @param {string} className - The name of the class
     * @returns {Array<Object>} Array of class definitions in the inheritance chain
     *                         Each object contains the full class definition including Properties
     */
    getClassHierarchy(className) {
        const hierarchy = [];
        let current = className;
        
        while (current) {
            const classInfo = this._classRegistry.get(current);
            if (!classInfo || !classInfo.definition) break;
            
            // Create a new object with the class name and its definition
            const classDef = {
                ClassName: current,
                ...classInfo.definition
            };
            
            hierarchy.unshift(classDef);
            current = classInfo.definition.Extends;
        }
        
        return hierarchy;
    }
    
    /**
     * Get all properties for a class, including inherited ones
     * @param {string} className - The name of the class
     * @returns {Object} Object mapping property names to their definitions
     */
    getProperties(className) {
        const hierarchy = this.getClassHierarchy(className);
        const properties = {};
        
        for (const cls of hierarchy) {
            const classInfo = this._classRegistry.get(cls);
            if (classInfo && classInfo.definition && classInfo.definition.Properties) {
                Object.assign(properties, classInfo.definition.Properties);
            }
        }
        
        return properties;
    }
    
    /**
     * Validate an instance against its class definition
     * @param {Object} instance - The instance to validate
     * @param {string} className - The expected class name
     * @returns {string[]|null} Array of error messages or null if valid
     */
    validateInstance(instance, className) {
        const properties = this.getProperties(className);
        const errors = [];
        
        // Check required properties
        for (const [name, prop] of Object.entries(properties)) {
            if (prop.Required && !(name in instance)) {
                errors.push(`Missing required property: ${name}`);
            }
            
            // Type checking would go here
        }
        
        return errors.length === 0 ? null : errors;
    }
    
    /**
     * Generate a class based on its definition
     * @param {string} className - The name of the class to generate
     * @param {Function} baseClass - The base class constructor
     * @returns {Function} The generated class constructor
     */
    generateClass(className, baseClass) {
        const definition = this.getDefinition(className);
        if (!definition) {
            throw new Error(`No definition found for class: ${className}`);
        }
        
        // Get the base class constructor
        const baseClassName = definition.Extends || 'AbstractModelObject';
        let BaseConstructor;
        
        if (baseClassName === 'AbstractModelObject') {
            BaseConstructor = baseClass;
        } else {
            // Ensure the base class is registered
            if (!this.isClassRegistered(baseClassName)) {
                this.generateClass(baseClassName, baseClass);
            }
            BaseConstructor = this.getClass(baseClassName);
        }
        
        // Create the class with proper inheritance
        const GeneratedClass = class extends BaseConstructor {
            static className = className;
            static modelDefinition = definition;
            
            constructor(data = {}) {
                super(data);
            }
            
            // Add any custom methods or overrides here
        };
        
        // Set the class name for debugging
        Object.defineProperty(GeneratedClass, 'name', {
            value: className,
            writable: false,
            enumerable: false,
            configurable: true
        });
        
        // Register the class with both constructor and definition
        this.registerClassDefinition(className, definition, GeneratedClass);
        
        return GeneratedClass;
    }
    
    /**
     * Get all registered class names
     * @returns {string[]} Array of registered class names
     */
    getAllRegisteredClassNames() {
        return Array.from(this._classRegistry.keys());
    }
    
    /**
     * Get registration status for a class
     * @param {string} className - The name of the class to check
     * @returns {Object} Object with hasConstructor and hasDefinition properties
     */
    getRegistrationStatus(className) {
        const classInfo = this._classRegistry.get(className);
        if (!classInfo) {
            return { registered: false, hasConstructor: false, hasDefinition: false };
        }
        
        return {
            registered: true,
            hasConstructor: classInfo.constructor !== undefined,
            hasDefinition: classInfo.definition !== undefined
        };
    }
    
    /**
     * Ensure a class has both constructor and definition registered
     * @param {string} className - The name of the class to check
     * @returns {boolean} True if the class has both constructor and definition, false otherwise
     */
    ensureCompleteRegistration(className) {
        const status = this.getRegistrationStatus(className);
        return status.hasConstructor && status.hasDefinition;
    }
}

export const modelClassDefinitionManager = new ModelClassDefinitionManager();