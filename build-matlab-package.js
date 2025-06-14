/**
 * build-matlab-package.js
 * 
 * This script builds and packages a templateAppFramework application for MATLAB.
 * It minifies JS/CSS, copies necessary files, and creates a package directory
 * ready for MATLAB's mlappinstall tool.
 * 
 * Usage:
 * node build-matlab-package.js [appName]
 * 
 * Example:
 * node build-matlab-package.js gPKPDSimConfigTool
 */

const fs = require('fs-extra');
const path = require('path');
const terser = require('terser');
const CleanCSS = require('clean-css');

// Get app name from command-line arguments
const appName = process.argv[2];

// Ensure app name is provided
if (!appName) {
  console.error('Error: App name must be provided as a command-line argument');
  console.error('Usage: node build-matlab-package.js <appName>');
  console.error('Example: node build-matlab-package.js gPKPDSimConfigTool');
  process.exit(1);
}

// Configuration
const config = {
  sourceRoot: __dirname,
  distRoot: path.join(__dirname, 'dist'),
  packageName: `${appName}-dist`,  // Changed from -matlab-package to -dist
  appName: appName,
  paths: {
    appDir: `apps/${appName}`,
    appFramework: 'appFramework',
    serverFramework: 'serverFramework'
  }
};

// File processing options
const terserOptions = {
  compress: {
    dead_code: true,
    drop_console: false,
    drop_debugger: true,
    keep_classnames: true,
    keep_fnames: true
  },
  mangle: false // Keep variable names readable for debugging
};

/**
 * Main function to build and package the app
 */
async function buildMatlabPackage() {
  // Ensure dist root exists
  await fs.ensureDir(config.distRoot);
  
  // Set up path structure
  const packageDir = path.join(config.distRoot, config.packageName);
  // Place app-specific folder inside an apps directory
  const appsDir = path.join(packageDir, 'apps');
  const appDir = path.join(appsDir, config.appName);

  console.log(`Building distribution for ${config.appName}`);
  console.log(`Output directory: ${packageDir}`);
  
  try {
    // Clean output directory
    await fs.emptyDir(packageDir);
    // Ensure apps directory exists
    await fs.ensureDir(appsDir);
    await fs.ensureDir(appDir);
    
    // 1. Process app-specific files
    const appSourceDir = path.join(config.sourceRoot, config.paths.appDir);
    console.log(`\nProcessing app-specific files from ${config.paths.appDir}...`);
    await processDirectory(appSourceDir, appDir);
    
    // 2. Process appFramework files
    const appFrameworkSrc = path.join(config.sourceRoot, config.paths.appFramework);
    const appFrameworkDest = path.join(packageDir, config.paths.appFramework);
    console.log(`\nProcessing appFramework files...`);
    await processDirectory(appFrameworkSrc, appFrameworkDest);
    
    // 3. Process serverFramework files
    const serverFrameworkSrc = path.join(config.sourceRoot, config.paths.serverFramework);
    const serverFrameworkDest = path.join(packageDir, config.paths.serverFramework);
    console.log(`\nProcessing serverFramework files...`);
    await processDirectory(serverFrameworkSrc, serverFrameworkDest);
    
    // 4. Process MATLAB dependencies from config file
    const configPath = path.join(config.sourceRoot, config.paths.appDir, 'build-matlab-config.json');
    console.log(`\nChecking for MATLAB dependencies config at ${configPath}...`);
    
    if (await fs.pathExists(configPath)) {
      try {
        const appConfig = JSON.parse(await fs.readFile(configPath, 'utf8'));
        
        if (appConfig.matlabDependencies && Array.isArray(appConfig.matlabDependencies)) {
          for (const dep of appConfig.matlabDependencies) {
            if (dep.sourcePath && dep.targetPath) {
              const sourceDir = dep.sourcePath;
              const targetDir = path.join(appDir, dep.targetPath);
              
              console.log(`\nCopying ${dep.description || 'dependency'} from ${sourceDir} to ${config.appName}/${dep.targetPath}...`);
              
              if (!await fs.pathExists(sourceDir)) {
                console.warn(`⚠️ Warning: Source directory not found: ${sourceDir}`);
                continue;
              }
              
              await fs.ensureDir(targetDir);
              await processDirectory(sourceDir, targetDir);
            }
          }
        }
      } catch (error) {
        console.error(`Error processing MATLAB dependencies config: ${error.message}`);
        console.error('Using default paths as fallback...');
        
        // Fallback to hardcoded path for backward compatibility
        const pkpdSourceDir = '/Users/penarasi/CascadeProjects/gPKPDSim/+PKPD';
        const pkpdDestDir = path.join(appDir, 'matlab/gPKPDSim/+PKPD');
        console.log(`\nFalling back to copying gPKPDSim/+PKPD to ${config.appName}/matlab/gPKPDSim/+PKPD...`);
        
        if (await fs.pathExists(pkpdSourceDir)) {
          await fs.ensureDir(pkpdDestDir);
          await processDirectory(pkpdSourceDir, pkpdDestDir);
        } else {
          console.warn(`⚠️ Warning: Default PKPD source directory not found: ${pkpdSourceDir}`);
        }
      }
    } else {
      console.log('No MATLAB dependencies config found. Skipping dependency copying.');
    }
    
    // 5. Copy README.md if it exists
    const readmeSrc = path.join(config.sourceRoot, 'README.md');
    const readmeDest = path.join(packageDir, 'README.md');
    if (fs.existsSync(readmeSrc)) {
      await fs.copy(readmeSrc, readmeDest);
      console.log('✓ Copied README.md');
    }
    
    // 6. Copy documentation folder if it exists
    const docsSrc = path.join(config.sourceRoot, 'documentation');
    const docsDest = path.join(packageDir, 'documentation');
    if (fs.existsSync(docsSrc)) {
      await fs.copy(docsSrc, docsDest);
      console.log('✓ Copied documentation folder');
    }

    // 7. Move HTML file from app directory to package directory
    const htmlFiles = await fs.readdir(appDir);
    for (const file of htmlFiles) {
      if (file.endsWith('.html')) {
        const htmlSrc = path.join(appDir, file);
        const htmlDest = path.join(packageDir, file);
        await fs.move(htmlSrc, htmlDest);
        console.log(`✓ Moved ${file} to package root`);
      }
    }

    // 8. Create a MATLAB packaging instructions file
    await createPackagingInstructions(packageDir);

    // 9. Check for MLAPP files
    const mlappFiles = await findMlappFiles(path.join(packageDir, config.appName, 'matlab'));
    if (mlappFiles.length === 0) {
      console.log('\n⚠ Note: No .mlapp file was found in the package.');
      console.log('You may need to create a MATLAB App Designer app for launching this application.');
      console.log(`Consider creating one at: dist/matlab/${appName}.mlapp`);
    } else {
      console.log('\n✓ Found MLAPP files:');
      mlappFiles.forEach(file => console.log(`  - ${file}`));
    }

    console.log(`\nMATLAB package build complete! The package is ready at: ${packageDir}`);
    console.log('You can now use MATLAB\'s mlappinstall tool to create the final MATLAB App package.');
    
  } catch (err) {
    console.error('Build failed:', err);
    process.exit(1);
  }
}

/**
 * Process a directory recursively, minifying JS/CSS files and copying others
 * @param {string} sourceDir - Source directory
 * @param {string} targetDir - Target directory
 */
async function processDirectory(sourceDir, targetDir) {
  try {
    const entries = await fs.readdir(sourceDir, { withFileTypes: true });
    
    for (const entry of entries) {
      const sourcePath = path.join(sourceDir, entry.name);
      const targetPath = path.join(targetDir, entry.name);
      
      if (entry.isDirectory()) {
        // Create target directory and process its contents
        await fs.ensureDir(targetPath);
        await processDirectory(sourcePath, targetPath);
      } else {
        // Process file based on extension
        await processFile(sourcePath, targetPath);
      }
    }
  } catch (error) {
    console.error(`Error processing directory ${sourceDir}:`, error);
    throw error;
  }
}

/**
 * Process a single file, minifying JS/CSS and copying others
 * @param {string} sourcePath - Source file path
 * @param {string} targetPath - Target file path
 */
async function processFile(sourcePath, targetPath) {
  try {
    const ext = path.extname(sourcePath).toLowerCase();
    
    switch (ext) {
      case '.js':
        await minifyJs(sourcePath, targetPath);
        break;
      case '.css':
        await minifyCss(sourcePath, targetPath);
        break;
      default:
        await fs.copy(sourcePath, targetPath);
        break;
    }
  } catch (error) {
    console.error(`Error processing file ${sourcePath}:`, error);
    throw error;
  }
}

/**
 * Minify a JavaScript file
 * @param {string} sourcePath - Source JS file path
 * @param {string} targetPath - Target JS file path
 */
async function minifyJs(sourcePath, targetPath) {
  try {
    const sourceCode = await fs.readFile(sourcePath, 'utf8');
    const result = await terser.minify(sourceCode, terserOptions);
    
    if (result.error) {
      throw new Error(`Terser error: ${result.error.message}`);
    }
    
    await fs.writeFile(targetPath, result.code);
    logFileProcess(sourcePath, 'minified JS');
  } catch (error) {
    console.error(`Error minifying JS file ${sourcePath}:`, error);
    // Fallback to copying the original file
    await fs.copy(sourcePath, targetPath);
    logFileProcess(sourcePath, 'copied (minification failed)');
  }
}

/**
 * Minify a CSS file
 * @param {string} sourcePath - Source CSS file path
 * @param {string} targetPath - Target CSS file path
 */
async function minifyCss(sourcePath, targetPath) {
  try {
    const sourceCode = await fs.readFile(sourcePath, 'utf8');
    const output = new CleanCSS({}).minify(sourceCode);
    
    if (output.errors.length > 0) {
      throw new Error(`CleanCSS errors: ${output.errors.join(', ')}`);
    }
    
    await fs.writeFile(targetPath, output.styles);
    logFileProcess(sourcePath, 'minified CSS');
  } catch (error) {
    console.error(`Error minifying CSS file ${sourcePath}:`, error);
    // Fallback to copying the original file
    await fs.copy(sourcePath, targetPath);
    logFileProcess(sourcePath, 'copied (minification failed)');
  }
}

/**
 * Log file processing with path relative to project root
 * @param {string} filePath - File path
 * @param {string} action - Action performed
 */
function logFileProcess(filePath, action) {
  const relativePath = path.relative(config.sourceRoot, filePath);
  console.log(`✓ ${action}: ${relativePath}`);
}

/**
 * Create a MATLAB packaging instructions file
 * @param {string} packageDir - Package directory
 */
async function createPackagingInstructions(packageDir) {
  const packagingInstructions = `
# ${config.appName} MATLAB Packaging Instructions

This directory contains all the necessary files to create a MATLAB App using the mlappinstall tool.

## Creating the MATLAB App

1. Open MATLAB
2. Navigate to this directory
3. Use the following command in the MATLAB Command Window:

   \`\`\`matlab
   matlab.apputil.package('${config.packageName}')
   \`\`\`

4. Follow the prompts to complete the app packaging

## Package Contents

- \`${config.appName}/\`: The web application with minified JS/CSS files
- \`appFramework/\`: JavaScript framework components
- \`serverFramework/\`: MATLAB server framework components
- \`documentation/\`: User guides and documentation (if available)
`;

  await fs.writeFile(path.join(packageDir, 'PACKAGING.md'), packagingInstructions);
  console.log('✓ Created PACKAGING.md with instructions');
}

/**
 * Find MLAPP files in the given directory and subdirectories
 * @param {string} dir - Directory to search
 * @returns {Promise<string[]>} - List of found .mlapp files
 */
async function findMlappFiles(dir) {
  const mlappFiles = [];
  
  if (!fs.existsSync(dir)) {
    return mlappFiles;
  }
  
  async function searchDir(currentDir) {
    const entries = await fs.readdir(currentDir, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);
      
      if (entry.isDirectory()) {
        const filesInSubDir = await searchDir(fullPath);
        mlappFiles.push(...filesInSubDir);
      } else if (entry.name.endsWith('.mlapp')) {
        mlappFiles.push(path.relative(dir, fullPath));
      }
    }
    
    return mlappFiles;
  }
  
  return searchDir(dir);
}

// Run the build
buildMatlabPackage().catch(err => {
  console.error('Unhandled error:', err);
  process.exit(1);
});
