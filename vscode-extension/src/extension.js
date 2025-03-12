"use strict"
const vscode = require("vscode")
const { EXTENSION_NAME } = require("./utils/constants")
const { createDelayPromise } = require("./utils/common")
const { createAndReportError } = require("./utils/errors")
const { getExtensionSettings } = require("./config/settings")
const { createServerFromConfig } = require("./protocols/serverFactory")
const { extensionLogger: logger } = require('./core/messaging')

// Global server reference needed for activate/deactivate
let server = null

/**
 * Extension activation handler
 * @param {vscode.ExtensionContext} context - VS Code extension context
 * @returns {Promise<void>}
 */
async function activate(context) {
  const activationStartTime = Date.now()
  const settings = getExtensionSettings()

  try {
    // Create appropriate server based on configuration
    server = await createServerFromConfig(settings, logger) // Pass logger to factory

    // Register server cleanup on extension deactivation
    context.subscriptions.push({ dispose: () => server.shutdown() })

    // Log activation success with timing information
    const activationDuration = Date.now() - activationStartTime
    logger.info(`${EXTENSION_NAME} extension activated in ${activationDuration}ms`)
    vscode.window.showInformationMessage(`${EXTENSION_NAME} extension activated`)
  }
  catch (error) {
    // Use utils/errors with logger
    createAndReportError(`Failed to start ${EXTENSION_NAME}: ${error.message}`, {
      showNotification: true,
      logger: logger,
      context: { settings }
    })
  }
}

/**
 * Extension deactivation handler
 * @returns {Promise<void>}
 */
async function deactivate() {
  if (server) {
    try {
      // Gracefully shut down the server with timeout
      const shutdownPromise = server.shutdown()
      const timeoutPromise = createDelayPromise(3000).then(() => {
        logger.warn(`${EXTENSION_NAME} server shutdown timed out`)
      })

      await Promise.race([shutdownPromise, timeoutPromise])

      const message = `${EXTENSION_NAME} extension deactivated`
      logger.log(message)
      vscode.window.showInformationMessage(message)
    } catch (error) {
      logger.error(`Error during ${EXTENSION_NAME} shutdown: ${error.message}`)
    } finally {
      server = null
    }
  }
}

module.exports = { activate, deactivate }
