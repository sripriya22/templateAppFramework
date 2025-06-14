# MATLAB Build Configuration

## Overview

Each app in the framework can include a configuration file that specifies its external MATLAB dependencies. This allows the build script to automatically copy required MATLAB files into the distribution package.

## Configuration File

Create a file named `build-matlab-config.json` in your app's root directory:

```json
{
  "matlabDependencies": [
    {
      "sourcePath": "/path/to/external/dependency",
      "targetPath": "matlab/relative/path",
      "description": "Human-readable description"
    }
  ]
}
```

### Properties

- `sourcePath`: Absolute path to the source directory
- `targetPath`: Relative path within the app's directory where files should be copied
- `description`: Human-readable description (optional)

## Example

```json
{
  "matlabDependencies": [
    {
      "sourcePath": "/Users/penarasi/CascadeProjects/gPKPDSim/+PKPD",
      "targetPath": "matlab/gPKPDSim/+PKPD",
      "description": "PKPD core library"
    },
    {
      "sourcePath": "/Users/penarasi/CascadeProjects/gPKPDSim/+UIUtilities",
      "targetPath": "matlab/gPKPDSim/+UIUtilities",
      "description": "PKPD UI utilities"
    }
  ]
}
```

## Usage

When you run the build script with:

```bash
node build-matlab-package.js your-app-name
```

The script will:

1. Look for `apps/your-app-name/build-matlab-config.json`
2. If found, process each dependency in the `matlabDependencies` array
3. Copy files from the `sourcePath` to `targetPath` in the distribution

If the configuration file is not found or cannot be parsed, the script will log an appropriate message and continue with the build.
