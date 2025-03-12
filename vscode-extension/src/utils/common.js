"use strict"
const vscode = require("vscode")

/**
 * Creates a Promise that resolves after a specified delay
 * @param {number} ms - Delay in milliseconds
 * @returns {Promise<void>} Promise that resolves after delay
 */
function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Creates an error and logs it to console and UI
 * @deprecated Use createAndReportError from utils/errors.js instead
 * @param {string} message - Error message
 * @param {Object} [logger=console] - Logger instance
 * @returns {Error} Created error
 */
function createAndReportError(message, logger = console) {
  logger.error(message)
  vscode.window.showErrorMessage(message)
  return new Error(message)
}

/**
 * Validates if a string is non-empty
 * @param {any} value - Value to validate
 * @returns {boolean} True if value is a non-empty string
 */
function isValidNonEmptyString(value) {
  return typeof value === "string" && value.trim() !== ""
}

/**
 * Creates a Promise that resolves after a specified delay
 *
 * @param {number} milliseconds - The delay in milliseconds
 * @returns {Promise<void>} Promise that resolves after the delay
 */
function createDelayPromise(milliseconds) {
  return new Promise(resolve => setTimeout(resolve, milliseconds));
}

/**
 * Utility to truncate long strings for logging
 *
 * @param {string} text - The text to truncate
 * @param {number} [maxLength=100] - Maximum length before truncation
 * @param {string} [suffix='...'] - Suffix to append after truncation
 * @returns {string} Truncated string
 */
function truncateForLogging(text, maxLength = 100, suffix = '...') {
  if (typeof text !== 'string') {
    return String(text);
  }

  return text.length <= maxLength
    ? text
    : `${text.substring(0, maxLength)}${suffix}`;
}

/**
 * Attempts to execute a function multiple times until success or max attempts reached
 *
 * @param {Function} asyncFunction - Function to execute
 * @param {Object} options - Retry options
 * @param {number} options.maxAttempts - Maximum number of attempts
 * @param {number} options.delayMs - Delay between attempts in milliseconds
 * @param {Function} [options.shouldRetry] - Function to determine if retry should occur
 * @param {Function} [options.onRetry] - Callback called before each retry
 * @returns {Promise<*>} Result of the function
 */
async function executeWithRetry(asyncFunction, options) {
  const {
    maxAttempts = 3,
    delayMs = 1000,
    shouldRetry = () => true,
    onRetry = (attempt, error) => {}
  } = options;

  let lastError;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await asyncFunction(attempt);
    } catch (error) {
      lastError = error;

      // Don't retry if we've hit max attempts or shouldRetry returns false
      if (attempt >= maxAttempts || !shouldRetry(error)) {
        throw error;
      }

      // Call the onRetry callback if provided
      onRetry(attempt, error);

      // Wait before next attempt
      await createDelayPromise(delayMs);
    }
  }

  // This should never happen, but just in case
  throw lastError;
}

/**
 * Ensures a function is only called once within a specified time window
 *
 * @param {Function} func - Function to debounce
 * @param {number} wait - Time window in milliseconds
 * @returns {Function} Debounced function
 */
function createDebouncedFunction(func, wait) {
  let timeout;
  return function executeDebouncedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

module.exports = {
  delay,
  createAndReportError,
  isValidNonEmptyString,
  createDelayPromise,
  truncateForLogging,
  executeWithRetry,
  createDebouncedFunction
}