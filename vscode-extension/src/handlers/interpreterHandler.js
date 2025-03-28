/**
 * @fileoverview Handles Python interpreter switching operations for VS Code
 * Provides functionality to validate, resolve, and switch Python environments
 * Interfaces with the VS Code Python extension API
 */

"use strict"
const { VENV_NAME_PREFIX } = require("../utils/constants")
const vscode = require("vscode")
const path = require("path")
const { delay } = require("../utils/common")
const {
  getPythonApi,
  refreshPythonEnvironments,
  switchPythonEnvironment,
  formatEnvironmentsAsList,
  resolvePythonEnvironment,
  validateStartingPythonInterpreter,
} = require("../python/pythonExtension")

async function setValidStartingInterpreter() {
  try {
    console.info("Validating initial Python interpreter...")
    const pythonApi = await getPythonApi()
    const validationResult = await validateStartingPythonInterpreter(pythonApi)
    if (validationResult.success) {
      vscode.window.showInformationMessage("Success validating Python virtual environment")
      return
    } else {
      // Venv is not valid, so try to find and set default
      const pythonConfig = vscode.workspace.getConfiguration("python")
      const defaultInterpreterPath = pythonConfig.get("defaultInterpreterPath")

      if (defaultInterpreterPath) {
        vscode.window.showWarningMessage("Invalid initial active Python interpreter - resetting to default...")
        console.warn(
          `Initial active interpreter (${validationResult.path}) is invalid - switching to default interpreter: ${defaultInterpreterPath},`
        )
        const switchResult = await switchInterpreter(defaultInterpreterPath)
        if (switchResult.success) {
          vscode.window.showInformationMessage(switchResult.message)
          return
        }
      }

      // couldn't successfully find the default interpreter. Hail mary - find any gcubed venv which
      // will hopefully be enough to launch the python environment switcher.
      console.log(`Found a G-Cubed venv path ${getFirstGcubedVenvPathFromKnownVenvs( validationResult.knownVenvs )}`)

    }

    vscode.window.showErrorMessage("Please contact G-Cubed Support - no valid Python environment found!")
  } catch (error) {
    console.error("Error setting valid starting interpreter:", error)
    vscode.window.showErrorMessage(`Failed to set Python interpreter: ${error.message || String(error)}`)
    return false
  }

  function getFirstGcubedVenvPathFromKnownVenvs(knownVenvs) {
    try {
      return knownVenvs.find((venv) => {
        return venv.internal.path.includes(VENV_NAME_PREFIX)
      }).internal.path
    } finally {
      return null
    }
  }
}

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

    let knownEnvironments = await refreshPythonEnvironments(pythonApi)
    console.info("Known (refreshed) environments before switch: ", knownEnvironments)
    let resolvedEnvironment = await resolvePythonEnvironment(pythonApi, absolutePythonPath, shortName || pythonPath)
    console.info("Resolved environment before switch: ", resolvedEnvironment)

    // Try to switch interpreter regardless of whether or not the Python extension thinks it can see it
    await switchPythonEnvironment(pythonApi, absolutePythonPath, shortName || pythonPath)

    // and do it again to get the best chance that we actually know if the environment actually switched...
    knownEnvironments = await refreshPythonEnvironments(pythonApi)
    console.info("Known (refreshed) environments after switch: ", knownEnvironments)
    resolvedEnvironment = await resolvePythonEnvironment(pythonApi, absolutePythonPath, shortName || pythonPath)
    console.info("Resolved environment after switch: ", resolvedEnvironment)

    if (resolvedEnvironment !== undefined) {
      // Return success
      return {
        success: true,
        message: `Switched to ${pythonPath}`,
        requestedPath: pythonPath,
      }
    }
    // Return failure
    return {
      success: false,
      message: `Switch to ${pythonPath} did not appear to work - could not resolve the environment`,
      requestedPath: pythonPath,
      knownEnvironments: formatEnvironmentsAsList(knownEnvironments),
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
  setValidStartingInterpreter,
}
