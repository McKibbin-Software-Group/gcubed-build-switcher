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
 * Core function to handle Python interpreter switching
 * @param {string} pythonPath - Path to the Python interpreter
 * @param {string} [shortName] - Optional display name for the environment
 * @returns {Promise<{success: boolean, message?: string, error?: string, requestedPath?: string, knownEnvironments?: string}>}
 */
async function switchInterpreter(pythonPath, shortName) {
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
      message: `Successfully switched to ${pythonPath}`,
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
 * Resolves a path relative to workspace root
 * @param {string} requestedPythonPath - Path to resolve
 * @returns {string} Absolute path
 */
function resolveAbsolutePath(requestedPythonPath) {
  return path.resolve(vscode.workspace.workspaceFolders[0].uri.fsPath, requestedPythonPath)
}

module.exports = {
  switchInterpreter,
}
