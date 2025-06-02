/**
 * Utility functions for loading component configurations
 */

/**
 * Load a component configuration file
 * @param {string} componentName - The name of the component (e.g., "ModelPanel")
 * @param {string} [appPath] - Optional app path override
 * @returns {Promise<Object|null>} The loaded configuration or null if not found
 */
export async function loadComponentConfig(componentName, appPath = null) {
  try {
    // Determine the app path
    const path = appPath || _getAppPath();
    
    // Build the config file path
    const configPath = `${path}/view/config/${componentName}Config.json`;
    
    // Fetch the configuration
    const response = await fetch(configPath);
    if (!response.ok) {
      console.warn(`Configuration file not found: ${configPath}`);
      return null;
    }
    
    // Parse and return the configuration
    return await response.json();
  } catch (error) {
    console.warn(`Error loading configuration for ${componentName}:`, error);
    return null;
  }
}

/**
 * Get the current app path
 * @private
 * @returns {string} The app path
 */
function _getAppPath() {
  // Get the current script path
  const scripts = document.getElementsByTagName('script');
  const currentScript = scripts[scripts.length - 1].src;
  
  // Extract the app path from the script URL
  const urlParts = currentScript.split('/');
  const appIndex = urlParts.indexOf('apps');
  
  if (appIndex !== -1 && appIndex < urlParts.length - 1) {
    // Return the path up to the app name
    return urlParts.slice(0, appIndex + 2).join('/');
  }
  
  // Fallback: try to determine from window.location
  const locationParts = window.location.pathname.split('/');
  const locationAppIndex = locationParts.indexOf('apps');
  
  if (locationAppIndex !== -1 && locationAppIndex < locationParts.length - 1) {
    return locationParts.slice(0, locationAppIndex + 2).join('/');
  }
  
  console.warn('Could not determine app path, using current location');
  return '.';
}
