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
 * @returns {Error} Created error
 */
function createAndReportError(message) {
  console.error(message)
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

module.exports = {
  delay,
  createAndReportError,
  isValidNonEmptyString
}