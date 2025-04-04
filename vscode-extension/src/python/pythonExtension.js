/**
 * @fileoverview Interface to VS Code's Python extension
 * Provides functionality for discovering, managing and switching Python environments
 * Handles extension activation, environment refresh, and interpreter switching
 */

"use strict"
const vscode = require("vscode")
const pythonExt = require("@vscode/python-extension")
const { delay, createAndReportError } = require("../utils/common")

/**
 * Retrieves Python extension API
 * @returns {Promise<import('@vscode/python-extension').PythonExtension>} The Python extension API
 */
async function getPythonApi() {
  await ensurePythonExtension({ maxRetries: 20, delayMs: 3000 })
  return await pythonExt.PythonExtension.api()
}

/**
 * Ensures the Python extension is available and active
 * @param {Object} options - Configuration options
 * @param {number} options.maxRetries - Maximum number of retry attempts to find the extension
 * @param {number} options.delayMs - Delay between retries in milliseconds
 * @returns {Promise<vscode.Extension<any>>} The activated Python extension
 * @throws {Error} When the extension cannot be found after retries
 * @throws {Error} When the extension fails to activate
 */
async function ensurePythonExtension({ maxRetries = 5, delayMs = 3000 } = {}) {
  console.info("Checking Python extension...")
  const pythonExtension = await getPythonExtensionWithRetry({ maxRetries, delayMs })

  if (!pythonExtension) {
    throw createAndReportError(
      "Python extension not found after multiple attempts. Please ensure it's installed and reload the window."
    )
  }

  if (!pythonExtension.isActive) {
    console.info("Inactive Python extension found, waiting to activate...")
    try {
      await pythonExtension.activate()
      console.info("Python extension activated")
    } catch (error) {
      throw createAndReportError(`Failed to activate Python extension: ${error.message}`)
    }
  } else {
    console.info("Active Python extension found")
  }

  return pythonExtension
}

/**
 * Attempts to get the Python extension with multiple retries
 * @param {Object} options - Options for retry attempts
 * @param {number} options.maxRetries - Maximum number of retry attempts
 * @param {number} options.delayMs - Delay between retries in milliseconds
 * @returns {Promise<vscode.Extension<any> | undefined>} - The Python extension or undefined if not found
 */
async function getPythonExtensionWithRetry({ maxRetries = 0, delayMs = 3000 } = {}) {
  let retryCount = 0
  let pythonExtension = vscode.extensions.getExtension("ms-python.python")
  console.info("Got Python extension: ", pythonExtension)

  while (!pythonExtension && retryCount < maxRetries) {
    console.warn(`Python extension not found, retrying (${retryCount + 1}/${maxRetries})...`)
    await delay(delayMs)
    pythonExtension = vscode.extensions.getExtension("ms-python.python")
    retryCount++
  }

  return pythonExtension
}

/**
 * Switches the active Python environment
 * @param {Object} pythonApi - Python extension API
 * @param {string} absolutePath - Absolute path to interpreter
 * @param {string} displayName - Display name for notification (optional)
 * @returns {Promise<void>}
 */
async function switchPythonEnvironment(pythonApi, absolutePath) {
  return await pythonApi.environments.updateActiveEnvironmentPath(absolutePath)
}

async function validateStartingPythonInterpreter(pythonApi) {
  // Refresh environments to get current list
  const knownVenvs = await refreshPythonEnvironments(pythonApi)

  // Get current active environment
  const activeEnvironmentPath = await pythonApi.environments.getActiveEnvironmentPath()
  const resolvedEnvironment = await pythonApi.environments.resolveEnvironment(activeEnvironmentPath)

  const activeInterpreterPath = activeEnvironmentPath ? activeEnvironmentPath.path : "none"
  console.info(`Current active interpreter: ${activeInterpreterPath}. Resolves as: `, resolvedEnvironment)
  if (resolvedEnvironment !== undefined) {
    return { success: true, path: resolvedEnvironment.id, knownVenvs }
  }
  return { success: false, path: activeInterpreterPath, knownVenvs }
}

/**
 * @typedef {Object} PythonEnvironment
 * @property {string} id - Environment identifier
 * @property {string} path - Path to the Python interpreter
 * @property {string} [displayName] - Human-readable name
 */
/**
 * Refreshes Python environments and returns the list
 * @param {Object} pythonApi - Python extension API
 * @param {boolean} forceRefresh - Whether to force refresh
 * @returns {Promise<Array<Object<string, PythonEnvironment>>>} List of known environments
 */
async function refreshPythonEnvironments(pythonApi, forceRefresh = true) {
  await pythonApi.environments.refreshEnvironments({ forceRefresh })
  return pythonApi.environments.known
}

/**
 * Resolves details of a Python environment using the Python extension API.
 * @param {Object} pythonApi - The Python extension API.
 * @param {string} absolutePath - The absolute path to the Python interpreter.
 * @param {string} [displayName] - An optional display name for the environment, used in notifications.
 * @returns {Promise<Object>} A promise that resolves to the environment details.
 * @throws {Error} If the environment cannot be resolved.
 */
async function resolvePythonEnvironment(pythonApi, absolutePath, displayName) {
  console.log(`Resolving venv: '${displayName}': '${absolutePath}'`)
  return await pythonApi.environments.resolveEnvironment(absolutePath)
}

/**
 * Checks if a given path is present in known Python environments
 * @param {string} absolutePath - Path to check
 * @param {Array<Object>} environments - List of known environments
 * @returns {boolean} True if path is found
 */
function isPathInKnownEnvironments(absolutePath, environments) {
  return environments.some((env) => {
    const key = Object.keys(env)[0]
    return env[key].path === absolutePath
  })
}

/**
 * Formats environments as a list for logging
 * @param {Array<Object>} environments - List of environments
 * @returns {[string]} List of strings
 */
function formatEnvironmentsAsList(environments) {
  return environments.map((env) => {
    const key = Object.keys(env)[0]
    return `${key}: id: '${env[key].id}', path: '${env[key].path}'`
  })
  // .join("\n")
}

module.exports = {
  getPythonApi,
  refreshPythonEnvironments,
  switchPythonEnvironment,
  isPathInKnownEnvironments,
  formatEnvironmentsAsList,
  resolvePythonEnvironment,
  validateStartingPythonInterpreter,
}
