/**
 * Utility class for working with model paths
 * Provides methods for creating, parsing, and resolving model paths
 */
export class ModelPathUtils {
  /**
   * Create a model path from components
   * @param {string} collectionName - The name of the collection (e.g., 'parameters')
   * @param {number} [index] - The index in the collection (for arrays)
   * @param {string} [property] - The property name
   * @returns {string} The model path
   */
  static createPath(collectionName, index, property) {
    let path = collectionName;
    
    if (index !== undefined && index !== null) {
      path += `.${index}`;
      
      if (property) {
        path += `.${property}`;
      }
    } else if (property) {
      path += `.${property}`;
    }
    
    return path;
  }
  
  /**
   * Parse a model path into components
   * @param {string} path - The model path to parse
   * @returns {Object} The parsed components { collectionName, index, property }
   */
  static parsePath(path) {
    if (!path) return {};
    
    const parts = path.split('.');
    
    if (parts.length === 1) {
      return { collectionName: parts[0] };
    }
    
    if (parts.length === 2) {
      if (/^\d+$/.test(parts[1])) {
        return { 
          collectionName: parts[0], 
          index: parseInt(parts[1], 10) 
        };
      } else {
        return { 
          collectionName: parts[0], 
          property: parts[1] 
        };
      }
    }
    
    if (parts.length >= 3) {
      return {
        collectionName: parts[0],
        index: /^\d+$/.test(parts[1]) ? parseInt(parts[1], 10) : null,
        property: parts[2]
      };
    }
    
    return {};
  }
  
  /**
   * Get a value from an object using a path
   * @param {Object} obj - The object to get the value from
   * @param {string} path - The path to the value
   * @returns {*} The value at the path, or undefined if not found
   */
  static getValueFromPath(obj, path) {
    if (!obj || !path) return undefined;
    
    // Handle array notation like Parameters[0].Value
    // Convert to dot notation: Parameters.0.Value
    const normalizedPath = path.replace(/\[(\d+)\]/g, '.$1');
    const parts = normalizedPath.split('.');
    
    let current = obj;
    for (const part of parts) {
      if (current === null || current === undefined) {
        return undefined;
      }
      
      if (/^\d+$/.test(part)) {
        const index = parseInt(part, 10);
        if (Array.isArray(current) && index < current.length) {
          current = current[index];
        } else {
          return undefined;
        }
      } else {
        if (current.hasOwnProperty(part)) {
          current = current[part];
        } else {
          return undefined;
        }
      }
    }
    return current;
  }
  
  /**
   * Set a value at a path in an object
   * @param {Object} obj - The object to set the value in
   * @param {string} path - The path to set the value at
   * @param {*} value - The value to set
   * @returns {boolean} True if the value was set successfully, false otherwise
   */
  static setValueAtPath(obj, path, value) {
    if (!obj || !path) return false;
    
    // Handle array notation like Parameters[0].Value
    // Convert to dot notation: Parameters.0.Value
    const normalizedPath = path.replace(/\[(\d+)\]/g, '.$1');
    
    const parts = normalizedPath.split('.');
    const lastPart = parts.pop();
    let current = obj;
    
    // Navigate to the parent object
    for (const part of parts) {
      if (current === null || current === undefined) {
        return false;
      }
      
      if (/^\d+$/.test(part)) {
        const index = parseInt(part, 10);
        if (Array.isArray(current) && index < current.length) {
          current = current[index];
        } else {
          return false;
        }
      } else {
        if (current.hasOwnProperty(part)) {
          current = current[part];
        } else {
          return false;
        }
      }
    }
    
    // Set the value on the parent object
    if (current !== null && current !== undefined) {
      // Handle numeric array index in the last part
      if (/^\d+$/.test(lastPart)) {
        const index = parseInt(lastPart, 10);
        if (Array.isArray(current) && index < current.length) {
          current[index] = value;
          return true;
        }
      } else {
        current[lastPart] = value;
        return true;
      }
    }
    
    return false;
  }
  
  /**
   * Get the UID of an object from a path
   * @param {Object} rootInstance - The root model instance
   * @param {string} path - The path to the object
   * @returns {number|null} The UID of the object or null if not found
   */
  static getUidFromPath(rootInstance, path) {
    if (!rootInstance || !path) return null;
    
    const { collectionName, index } = this.parsePath(path);
    
    if (collectionName && index !== undefined && index !== null) {
      if (rootInstance[collectionName] && 
          Array.isArray(rootInstance[collectionName]) && 
          rootInstance[collectionName][index]) {
        return rootInstance[collectionName][index]._uid || null;
      }
    }
    
    return null;
  }
}
