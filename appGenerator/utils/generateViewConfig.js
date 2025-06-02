/**
 * Utility to generate view configuration files for a new app
 */
const fs = require('fs');
const path = require('path');

/**
 * Generate view configuration files for a new app
 * @param {string} appPath - The path to the new app
 * @param {string} appName - The name of the app
 */
function generateViewConfig(appPath, appName) {
  console.log(`Generating view configuration files for ${appName}...`);
  
  // Create the view/config directory
  const configDir = path.join(appPath, 'view', 'config');
  fs.mkdirSync(configDir, { recursive: true });
  
  // Copy the ModelPanelConfig.json template
  const templatePath = path.join(__dirname, '..', 'templates', 'view', 'config', 'ModelPanelConfig.json');
  const targetPath = path.join(configDir, 'ModelPanelConfig.json');
  
  if (fs.existsSync(templatePath)) {
    // Read the template file
    let configContent = fs.readFileSync(templatePath, 'utf8');
    
    // Customize the configuration for this app if needed
    // For example, update the title to include the app name
    configContent = configContent.replace(
      '"title": "Model Panel Configuration"',
      `"title": "${appName} Model Panel Configuration"`
    );
    
    // Write the customized configuration file
    fs.writeFileSync(targetPath, configContent);
    console.log(`Created ${targetPath}`);
  } else {
    console.warn(`Template file not found: ${templatePath}`);
  }
}

module.exports = generateViewConfig;
