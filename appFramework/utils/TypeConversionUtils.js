/**
 * Utility functions for type conversions between JavaScript and MATLAB
 * Centralizes conversion logic to avoid duplication
 */

/**
 * Convert JavaScript Infinity string representations to numeric Infinity values
 * Handles string representations from MATLAB: "Infinity", "+Infinity", "-Infinity"
 * 
 * @param {*} value - The value to convert (can be string, number, or other type)
 * @returns {*} The converted value (numeric Infinity if applicable, otherwise unchanged or parsed)
 */
export function convertInfinityStringsToNumbers(value) {
    if (typeof value === 'string') {
        if (value === 'Infinity' || value === '+Infinity') {
            return Infinity;
        } else if (value === '-Infinity') {
            return -Infinity;
        }
        // For other strings, try to parse as number
        const parsed = Number(value);
        return isNaN(parsed) ? value : parsed;
    }
    return value;
}

/**
 * Convert numeric Infinity values to string representations for display
 * Converts Infinity to 'inf' and -Infinity to '-inf' for MATLAB-style display
 * 
 * @param {*} value - The value to convert
 * @returns {*} The converted value ('inf'/'-inf' if Infinity, otherwise unchanged)
 */
export function formatInfinityForDisplay(value) {
    if (value === Infinity) {
        return 'inf';
    } else if (value === -Infinity) {
        return '-inf';
    }
    return value;
}

/**
 * Parse user input strings to handle inf/-inf notation
 * Converts 'inf', '-inf', 'infinity', '-infinity' (case-insensitive) to numeric Infinity
 * 
 * @param {*} value - The value to parse (typically a string from user input)
 * @returns {*} The parsed value (numeric Infinity if applicable, otherwise parseFloat result)
 */
export function parseInfinityInput(value) {
    if (typeof value === 'string') {
        const lower = value.toLowerCase().trim();
        if (lower === 'inf' || lower === 'infinity') {
            return Infinity;
        } else if (lower === '-inf' || lower === '-infinity') {
            return -Infinity;
        }
    }
    return parseFloat(value);
}

/**
 * Convert a numeric property value, handling Infinity strings from MATLAB
 * This is the main function to use when setting numeric properties from server data
 * 
 * @param {*} value - The value to convert
 * @returns {number} The numeric value with Infinity properly converted
 */
export function convertNumericProperty(value) {
    if (typeof value === 'string') {
        return convertInfinityStringsToNumbers(value);
    } else if (typeof value === 'number') {
        return value;
    }
    return Number(value);
}
