/**
 * cleanup-dist.js
 * 
 * This script cleans up a distribution directory by removing unwanted files and directories
 * such as test folders, coverage reports, etc.
 * 
 * Usage:
 * node cleanup-dist.js [distDir]
 */

const fs = require('fs-extra');
const path = require('path');
const minimatch = require('minimatch');

// Get distribution directory from command line arguments
const distDir = process.argv[2];

// Ensure dist directory is provided
if (!distDir) {
  console.error('Error: Distribution directory must be provided');
  console.error('Usage: node cleanup-dist.js <distDir>');
  process.exit(1);
}

// Define patterns for directories to remove
const CLEANUP_PATTERNS = [
  '**/test',
  '**/tests',
  '**/__tests__',
  '**/coverage',
  '**/node_modules',
  '**/.git',
  '**/docs',
  '**/examples'
];

/**
 * Find directories that match cleanup patterns
 * @param {string} baseDir - Base directory to search
 * @returns {Promise<string[]>} - List of directories to remove
 */
async function findDirectoriesToClean(baseDir) {
  const dirsToRemove = [];
  
  async function traverse(dir) {
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      
      for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        
        const fullPath = path.join(dir, entry.name);
        const relativePath = path.relative(baseDir, fullPath);
        
        // Check if this directory matches any pattern
        const shouldRemove = CLEANUP_PATTERNS.some(pattern => 
          minimatch(relativePath, pattern) || 
          minimatch(entry.name, pattern.replace(/\*\*\//g, ''))
        );
        
        if (shouldRemove) {
          dirsToRemove.push(fullPath);
          // Skip traversing this directory since we'll remove it entirely
          continue;
        }
        
        // Recursively traverse subdirectories
        await traverse(fullPath);
      }
    } catch (err) {
      console.error(`Error traversing directory ${dir}:`, err);
    }
  }
  
  await traverse(baseDir);
  
  // Sort directories by depth (deepest first) to avoid dependency issues
  return dirsToRemove.sort((a, b) => {
    return b.split(path.sep).length - a.split(path.sep).length;
  });
}

/**
 * Remove directories from the distribution
 */
async function cleanupDistribution() {
  try {
    console.log(`Cleaning up distribution directory: ${distDir}`);
    
    // Find directories to remove
    const dirsToRemove = await findDirectoriesToClean(distDir);
    
    if (dirsToRemove.length === 0) {
      console.log('No directories to clean up.');
      return;
    }
    
    console.log(`Found ${dirsToRemove.length} directories to remove:`);
    
    // Remove directories
    for (const dir of dirsToRemove) {
      try {
        await fs.remove(dir);
        console.log(`✓ Removed: ${path.relative(distDir, dir)}`);
      } catch (err) {
        console.error(`Failed to remove ${dir}:`, err);
      }
    }
    
    console.log('\nCleanup complete!');
  } catch (err) {
    console.error('Cleanup failed:', err);
    process.exit(1);
  }
}

// Run the cleanup
cleanupDistribution();
