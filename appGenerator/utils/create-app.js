#!/usr/bin/env node
// utils/create-app.js
import { mkdir, readFile, writeFile, unlink } from 'fs/promises';
import { dirname, join, basename, resolve } from 'path';
import { fileURLToPath } from 'url';
import { existsSync, promises as fsPromises, constants } from 'fs';
import { exec } from 'child_process';
import { promisify } from 'util';

const execPromise = promisify(exec);
const fs = { promises: fsPromises, constants };

const __dirname = dirname(fileURLToPath(import.meta.url));

// Path to the templates directory
const TEMPLATES_DIR = join(__dirname, '../templates');
const ROOT_PATH = dirname(dirname(__dirname));
const APPS_DIR = join(ROOT_PATH, 'apps');

// List of files to copy from templates
const FILES_TO_COPY = [
  'App.js',
  'index.html',
  'package.json',
  'README.md'
];

// Create a simple read stream wrapper that handles errors better
function createReadStreamSafe(path, options) {
  const stream = fs.promises.createReadStream(path, options);
  stream.on('error', (err) => {
    console.error(`  - Read stream error: ${err.message}`);
  });
  return stream;
}

// Create a simple write stream wrapper that handles errors better
function createWriteStreamSafe(path, options) {
  const stream = fs.promises.createWriteStream(path, options);
  stream.on('error', (err) => {
    console.error(`  - Write stream error: ${err.message}`);
  });
  return stream;
}

/**
 * Creates a new application by copying the template files
 * @param {string} targetPath - Path where the app should be created
 */
async function readFileWithRetry(filePath) {
  try {
    // First try with UTF-8
    return await fs.promises.readFile(filePath, 'utf8');
  } catch (utf8Err) {
    // If UTF-8 fails, try with binary encoding
    try {
      const data = await fs.promises.readFile(filePath, 'binary');
      return data;
    } catch (binaryErr) {
      // If binary fails, try one more time with UTF-8
      try {
        return await fs.promises.readFile(filePath, 'utf8');
      } catch (finalErr) {
        throw new Error(`Failed to read file after multiple attempts: ${finalErr.message}`);
      }
    }
  }
}

async function createApp(targetPath, dataFile) {
  console.log(`Creating new app at ${targetPath}`);
  
  try {
    // Create target directory
    await mkdir(targetPath, { recursive: true });
    
    // Function to copy a file with directory creation
    async function copyWithDirs(source, dest) {
      try {
        // Create destination directory if it doesn't exist
        const destDir = dirname(dest);
        if (!existsSync(destDir)) {
          await mkdir(destDir, { recursive: true });
        }
        
        // Read and write the file
        let content = await readFile(source, 'utf8');
        
        // Update paths in the files if needed
        if (source.endsWith('.js') || source.endsWith('.html')) {
          // Update import paths to use relative paths from the new app location
          content = content.replace(
            /from '(\/|\.\.\/)*appFramework\//g,
            "from '../../../appFramework/"
          );
        }
        
        await writeFile(dest, content, 'utf8');
        console.log(`  - Created ${basename(dest)}`);
      } catch (error) {
        console.error(`Error copying ${source} to ${dest}:`, error.message);
        throw error;
      }
    }
    
    // Copy main files
    console.log('Copying files...');
    for (const file of FILES_TO_COPY) {
      const source = join(TEMPLATES_DIR, file);
      const dest = join(targetPath, file);
      
      if (file.endsWith('/')) {
        // It's a directory, ensure it's created
        if (!existsSync(dest)) {
          await mkdir(dest, { recursive: true });
          console.log(`  - Created directory: ${file}`);
        }
      } else {
        await copyWithDirs(source, dest);
      }
    }
    
    // Note: View files are now loaded directly from appFramework
    console.log('Using view files from appFramework directory');
    
    // Create a minimal .gitignore
    await writeFile(
      join(targetPath, '.gitignore'),
      'node_modules/\n.DS_Store\n',
      'utf8'
    );
    
    // Create empty directories
    const dirsToCreate = [
      'model',
      'view',
      'controller',
      'data-model',
      'resources'
    ];
    
    for (const dir of dirsToCreate) {
      const dirPath = join(targetPath, dir);
      await mkdir(dirPath, { recursive: true });
      console.log(`  - Created directory: ${dir}/`);
    }

    // Copy data file to resources if provided
    if (dataFile) {
      let sourceFile, resolvedTargetPath, destFile;
      
      try {
        sourceFile = resolve(dataFile);
        
        // Check if source file exists
        if (!existsSync(sourceFile)) {
          throw new Error(`Source file '${sourceFile}' does not exist`);
        }
        
        // Check file stats and permissions
        try {
          const stats = await fs.promises.stat(sourceFile);
          console.log(`  - File stats: ${JSON.stringify({
            size: stats.size,
            mode: stats.mode.toString(8),
            uid: stats.uid,
            gid: stats.gid,
            isFile: stats.isFile(),
            isDirectory: stats.isDirectory()
          }, null, 2)}`);
          
          console.log(`  - Trying manual file copy with chunked reading...`);
          try {
            const resourcesPath = join(resolve(process.cwd(), targetPath), 'resources');
            await mkdir(resourcesPath, { recursive: true, mode: 0o755 });
            
            const destFile = join(resourcesPath, basename(sourceFile));
            console.log(`  - Destination: ${destFile}`);
            
            // Get file size for progress reporting
            const stats = await fs.promises.stat(sourceFile);
            const fileSize = stats.size;
            console.log(`  - Source file size: ${fileSize} bytes`);
            
            // Open source file for reading
            const sourceFd = await fs.promises.open(sourceFile, 'r');
            const destFd = await fs.promises.open(destFile, 'w');
            
            try {
              const chunkSize = 64 * 1024; // 64KB chunks
              let bytesRead = 0;
              let position = 0;
              
              // Read and write file in chunks
              while (position < fileSize) {
                const chunk = await sourceFd.read({
                  buffer: Buffer.alloc(chunkSize),
                  position: position,
                  length: Math.min(chunkSize, fileSize - position)
                });
                
                if (chunk.bytesRead === 0) break; // End of file
                
                await destFd.write(chunk.buffer, 0, chunk.bytesRead, position);
                
                position += chunk.bytesRead;
                bytesRead += chunk.bytesRead;
                
                // Log progress every 1MB
                if (bytesRead > 1024 * 1024) {
                  const percent = Math.round((position / fileSize) * 100);
                  console.log(`  - Copy progress: ${percent}% (${position}/${fileSize} bytes)`);
                  bytesRead = 0;
                }
              }
              
              console.log(`  - Successfully copied ${position} bytes to: ${destFile}`);
              return true;
              
            } finally {
              // Ensure file descriptors are always closed
              await Promise.all([
                sourceFd.close().catch(console.error),
                destFd.close().catch(console.error)
              ]);
            }
            
          } catch (copyErr) {
            console.error(`  - Detailed copy error:`, copyErr);
            throw new Error(`Failed to copy file manually: ${copyErr.message}`);
          }
        } catch (statErr) {
          throw new Error(`Cannot access source file (${statErr.code}): ${statErr.message}`);
        }
        
        // Resolve the full target path
        resolvedTargetPath = resolve(process.cwd(), targetPath);
        const resourcesPath = join(resolvedTargetPath, 'resources');
        destFile = join(resourcesPath, basename(sourceFile));
        
        // Create resources directory if it doesn't exist
        try {
          await mkdir(resourcesPath, { recursive: true, mode: 0o755 });
          console.log(`  - Created resources directory at: ${resourcesPath}`);
          
          // Check directory permissions
          const dirStats = await fs.promises.stat(resourcesPath);
          console.log(`  - Directory stats: ${JSON.stringify({
            mode: dirStats.mode.toString(8),
            uid: dirStats.uid,
            gid: dirStats.gid
          }, null, 2)}`);
          
        } catch (mkdirErr) {
          console.error(`  - Error creating directory: ${mkdirErr.message}`);
          console.error(`  - Directory path: ${resourcesPath}`);
          throw new Error(`Cannot create resources directory: ${mkdirErr.message}`);
        }
        
        // Check write permissions in the target directory
        const testFile = join(resourcesPath, `.permission-test-${Date.now()}`);
        try {
          await writeFile(testFile, 'test');
          await unlink(testFile);
        } catch (writeErr) {
          throw new Error(`Cannot write to resources directory (permission denied?): ${writeErr.message}`);
        }
        
        // Read the source file content
        const fileContent = await readFileWithRetry(sourceFile);
        
        // Write to a temporary file first
        const tempFile = `${destFile}.tmp`;
        try {
          await writeFile(tempFile, fileContent);
          
          // Rename the temp file to the final destination
          try {
            await fs.promises.rename(tempFile, destFile);
            console.log(`  - Successfully copied to: ${join('resources', basename(destFile))}`);
          } catch (renameErr) {
            // If rename fails, try copying instead
            console.log(`  - Rename failed, trying direct copy...`);
            await writeFile(destFile, fileContent);
            console.log(`  - Successfully wrote to: ${join('resources', basename(destFile))}`);
            
            // Clean up temp file if it exists
            try { await unlink(tempFile); } catch (e) {}
          }
        } catch (writeErr) {
          // Clean up temp file if it exists
          try { await unlink(tempFile); } catch (e) {}
          throw new Error(`Failed to write file content: ${writeErr.message}`);
        }
        
      } catch (error) {
        console.warn(`\n❌ Error copying data file: ${error.message}`);
        console.warn(`  Source: ${dataFile}`);
        console.warn(`  Resolved source: ${sourceFile || 'N/A'}`);
        console.warn(`  Destination: ${destFile || 'N/A'}`);
        console.warn(`  Current working directory: ${process.cwd()}`);
        console.warn(`  Target directory: ${resolvedTargetPath || 'N/A'}`);
        console.warn('\nTroubleshooting steps:');
        console.warn('1. Verify the source file exists and is accessible:');
        console.warn(`   ls -la ${dataFile}`);
        console.warn('2. Check file permissions:');
        console.warn(`   ls -la ${dirname(dataFile)}/`);
        console.warn('3. Try running with sudo if permission is denied');
        console.warn('4. Check for any file locks or open handles');
      }
    }
    
    console.log('\n✅ Successfully created app at', targetPath);
    console.log('\nNext steps:');
    console.log(`  1. cd ${targetPath}`);
    console.log('  2. npm install');
    console.log('  3. npm start');
    console.log('\nFor more information, see the README.md file.');
  } catch (error) {
    console.error('Error creating app:', error.message);
    process.exit(1);
  }
}

// Parse command line arguments
const args = process.argv.slice(2);
const appName = args[0];
const dataFile = args[1]; // Optional data file path

// Validate app name
if (!appName) {
  console.error('Error: Please provide an app name');
  console.error('Usage: node create-app.js <app-name> [data-file]');
  console.error('  app-name:  Name for your application (will be created in apps/ directory)');
  console.error('  data-file: Optional path to a data file to copy to resources/');
  process.exit(1);
}

// Create the target path inside the apps directory
const targetPath = join(APPS_DIR, appName);

// Check if target directory already exists
if (existsSync(targetPath)) {
  console.error(`Error: Directory ${targetPath} already exists`);
  console.error('Please choose a different app name or delete the existing directory');
  process.exit(1);
}

// Create the apps directory if it doesn't exist
await fs.promises.mkdir(APPS_DIR, { recursive: true });

// Create the app directory and required subdirectories
console.log(`Creating new application in ${targetPath}`);
await fs.promises.mkdir(targetPath, { recursive: true });
await fs.promises.mkdir(join(targetPath, 'resources'), { recursive: true });
await fs.promises.mkdir(join(targetPath, 'data-model'), { recursive: true });

createApp(targetPath, dataFile);
