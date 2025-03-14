/**
 * @fileoverview Handles Python interpreter switching operations for VS Code
 * Provides functionality to validate, resolve, and switch Python environments
 * Interfaces with the VS Code Python extension API
 */

"use strict"
const vscode = require("vscode")
const path = require("path")
const { delay } = require("../utils/common")
const {
  getPythonApi,
  refreshPythonEnvironments,
  switchPythonEnvironment,
  isPathInKnownEnvironments,
  formatEnvironmentsAsList,
} = require("../python/pythonExtension")

/**
 * @typedef {Object} InterpreterSwitchResult
 * @property {boolean} success - Whether the operation succeeded
 * @property {string} [message] - Success message (when success is true)
 * @property {string} [error] - Error message (when success is false)
 * @property {string} [requestedPath] - Original requested path
 * @property {string} [knownEnvironments] - List of available environments
 */
/**
 * Core function to handle Python interpreter switching
 * @param {string} pythonPath - Path to the Python interpreter
 * @param {string} [shortName] - Optional display name for the environment
 * @returns {Promise<InterpreterSwitchResult>} Result of the operation
 */
async function switchInterpreter(pythonPath, shortName) {
  console.debug(`switchInterpreter called with pythonPath: ${pythonPath}, shortName: ${shortName || "(none)"}`)
  // Validate input
  if (!pythonPath || typeof pythonPath !== "string" || pythonPath.trim() === "") {
    console.error("Invalid request: pythonPath must be a non-empty string")
    return {
      success: false,
      error: "pythonPath must be a non-empty string",
    }
  }

  try {
    // Resolve absolute path
    const absolutePythonPath = resolveAbsolutePath(pythonPath)
    console.info(`Switching interpreter: ${pythonPath}, resolves to: ${absolutePythonPath}`)

    // Get Python API
    const pythonApi = await getPythonApi()

    // Get environments and check if requested interpreter exists
    let knownEnvironments = await refreshPythonEnvironments(pythonApi)
    console.info("Known environments before switching:")
    console.info(formatEnvironmentsAsList(knownEnvironments))

    // Retry once if not found (Python extension might need time to discover)
    if (!isPathInKnownEnvironments(absolutePythonPath, knownEnvironments)) {
      console.warn(`Path not found in known environments, forcing refresh & retrying after 1s: ${absolutePythonPath}`)
      await delay(1000)
      knownEnvironments = await refreshPythonEnvironments(pythonApi)
      console.warn("Retrying after second force refresh. Fingers crossed!")
    }

    // Check again after retry
    if (!isPathInKnownEnvironments(absolutePythonPath, knownEnvironments)) {
      const knownEnvironmentsString = formatEnvironmentsAsList(knownEnvironments)
      const message = `Cannot switch to '${pythonPath}' - not found in available Python environments`

      console.error(`${message}\nKnown environments:\n${knownEnvironmentsString}`)
      vscode.window.showErrorMessage(message)

      return {
        success: false,
        error: message,
        requestedPath: absolutePythonPath,
        knownEnvironments: knownEnvironmentsString,
      }
    }

    // Switch interpreter
    await switchPythonEnvironment(pythonApi, absolutePythonPath, shortName || pythonPath)

    // Refresh and display final state
    knownEnvironments = await refreshPythonEnvironments(pythonApi)
    console.info("Known environments after switching & forced refresh:")
    console.info(formatEnvironmentsAsList(knownEnvironments))

    // Return success
    return {
      success: true,
      message: `Switched to ${pythonPath}`,
      requestedPath: pythonPath,
    }
  } catch (error) {
    console.error("Error using Python API:", error)
    const errorMessage = `Failed to get Python interpreter. Check that the MS Python extension is loaded, enabled, and activated. Error from API: ${
      error.message || String(error)
    }`

    vscode.window.showErrorMessage(errorMessage)
    return {
      success: false,
      error: errorMessage,
    }
  }
}

/**
 * Resolves a path to its absolute form relative to workspace root
 *
 * @param {string} requestedPythonPath - Path to resolve, can be relative or absolute
 * @returns {string} Fully resolved absolute path
 * @throws {Error} If no workspace folders are open
 */
function resolveAbsolutePath(requestedPythonPath) {
  if (!vscode.workspace.workspaceFolders || !vscode.workspace.workspaceFolders.length) {
    throw new Error("No workspace folder open. Please open a folder and try again.")
  }
  return path.resolve(vscode.workspace.workspaceFolders[0].uri.fsPath, requestedPythonPath)
}

module.exports = {
  switchInterpreter,
}
