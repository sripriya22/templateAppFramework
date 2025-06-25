/**
 * ValidationManager.js
 * Manages validation rules and constraints for model properties.
 */

export default class ValidationManager {
  constructor(app) {
    this._app = app;
    this.propertyValidations = new Map(); // "ClassName.propertyName" -> validation rules
    this.classConstraints = new Map();    // "ClassName" -> array of constraints
  }

  /**
   * Load validation rules and constraints from a model definition
   * @param {Object} modelDef - The model class definition with validation rules
   */
  loadModelDefinition(modelDef) {
    const className = modelDef.ClassName;
    
    // Load property-level validations
    if (modelDef.Properties) {
      Object.entries(modelDef.Properties).forEach(([propName, propDef]) => {
        if (propDef.Validation) {
          this.propertyValidations.set(`${className}.${propName}`, propDef.Validation);
        }
      });
    }
    
    // Load class-level constraints
    if (modelDef.Constraints) {
      this.classConstraints.set(className, modelDef.Constraints);
    }
  }

  /**
   * Get all constraints that could be affected by a property change
   * @param {string} className - The class name
   * @param {string} propertyPath - The property path being changed
   * @returns {Array} - Array of relevant constraints and validations
   */
  getConstraintsForProperty(className, propertyPath) {
    const result = [];
    const propertyName = propertyPath.split('.').pop(); // Handle nested properties
    
    // Get property-specific validation
    const propKey = `${className}.${propertyName}`;
    const validation = this.propertyValidations.get(propKey);
    
    if (validation) {
      result.push({
        type: 'property',
        validation: validation
      });
    }
    
    // Get class-level constraints that involve this property
    const constraints = this.classConstraints.get(className);
    if (constraints) {
      constraints.forEach(constraint => {
        if (constraint.properties && constraint.properties.includes(propertyName)) {
          result.push({
            type: 'constraint',
            constraint: constraint
          });
        }
      });
    }
    
    // TODO: Get constraints from parent classes
    
    return result;
  }

  /**
   * Validate a property value against its validation rules
   * @param {*} value - The value to validate
   * @param {Object} validation - The validation rules
   * @returns {string|null} - Error message or null if valid
   */
  validatePropertyValue(value, validation) {
    // Handle inclusive minimum (>=)
    if (validation.minimum !== undefined && value < validation.minimum) {
      return validation.errorMessage || `Value must be at least ${validation.minimum}`;
    }
    
    // Handle exclusive minimum (>)
    if (validation.exclusiveMinimum !== undefined && value <= validation.exclusiveMinimum) {
      return validation.errorMessage || `Value must be greater than ${validation.exclusiveMinimum}`;
    }
    
    // Handle inclusive maximum (<=)
    if (validation.maximum !== undefined && value > validation.maximum) {
      return validation.errorMessage || `Value must be at most ${validation.maximum}`;
    }
    
    // Handle exclusive maximum (<)
    if (validation.exclusiveMaximum !== undefined && value >= validation.exclusiveMaximum) {
      return validation.errorMessage || `Value must be less than ${validation.exclusiveMaximum}`;
    }
    
    if (validation.type === 'number' && isNaN(Number(value))) {
      return validation.errorMessage || 'Value must be a number';
    }
    
    if (validation.enum !== undefined && !validation.enum.includes(value)) {
      return validation.errorMessage || `Value must be one of: ${validation.enum.join(', ')}`;
    }
    
    if (validation.pattern !== undefined) {
      const regex = new RegExp(validation.pattern);
      if (!regex.test(value)) {
        return validation.errorMessage || 'Value does not match the required pattern';
      }
    }
    
    return null; // No validation error
  }

  /**
   * Evaluate an object against a constraint
   * @param {Object} obj - The object to validate
   * @param {Object} constraint - The constraint to check
   * @returns {string|null} - Error message or null if valid
   */
  evaluateConstraint(obj, constraint) {
    const { id, condition, errorMessage, properties } = constraint;
    
    try {
      // Create a function to evaluate the condition
      // This approach allows for flexible expressions
      const props = properties || [];
      const args = props.map(prop => obj[prop]);
      const conditionFn = new Function(...props, `return ${condition}`);
      
      const isValid = conditionFn(...args);
      
      if (!isValid) {
        return errorMessage || `Constraint '${id}' violated`;
      }
    } catch (error) {
      console.error('Error evaluating constraint:', error);
      return `Error evaluating constraint '${id}'`;
    }
    
    return null; // No constraint violation
  }
}
