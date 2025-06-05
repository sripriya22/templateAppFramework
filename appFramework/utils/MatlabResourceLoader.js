/**
 * Utility for handling MATLAB-specific resource loading concerns
 */
class MatlabResourceLoader {
  /**
   * Extracts MATLAB static path components from current URL
   * @returns {string|null} The MATLAB static path prefix or null if not in MATLAB
   */
  static getMatlabStaticPath() {
    const url = new URL(window.location.href);
    const pathParts = url.pathname.split('/');
    const staticIndex = pathParts.indexOf('static');
    
    if (staticIndex !== -1 && pathParts.length > staticIndex + 2) {
      const idComponent = pathParts[staticIndex + 1];
      const guidComponent = pathParts[staticIndex + 2];
      
      return `/static/${idComponent}/${guidComponent}`;
    }
    
    return null;
  }
  
  /**
   * Determines if running in MATLAB environment
   * @returns {boolean} True if in MATLAB environment
   */
  static isMatlabEnvironment() {
    return window.location.href.includes('/static/');
  }
  
  /**
   * Builds the correct resource path based on environment
   * @param {string} appName - Name of the app (e.g., 'gPKPDSimConfig')
   * @param {string} relativePath - Path relative to app root (e.g., 'data-model/Model.json')
   * @returns {string} Complete path to resource
   */
  static buildResourcePath(appName, relativePath) {
    const matlabPath = this.getMatlabStaticPath();
    
    if (this.isMatlabEnvironment() && matlabPath) {
      return `${matlabPath}/apps/${appName}/${relativePath}`;
    }
    
    return `apps/${appName}/${relativePath}`;  
  }
}

// Export the class for module usage
export default MatlabResourceLoader;
