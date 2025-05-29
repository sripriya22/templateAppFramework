const { mkdtemp, rm } = require('fs/promises');
const { join } = require('path');
const { tmpdir } = require('os');
const fs = require('fs');
const path = require('path');

/**
 * Creates a temporary directory for testing
 * @returns {Promise<string>} Path to the created directory
 */
async function createTempDir() {
  return await mkdtemp(join(tmpdir(), 'app-framework-test-'));
}

/**
 * Removes a directory and its contents
 * @param {string} dirPath - Path to the directory to remove
 */
async function cleanupTempDir(dirPath) {
  try {
    await rm(dirPath, { recursive: true, force: true });
  } catch (err) {
    console.warn(`Failed to clean up temp dir ${dirPath}:`, err);
  }
}

/**
 * Loads test model definitions
 * @returns {Promise<Object>} Object containing model definitions
 */
async function loadTestDefinitions() {
  const readJson = (filePath) => {
    try {
      const fullPath = path.join(__dirname, filePath);
      return JSON.parse(fs.readFileSync(fullPath, 'utf8'));
    } catch (err) {
      console.error(`Error loading JSON file ${filePath}:`, err);
      return null;
    }
  };

  return {
    BaseModel: readJson('./data-models/BaseModel.json'),
    User: readJson('./data-models/User.json'),
    Post: readJson('./data-models/Post.json')
  };
}

module.exports = {
  createTempDir,
  cleanupTempDir,
  loadTestDefinitions
};
