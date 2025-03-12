"use strict"
const vscode = require("vscode")
const { EXTENSION_NAME } = require("../../utils/constants")

/**
 * Simple logger utility that can be replaced with more advanced implementations
 */
class MessageLogger {
  /**
   * @param {string} [prefix='Messaging'] - Prefix for all log messages
   * @param {Object} [output=console] - Output destination
   */
  constructor(prefix = "Messaging", output = console) {
    this.prefix = prefix
    this.output = output
  }

  /**
   * Format message with timestamp and prefix
   * @param {string} level - Log level
   * @param {string} message - Log message
   * @returns {string} Formatted message
   * @private
   */
  _format(level, message) {
    return `[${new Date().toISOString()}] [${this.prefix}] [${level}] ${message} --WARNING- USING DEPRECATED LOGGER CLASS--`
  }

  /**
   * Log an info message
   * @param {string} message - Message to log
   */
  info(message) {
    this.output.info(this._format("INFO", message))
  }

  /**
   * Log a warning message
   * @param {string} message - Message to log
   */
  warn(message) {
    this.output.warn(this._format("WARN", message))
  }

  /**
   * Log an error message
   * @param {string} message - Message to log
   */
  error(message) {
    this.output.error(this._format("ERROR", message))
  }
}

/**
 * Centralized logger implementation for consistent logging across components
 * Using a function factory approach.
 */

/**
 * Creates a component-specific logger with consistent formatting
 *
 * @param {string} component - Component name for log identification
 * @param {Object} options - Logger configuration options
 * @param {boolean} [options.includeTimestamp=true] - Whether to include timestamps
 * @param {boolean} [options.logToOutput=true] - Whether to log to VS Code output
 * @returns {Object} Logger object with standard logging methods
 */
function createLogger(component, options = {}) {
  const { includeTimestamp = true, logToOutput = true } = options

  let outputChannel
  if (logToOutput) {
    outputChannel = vscode.window.createOutputChannel(`${EXTENSION_NAME}: ${component}`)
  }

  /**
   * Formats a log message with optional timestamp and component name
   * @param {string} message - Message to format
   * @returns {string} Formatted message
   */
  function formatMessage(message) {
    let formattedMessage = `[${component}] ${message}`
    if (includeTimestamp) {
      formattedMessage = `[${new Date().toISOString()}] ${formattedMessage}`
    }
    return formattedMessage
  }

  return {
    debug: (message) => {
      const formattedMessage = formatMessage(message)
      console.debug(formattedMessage)
      if (outputChannel) outputChannel.appendLine(`DEBUG: ${formattedMessage}`)
    },
    info: (message) => {
      const formattedMessage = formatMessage(message)
      console.info(formattedMessage)
      if (outputChannel) outputChannel.appendLine(`INFO: ${formattedMessage}`)
    },
    warn: (message) => {
      const formattedMessage = formatMessage(message)
      console.warn(formattedMessage)
      if (outputChannel) outputChannel.appendLine(`WARN: ${formattedMessage}`)
    },
    error: (message) => {
      const formattedMessage = formatMessage(message)
      console.error(formattedMessage)
      if (outputChannel) outputChannel.appendLine(`ERROR: ${formattedMessage}`)
    },
  }
}

// Pre-configured loggers for different components
const extensionLogger = createLogger("Extension")
const serverLogger = createLogger("Server")
const interpreterLogger = createLogger("Interpreter")

module.exports = {
  createLogger,
  extensionLogger,
  serverLogger,
  interpreterLogger,
  MessageLogger,
}
