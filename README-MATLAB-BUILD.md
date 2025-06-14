# MATLAB Package Build Documentation

## Overview

The Template App Framework includes a streamlined build process for creating MATLAB-compatible packages. This process handles:

- JavaScript and CSS minification
- Directory structure preservation
- Resource path maintenance
- Integration with MATLAB's mlappinstall packaging system

## Usage

Build and package an app with a single command:

```bash
npm run build:matlab <appName>
```

The app name is required and must be provided as a command-line argument.

Example:
```bash
# Using npm script
npm run build:matlab -- gPKPDSimConfigTool

# Direct node execution
node build-matlab-package.js myAppName
```

**Note:** When using npm run, you need to add `--` before the app name to pass it as an argument.

## Output

The build process creates a package directory named `[appName]-matlab-package` containing:

- Minified JavaScript and CSS files
- All required resources and MATLAB code
- An organized directory structure ready for MATLAB packaging
- Packaging instructions in PACKAGING.md

## MATLAB Integration

The package maintains all necessary paths and structures for MATLAB integration:
- Dynamic resource path handling via MatlabResourceLoader
- Support for MATLAB's static file serving pattern
- Preservation of MATLAB server code structure

## Creating the MATLAB App Package

After running the build script:

1. Open MATLAB
2. Navigate to the `[appName]-matlab-package` directory
3. Run the MATLAB command:
   ```matlab
   matlab.apputil.package('[appName]-matlab-package')
   ```
4. Follow the prompts to complete the MATLAB App installation

## Configuration Options

The build script (build-matlab-package.js) provides these configuration options:

- **JavaScript Minification**: Removes dead code but preserves class and function names for debugging
- **Directory Structure**: Maintains the original directory hierarchy for compatibility
- **MATLAB Code Integration**: Includes both framework and app-specific MATLAB code

## Development Workflow

1. Develop your app using the unbundled source files
2. When ready for deployment, run `npm run build:matlab [appName]`
3. Use the output package for MATLAB App distribution
