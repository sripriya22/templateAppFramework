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
const minimatch = require('minimatch');

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
  packageName: `${appName}-dist`,
  appName: appName,
  paths: {
    appDir: `apps/${appName}`,
    appFramework: 'appFramework',
    serverFramework: 'serverFramework'
  }
};

// File exclusion patterns (relative to source root)
const EXCLUDE_PATTERNS = [
  // Directories
  '**/test/**',
  '**/__tests__/**',
  '**/spec/**',
  '**/node_modules/**',
  '**/coverage/**',
  '**/.*', // Hidden files/directories
  // Files
  '**/*.test.js',
  '**/*.spec.js',
  '**/*.map',
  '**/JSStore*',
  '**/jsstore*',
  '**/package-lock.json',
  '**/yarn.lock',
  '**/tsconfig*.json',
  '**/webpack*.js',
  '**/babel*.js',
  '**/jest*.js',
  '**/karma*.js',
  // Development files
  '**/*.md',
  '**/.gitignore',
  '**/.eslintrc*',
  '**/.prettierrc*',
  '**/README*',
  '**/CONTRIBUTING*'
];

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
  try {
    // Ensure dist root exists
    await fs.ensureDir(config.distRoot);
    
    // Set up path structure
    const packageDir = path.join(config.distRoot, config.packageName);
    // Place app-specific folder inside an apps directory
    const appsDir = path.join(packageDir, 'apps');
    const appDir = path.join(appsDir, config.appName);

    console.log(`Building distribution for ${config.appName}`);
    console.log(`Output directory: ${packageDir}`);

    // Clean up target directory if it exists
    if (await fs.pathExists(packageDir)) {
      await fs.remove(packageDir);
    }

    // Create necessary directories
    await fs.ensureDir(appsDir);
    await fs.ensureDir(path.join(packageDir, 'appFramework'));
    await fs.ensureDir(path.join(packageDir, 'serverFramework'));

    // 1. Process app-specific files
    console.log(`\nProcessing app-specific files from ${config.paths.appDir}...`);
    await processDirectory(
      path.join(config.sourceRoot, config.paths.appDir),
      appDir
    );

    // 2. Process app framework files
    console.log(`\nProcessing appFramework files...`);
    await processDirectory(
      path.join(config.sourceRoot, config.paths.appFramework),
      path.join(packageDir, config.paths.appFramework)
    );

    // 3. Process server framework files
    console.log(`\nProcessing serverFramework files...`);
    await processDirectory(
      path.join(config.sourceRoot, config.paths.serverFramework),
      path.join(packageDir, config.paths.serverFramework)
    );

    // 4. Check for MATLAB dependencies config
    const matlabConfigPath = path.join(
      config.sourceRoot,
      config.paths.appDir,
      'build-matlab-config.json'
    );
    console.log(`\nChecking for MATLAB dependencies config at ${matlabConfigPath}...`);

    if (await fs.pathExists(matlabConfigPath)) {
      const matlabConfig = require(matlabConfigPath);
      if (matlabConfig.matlabDependencies && Array.isArray(matlabConfig.matlabDependencies)) {
        console.log('Found MATLAB dependencies config. Processing dependencies...');
        await processMatlabDependenciesArray(matlabConfig.matlabDependencies, packageDir);
      } else if (matlabConfig.dependencies) {
        // Legacy support for old format
        await processMatlabDependencies(matlabConfig.dependencies, packageDir);
      } else {
        console.log('No MATLAB dependencies found in config file.');
      }
    }

    // 5. Create destination directory for MATLAB code
    const matlabDir = path.join(appDir, 'matlab');
    await fs.ensureDir(matlabDir);

    // 6. Copy any documentation
    const docsDir = path.join(config.sourceRoot, 'documentation');
    const docsDest = path.join(packageDir, 'documentation');
    if (await fs.pathExists(docsDir)) {
      await fs.copy(docsDir, docsDest);
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
    
    // 10. Post-build cleanup to remove unwanted directories (test, coverage, etc.)
    console.log('\nRunning post-build cleanup to remove test and development files...');
    await cleanupDistribution(packageDir);

    console.log(`\nMATLAB package build complete! The package is ready at: ${packageDir}`);
    console.log('You can now use MATLAB\'s mlappinstall tool to create the final MATLAB App package.');
    
  } catch (err) {
    console.error('Build failed:', err);
    process.exit(1);
  }
}

/**
 * Check if a file should be excluded from the build
 * @param {string} filePath - Absolute file path to check
 * @returns {boolean} True if the file should be excluded
 */
function shouldExclude(filePath) {
  const relativePath = path.relative(config.sourceRoot, filePath);
  return EXCLUDE_PATTERNS.some(pattern => 
    minimatch(relativePath, pattern, { dot: true })
  );
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
      
      // Skip excluded files/directories
      if (shouldExclude(sourcePath)) {
        console.log(`Skipping excluded: ${path.relative(config.sourceRoot, sourcePath)}`);
        continue;
      }

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
 * Find and remove directories from the distribution that match cleanup patterns
 * @param {string} distDir - Distribution directory to clean
 */
async function cleanupDistribution(distDir) {
  // Define patterns for directories to remove
  const CLEANUP_PATTERNS = [
    '**/test',
    '**/tests',
    '**/__tests__',
    '**/coverage',
    '**/node_modules',
    '**/.git'
  ];

  const dirsToRemove = [];
  
  // Find directories matching cleanup patterns
  async function findDirsToRemove(dir) {
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      
      for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        
        const fullPath = path.join(dir, entry.name);
        const relativePath = path.relative(distDir, fullPath);
        
        // Check if this directory matches any pattern
        const shouldRemove = CLEANUP_PATTERNS.some(pattern => 
          minimatch(relativePath, pattern, { dot: true }) || 
          minimatch(entry.name, pattern.replace(/\*\*\//g, ''))
        );
        
        if (shouldRemove) {
          dirsToRemove.push(fullPath);
          // Skip further traversal of this directory
          continue;
        }
        
        // Recursively check subdirectories
        await findDirsToRemove(fullPath);
      }
    } catch (err) {
      console.error(`Error scanning directory ${dir}:`, err);
    }
  }
  
  // Start the directory scan
  await findDirsToRemove(distDir);
  
  // Sort directories by depth (deepest first) to avoid dependency issues
  dirsToRemove.sort((a, b) => b.split(path.sep).length - a.split(path.sep).length);
  
  if (dirsToRemove.length === 0) {
    console.log('No directories to clean up.');
    return;
  }
  
  // Remove directories
  for (const dir of dirsToRemove) {
    try {
      await fs.remove(dir);
      console.log(`✓ Removed: ${path.relative(distDir, dir)}`);
    } catch (err) {
      console.error(`Failed to remove ${dir}:`, err);
    }
  }
  
  console.log(`Cleanup complete: Removed ${dirsToRemove.length} directories`);
}

/**
 * Process MATLAB dependencies by copying from source to target directory
 * @param {object} dependencies - Dependencies configuration
 * @param {string} packageDir - Package directory
 */
async function processMatlabDependencies(dependencies, packageDir) {
  for (const depName in dependencies) {
    const depConfig = dependencies[depName];
    const srcPath = path.resolve(config.sourceRoot, depConfig.source);
    const destPath = path.join(packageDir, config.appName, 'matlab', depConfig.target);
    
    console.log(`\nCopying ${depName} from ${srcPath} to ${destPath}...`);
    
    if (!await fs.pathExists(srcPath)) {
      console.error(`⚠ Warning: Source path not found: ${srcPath}`);
      continue;
    }
    
    await fs.ensureDir(path.dirname(destPath));
    await fs.copy(srcPath, destPath);
    console.log(`✓ Copied ${depName}`);
  }
}

/**
 * Process MATLAB dependencies from array format
 * @param {Array} dependencies - Array of dependency objects
 * @param {string} packageDir - Package directory
 */
async function processMatlabDependenciesArray(dependencies, packageDir) {
  for (const dep of dependencies) {
    const srcPath = dep.sourcePath;
    // Adjust the path to place dependencies in apps/appName/matlab/ directory structure
    const destPath = path.join(packageDir, 'apps', config.appName, dep.targetPath);
    const description = dep.description || 'Dependency';
    
    console.log(`\nCopying ${description} from ${srcPath} to ${destPath}...`);
    
    if (!await fs.pathExists(srcPath)) {
      console.error(`⚠ Warning: Source path not found: ${srcPath}`);
      continue;
    }
    
    try {
      await fs.ensureDir(path.dirname(destPath));
      await fs.copy(srcPath, destPath);
      console.log(`✓ Copied ${description}`);
    } catch (err) {
      console.error(`Error copying ${description}: ${err.message}`);
    }
  }
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

/**
 * Log file processing result
 * @param {string} filePath - File path that was processed
 * @param {string} action - Action that was performed
 */
function logFileProcess(filePath, action) {
  const relPath = path.relative(config.sourceRoot, filePath);
  console.log(`✓ ${action}: ${relPath}`);
}

// Execute the main function
buildMatlabPackage().catch(err => {
  console.error('Unhandled error:', err);
  process.exit(1);
});
