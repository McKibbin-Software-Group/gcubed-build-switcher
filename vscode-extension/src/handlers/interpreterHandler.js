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
const { createEnvironmentSelector } = require("../python/environmentSelector")

/**
 * Creates interpreter switching functions bound to one environment selector.
 *
 * @param {import("../python/environmentSelector").EnvironmentSelector} [environmentSelector]
 * @returns {{switchInterpreter: Function, setValidStartingInterpreter: Function}}
 */
function createInterpreterHandler(environmentSelector = createEnvironmentSelector()) {
  return {
    switchInterpreter: (pythonPath, shortName) => switchInterpreter(pythonPath, shortName, environmentSelector),
    setValidStartingInterpreter: () => setValidStartingInterpreter(environmentSelector),
  }
}

async function setValidStartingInterpreter(environmentSelector = createEnvironmentSelector()) {
  try {
    // wait a while to give the Python extension time to scan for venvs & set itself up properly
    await delay(15000)

    const validationResult = await environmentSelector.validateStartingInterpreter()
    let message

    console.info("Validating initial Python interpreter...")
    if (validationResult.success) {
      message = "Success validating startup Python virtual environment"
      vscode.window.showInformationMessage(message)
      console.info(message)
      return
    } else {
      // Venv is not valid, so try to find and set default
      message = `Startup Python virtual environment (${validationResult.path}) not valid - attempting to set a valid environment...`
      vscode.window.showWarningMessage(message)
      console.warn(message)

      const pythonConfig = vscode.workspace.getConfiguration("python")
      const defaultInterpreterPath = pythonConfig.get("defaultInterpreterPath")
      if (defaultInterpreterPath) {
        message = `Trying default interpreter (${defaultInterpreterPath})...`
        vscode.window.showInformationMessage(message)
        console.info(message)

        const switchResult = await switchInterpreter(defaultInterpreterPath, undefined, environmentSelector)
        if (switchResult.success) {
          vscode.window.showInformationMessage(switchResult.message)
          return
        }
      }

      // Try Hail Mary...
      const alternativeGCubedVenv = environmentSelector.getFirstEnvironmentPathContaining(
        validationResult.knownVenvs,
        VENV_NAME_PREFIX
      )
      if (alternativeGCubedVenv) {
        message = `Trying Hail-Mary G-Cubed venv path ${alternativeGCubedVenv}`
        vscode.window.showInformationMessage(message)
        console.log(message)
        const switchResult = await switchInterpreter(alternativeGCubedVenv, undefined, environmentSelector)
        if (switchResult.success) {
          vscode.window.showInformationMessage(switchResult.message)
          return
        }
      }
    }

    // Nothing worked
    message = "Please contact G-Cubed Support! No valid Python environment found."
    vscode.window.showErrorMessage(message)
    console.error(message)
    return

  } catch (error) {
    console.error("Error setting valid starting interpreter:", error)
    vscode.window.showErrorMessage(`Failed to set Python interpreter: ${error.message || String(error)}`)
    return false
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
 * @param {import("../python/environmentSelector").EnvironmentSelector} [environmentSelector]
 * @returns {Promise<InterpreterSwitchResult>} Result of the operation
 */
async function switchInterpreter(pythonPath, shortName, environmentSelector = createEnvironmentSelector()) {
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
    // resolveAbsolutePath just builds an absolute path if given a relative path
    // It does not check for files on disk. This is currently sufficient as the only entry to this
    // extension is via the Python component, and that only invokes this extension if it has
    // successfully built the path in the first place (so no need to double-check).
    // The issue we're trying to overcome with this piece of code is that the vscode Python
    // extension sometimes doesn't recognise a new virtual environment (ie one just build by the
    // Python part). Kicking it a few times is often sufficient to wake it up and make it
    // recognise a new venv.

    const absolutePythonPath = resolveAbsolutePath(pythonPath)
    console.info(`Activating interpreter: ${pythonPath} (resolves to: ${absolutePythonPath})`)

    const displayName = shortName || pythonPath

    // Try to switch interpreter regardless of whether or not the Python extension thinks it can see it
    const message = `Activating: '${displayName}'`
    console.log(message)
    vscode.window.showInformationMessage(message)

    const selectionResult = await environmentSelector.selectInterpreter(absolutePythonPath, displayName)
    console.info("Known (refreshed) environments before switch: ", selectionResult.knownEnvironmentsBeforeSwitch)
    console.info("Resolved environment before switch: ", selectionResult.resolvedEnvironmentBeforeSwitch)

    // and refresh/resolve again to get the best chance that we actually know if the environment actually switched...
    console.info("Known (refreshed) environments after switch: ", selectionResult.knownEnvironmentsAfterSwitch)
    console.info("Resolved environment after switch: ", selectionResult.resolvedEnvironmentAfterSwitch)

    if (selectionResult.resolvedEnvironmentAfterSwitch !== undefined) {
      // Return success
      const message = `Successfully activated: '${displayName}'`
      console.log(message)
      vscode.window.showInformationMessage(message)
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
      knownEnvironments: environmentSelector.formatKnownEnvironments(selectionResult.knownEnvironmentsAfterSwitch),
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
  createInterpreterHandler,
  switchInterpreter,
  setValidStartingInterpreter,
  resolveAbsolutePath,
}
