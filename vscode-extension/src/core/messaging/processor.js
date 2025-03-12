/**
 * Message processor to handle interpreter switching requests
 */
"use strict"
const { interpreterLogger: logger } = require("./logger")
const { executeWithRetry } = require("../../utils/common")
const { ExtensionError, withErrorHandling } = require("../../utils/errors")
const path = require("path")
const vscode = require("vscode")
const { PythonExtension } = require("@vscode/python-extension")

/**
 * Creates a message processor that handles Python interpreter switching
 *
 * @returns {Function} Function to process interpreter switching messages
 */
function createMessageProcessor() {
  /**
   * Processes a request to switch Python interpreters
   * @param {Object} message - Request message
   * @param {string} message.pythonPath - Path to Python interpreter
   * @returns {Promise<Object>} Result of the operation
   */
  return withErrorHandling(
    async (message) => {
      const { pythonPath, shortName } = message

      logger.info(`Processing interpreter change request to: ${pythonPath}`)

      // Verify path is valid
      try {
        // Check if path is absolute or needs to be resolved relative to workspace
        const absolutePythonPath = path.isAbsolute(pythonPath) ? pythonPath : resolveRelativePath(pythonPath)

        // Get Python extension API
        const pythonApi = await executeWithRetry(() => PythonExtension.api(), {
          maxAttempts: 3,
          delayMs: 500,
          onRetry: (attempt) => logger.info(`Retrying to get Python API (attempt ${attempt})`),
        })

        // Refresh environments to ensure our target is listed
        await pythonApi.environments.refreshEnvironments()

        // Update the active environment
        await pythonApi.environments.updateActiveEnvironmentPath(absolutePythonPath)

        logger.info(`Successfully set Python interpreter to: ${absolutePythonPath}`)

        return {
          success: true,
          message: `Python interpreter set to ${shortName || pythonPath}`,
          path: absolutePythonPath,
        }
      } catch (error) {
        logger.error(`Failed to set Python interpreter: ${error.message}`)
        return {
          success: false,
          error: `Failed to set Python interpreter: ${error.message}`,
        }
      }
    },
    { logger }
  )
}

/**
 * Resolves a relative path against the workspace root
 * @param {string} relativePath - Relative path to resolve
 * @returns {string} Absolute path
 */
function resolveRelativePath(relativePath) {
  const workspaceFolders = vscode.workspace.workspaceFolders

  if (!workspaceFolders || workspaceFolders.length === 0) {
    throw new ExtensionError("No workspace folder is open", {
      code: "NO_WORKSPACE",
    })
  }

  const workspaceRoot = workspaceFolders[0].uri.fsPath
  return path.join(workspaceRoot, relativePath)
}

module.exports = createMessageProcessor
