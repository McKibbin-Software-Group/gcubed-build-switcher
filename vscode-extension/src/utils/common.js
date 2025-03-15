/**
 * @fileoverview Common utility functions used throughout the extension
 * Provides helpers for async operations, error handling, and validation
 */

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
 * @param {string} message - Error message
 * @param {Error} [originalError] - Original error to wrap
 * @returns {Error} Created error
 */
function createAndReportError(message, originalError) {
  const fullMessage = originalError ? `${message}: ${originalError.message}` : message
  console.error(fullMessage, originalError || "")
  vscode.window.showErrorMessage(fullMessage)
  return new Error(fullMessage)
}

/**
 * Validates if a string is non-empty
 * @param {any} value - Value to validate
 * @returns {boolean} True if value is a non-empty string
 */
function isValidNonEmptyString(value) {
  return typeof value === "string" && value.trim() !== ""
}

module.exports = {
  delay,
  createAndReportError,
  isValidNonEmptyString,
}
