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
  // First, check if we're loading from a root-level HTML file
  // by examining the main script tag that loads the app
  const scripts = document.getElementsByTagName('script');
  for (let i = 0; i < scripts.length; i++) {
    const scriptSrc = scripts[i].src;
    if (scriptSrc.includes('/apps/') && scriptSrc.includes('/App.js')) {
      // This is loading from root-level HTML
      const urlParts = scriptSrc.split('/');
      const appIndex = urlParts.indexOf('apps');
      if (appIndex !== -1 && appIndex + 1 < urlParts.length) {
        const appName = urlParts[appIndex + 1];
        return `./apps/${appName}`;
      }
    }
  }
  
  // If we couldn't find it in script tags, try the last script
  const currentScript = scripts[scripts.length - 1].src;
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
  
  // Final fallback for root-level HTML files: check if the HTML filename matches an app name
  const htmlFileName = window.location.pathname.split('/').pop();
  if (htmlFileName && htmlFileName.endsWith('.html')) {
    const potentialAppName = htmlFileName.replace('.html', '');
    // This is a heuristic - we assume the HTML file is named after the app
    return `./apps/${potentialAppName}`;
  }
  
  console.warn('Could not determine app path, using current location');
  return '.';
}
