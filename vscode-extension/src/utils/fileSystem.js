const fs = require('fs');
const path = require('path');

/**
 * Ensures a directory exists, creating it recursively if needed
 *
 * @param {string} directoryPath - Path to ensure exists
 * @returns {boolean} True if directory exists or was created
 */
function ensureDirectoryExists(directoryPath) {
  if (!fs.existsSync(directoryPath)) {
    fs.mkdirSync(directoryPath, { recursive: true });
    return true;
  }
  return false;
}

/**
 * Safely removes a file if it exists
 *
 * @param {string} filePath - Path to the file to remove
 * @param {Object} [options] - Additional options
 * @param {Object} [options.logger=console] - Logger to use
 * @returns {boolean} True if file was removed, false if it didn't exist
 */
function safelyRemoveFile(filePath, options = {}) {
  const { logger = console } = options;

  if (fs.existsSync(filePath)) {
    try {
      fs.unlinkSync(filePath);
      logger.info(`Removed file: ${filePath}`);
      return true;
    } catch (error) {
      logger.warn(`Failed to remove file ${filePath}: ${error.message}`);
      return false;
    }
  }
  return false;
}

/**
 * Sanitizes a file path to ensure it's safe
 *
 * @param {string} filePath - Path to sanitize
 * @returns {string} Sanitized path
 */
function sanitizeFilePath(filePath) {
  // Remove any null bytes or other potentially dangerous characters
  return filePath
    .replace(/\0/g, '')
    .replace(/\.\./g, '_')  // Prevent directory traversal
    .replace(/[^\w\s\.\-\/\\]/g, '_');  // Replace unsafe chars
}

module.exports = {
  ensureDirectoryExists,
  safelyRemoveFile,
  sanitizeFilePath
};