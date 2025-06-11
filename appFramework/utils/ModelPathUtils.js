/**
 * Utility class for working with standardized model object paths
 * Provides methods for creating, parsing, normalizing, and resolving object paths
 * Uses dot notation with bracket indexing (e.g., 'RootModel.Compartment[2].Species[5]')
 * All indices in JavaScript are 0-based, conversion to/from MATLAB's 1-based indexing is handled
 */
export class ModelPathUtils {
  /**
   * Create an object path using standardized dot notation with bracket indexing
   * @param {Array<string>} segments - The path segments (e.g. ['RootModel', 'Compartment', 'Species'])
   * @param {Array<number>} [indices] - The indices for indexed segments (0-based in JavaScript)
   * @returns {string} The standardized object path (e.g. 'RootModel.Compartment[0].Species')
   */
  static createObjectPath(segments, indices) {
    if (!segments || !segments.length) return 'RootModel';
    
    // Ensure path starts with RootModel
    const pathSegments = segments[0] === 'RootModel' ? [...segments] : ['RootModel', ...segments];
    
    // Build the path with bracket notation for indices
    let result = pathSegments[0];
    let indexCounter = 0;
    
    for (let i = 1; i < pathSegments.length; i++) {
      if (indices && indices.length > indexCounter && 
          pathSegments[i-1] !== 'RootModel' && // Don't apply index to RootModel
          indices[indexCounter] !== undefined && indices[indexCounter] !== null) {
        // Add index in bracket notation
        result += `[${indices[indexCounter]}]`;
        indexCounter++;
      }
      
      // Add the next segment
      result += `.${pathSegments[i]}`;
    }
    
    // Handle a trailing index if present
    if (indices && indices.length > indexCounter && 
        indices[indexCounter] !== undefined && indices[indexCounter] !== null) {
      result += `[${indices[indexCounter]}]`;
    }
    
    return result;
  }
  
  /**
   * Parse an object path in standardized format
   * @param {string} path - The object path to parse (e.g. 'RootModel.Compartment[2].Species[5]')
   * @returns {Object} The parsed components { segments: Array<string>, indices: Array<number> }
   */
  static parseObjectPath(path) {
    // Return default segments and indices for empty path
    if (!path) return { segments: ['RootModel'], indices: [] };
    
    // Convert to string and ensure path starts with RootModel
    let pathString = String(path);
    if (!pathString.startsWith('RootModel')) {
      pathString = `RootModel.${pathString}`;
    }
    
    const segments = [];
    const indices = [];
    
    // Handle segments with bracket notation indices
    // Regular expression to match segments with optional indices: 'SegmentName[index]'
    const segmentRegex = /([^.\[\]]+)(\[\d+\])?/g;
    let match;
    
    while ((match = segmentRegex.exec(pathString)) !== null) {
      const segmentName = match[1];
      const indexStr = match[2]; // Will be undefined if no brackets
      
      segments.push(segmentName);
      
      if (indexStr) {
        // Extract number from brackets and convert to number
        const index = parseInt(indexStr.substring(1, indexStr.length - 1), 10);
        indices.push(index);
      }
    }
    
    return { segments, indices };
  }
  
  // normalizeObjectPath has been removed - path standardization is now done directly in parseObjectPath

  /**
   * Convert JavaScript 0-based indices to MATLAB 1-based indices in an object path
   * @param {string} path - The object path with JS 0-based indices
   * @returns {string} The path with MATLAB 1-based indices
   */
  static jsPathToMatlabPath(path) {
    if (!path) return path;
    
    // Parse the object path to get segments and indices
    const { segments, indices } = this.parseObjectPath(path);
    
    // Convert to 1-based indexing for MATLAB
    const matlabIndices = indices.map(idx => idx + 1);
    
    // Recreate the path with converted indices
    return this.createObjectPath(segments, matlabIndices);
  }
  
  /**
   * Convert MATLAB 1-based indices to JavaScript 0-based indices in an object path
   * @param {string} path - The object path with MATLAB 1-based indices
   * @returns {string} The path with JS 0-based indices
   */
  static matlabPathToJsPath(path) {
    if (!path) return path;
    
    // Parse the object path to get segments and indices
    const { segments, indices } = this.parseObjectPath(path);
    
    // Convert to 0-based indexing for JavaScript
    const jsIndices = indices.map(idx => Math.max(0, idx - 1));
    
    // Recreate the path with converted indices
    return this.createObjectPath(segments, jsIndices);
  }
  
  /**
   * Get a value from an object using a standardized object path
   * @param {Object} obj - The object to get the value from
   * @param {string} path - The path to the value
   * @returns {*} The value at the path, or undefined if not found
   */
  static getValueFromObjectPath(obj, path) {
    if (!obj || !path) return undefined;
    
    // Normalize and parse the path
    const { segments, indices } = this.parseObjectPath(path);
    
    // Get value from the hierarchical object using segments and indices
    let current = obj;
    let indexCounter = 0;
    
    // Skip 'RootModel' at the beginning
    for (let i = (segments[0] === 'RootModel' ? 1 : 0); i < segments.length; i++) {
      if (current === null || current === undefined) {
        return undefined;
      }
      
      const segment = segments[i];
      current = current[segment];
      
      // Check if we need to access an array element
      if (indices.length > indexCounter && current !== null && current !== undefined) {
        if (Array.isArray(current)) {
          const index = indices[indexCounter];
          indexCounter++;
          
          if (index < current.length) {
            current = current[index];
          } else {
            return undefined; // Index out of bounds
          }
        }
      }
    }
    
    return current;
  }
  
  /**
   * Set a value at a standardized object path in an object
   * @param {Object} obj - The object to set the value in
   * @param {string} path - The standardized path to set the value at
   * @param {*} value - The value to set
   * @returns {boolean} True if the value was set successfully, false otherwise
   */
  static setValueAtObjectPath(obj, path, value) {
    if (!obj || !path) return false;
    
    // Normalize and parse the path
    const { segments, indices } = this.parseObjectPath(path);
    
    // Get the parent object where we need to set the value
    let current = obj;
    let indexCounter = 0;
    let targetObj = null;
    let targetProperty = null;
    
    // Skip 'RootModel' at the beginning
    for (let i = (segments[0] === 'RootModel' ? 1 : 0); i < segments.length - 1; i++) {
      if (current === null || current === undefined) {
        return false;
      }
      
      const segment = segments[i];
      current = current[segment];
      
      // Navigate through array if needed
      if (indices.length > indexCounter && current !== null && current !== undefined) {
        if (Array.isArray(current)) {
          const index = indices[indexCounter];
          indexCounter++;
          
          if (index < current.length) {
            current = current[index];
          } else {
            return false; // Index out of bounds
          }
        }
      }
    }
    
    // At this point, current is the parent object and segments[segments.length - 1] is the property
    if (current === null || current === undefined) {
      return false;
    }
    
    targetObj = current;
    targetProperty = segments[segments.length - 1];
    
    // Check if we need to set the value in an array
    if (indices.length > indexCounter && Array.isArray(targetObj[targetProperty])) {
      const index = indices[indexCounter];
      if (index < targetObj[targetProperty].length) {
        targetObj[targetProperty][index] = value;
        return true;
      }
      return false; // Index out of bounds
    } else {
      // Set the value directly
      targetObj[targetProperty] = value;
      return true;
    }
  }
  
  /**
   * Get the UID of an object from a standardized object path
   * @param {Object} rootInstance - The root model instance
   * @param {string} path - The standardized path to the object
   * @returns {number|null} The UID of the object or null if not found
   */
  static getUidFromObjectPath(rootInstance, path) {
    if (!rootInstance || !path) return null;
    
    // Get the target object using our standardized path utilities
    const targetObj = this.getValueFromObjectPath(rootInstance, path);
    
    // If the object exists and has a UID property, return it
    if (targetObj && targetObj._uid !== undefined) {
      return targetObj._uid;
    }
    
    return null;
  }
}
