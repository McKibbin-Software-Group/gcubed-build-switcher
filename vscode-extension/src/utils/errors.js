const vscode = require('vscode');

/**
 * Custom application error class with additional context
 */
class ExtensionError extends Error {
  /**
   * Creates a new extension error
   *
   * @param {string} message - Error message
   * @param {Object} [options={}] - Error options
   * @param {string} [options.code] - Error code
   * @param {*} [options.originalError] - Original error if wrapping
   * @param {Object} [options.context] - Additional context data
   */
  constructor(message, options = {}) {
    super(message);
    this.name = this.constructor.name;
    this.code = options.code || 'UNKNOWN_ERROR';
    this.originalError = options.originalError;
    this.context = options.context || {};
  }
}

/**
 * Creates and reports an error to console and UI
 *
 * @param {string} message - Error message
 * @param {Object} [options] - Error options
 * @param {boolean} [options.showNotification=true] - Whether to show VS Code notification
 * @param {Object} [options.logger=console] - Logger to use
 * @returns {ExtensionError} Created error
 */
function createAndReportError(message, options = {}) {
  const {
    showNotification = true,
    logger = console,
    ...errorOptions
  } = options;

  const error = new ExtensionError(message, errorOptions);

  logger.error(message);

  if (showNotification) {
    vscode.window.showErrorMessage(message);
  }

  return error;
}

/**
 * Wraps an async function with error handling
 *
 * @param {Function} asyncFunction - Function to wrap
 * @param {Object} [options] - Error handling options
 * @param {Object} [options.logger=console] - Logger to use
 * @param {boolean} [options.rethrow=true] - Whether to rethrow errors
 * @returns {Function} Wrapped function
 */
function withErrorHandling(asyncFunction, options = {}) {
  const { logger = console, rethrow = true } = options;

  return async function wrappedWithErrorHandling(...args) {
    try {
      return await asyncFunction(...args);
    } catch (error) {
      const errorMessage = error.message || String(error);
      logger.error(`Error in ${asyncFunction.name || 'anonymous function'}: ${errorMessage}`);

      if (rethrow) {
        throw error;
      }
    }
  };
}

module.exports = {
  ExtensionError,
  createAndReportError,
  withErrorHandling
};