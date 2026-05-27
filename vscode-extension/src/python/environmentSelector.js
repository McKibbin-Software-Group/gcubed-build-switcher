/**
 * @fileoverview Adapter for selecting Python environments in VS Code.
 * Hides the concrete Microsoft extension API behind a small switcher-focused
 * interface so the Python Environments extension can be added without changing
 * socket handling or interpreter request validation.
 */

"use strict"

const {
  getPythonApi,
  refreshPythonEnvironments,
  switchPythonEnvironment,
  formatEnvironmentsAsList,
  resolvePythonEnvironment,
  validateStartingPythonInterpreter,
} = require("./pythonExtension")

/**
 * Creates the default Python environment selector.
 *
 * The first implementation preserves the existing ms-python.python behavior.
 * A later slice can prefer ms-python.vscode-python-envs here and fall back to
 * this legacy selector when the new API is unavailable or cannot select the
 * requested interpreter.
 *
 * @returns {EnvironmentSelector}
 */
function createEnvironmentSelector() {
  return createLegacyPythonEnvironmentSelector()
}

/**
 * @typedef {Object} EnvironmentSelectionResult
 * @property {Array<Object>} knownEnvironmentsBeforeSwitch
 * @property {Object|undefined} resolvedEnvironmentBeforeSwitch
 * @property {Array<Object>} knownEnvironmentsAfterSwitch
 * @property {Object|undefined} resolvedEnvironmentAfterSwitch
 */

/**
 * @typedef {Object} EnvironmentSelector
 * @property {string} apiId
 * @property {(absolutePath: string, displayName?: string) => Promise<EnvironmentSelectionResult>} selectInterpreter
 * @property {() => Promise<Object>} validateStartingInterpreter
 * @property {(knownEnvironments: Array<Object>) => Array<string>} formatKnownEnvironments
 * @property {(knownEnvironments: Array<Object>, pathFragment: string) => string|undefined} getFirstEnvironmentPathContaining
 */

/**
 * Wraps the legacy ms-python.python environment API in the selector interface.
 *
 * @param {Object} [dependencies] Injectable dependencies for unit tests.
 * @returns {EnvironmentSelector}
 */
function createLegacyPythonEnvironmentSelector({
  getApi = getPythonApi,
  refreshEnvironments = refreshPythonEnvironments,
  switchEnvironment = switchPythonEnvironment,
  resolveEnvironment = resolvePythonEnvironment,
  validateStartingInterpreter = validateStartingPythonInterpreter,
  formatEnvironments = formatEnvironmentsAsList,
} = {}) {
  return {
    apiId: "ms-python.python",

    async selectInterpreter(absolutePath, displayName) {
      const pythonApi = await getApi()

      const knownEnvironmentsBeforeSwitch = await refreshEnvironments(pythonApi)
      const resolvedEnvironmentBeforeSwitch = await resolveEnvironment(pythonApi, absolutePath, displayName)

      await switchEnvironment(pythonApi, absolutePath)

      const knownEnvironmentsAfterSwitch = await refreshEnvironments(pythonApi)
      const resolvedEnvironmentAfterSwitch = await resolveEnvironment(pythonApi, absolutePath, displayName)

      return {
        knownEnvironmentsBeforeSwitch,
        resolvedEnvironmentBeforeSwitch,
        knownEnvironmentsAfterSwitch,
        resolvedEnvironmentAfterSwitch,
      }
    },

    async validateStartingInterpreter() {
      const pythonApi = await getApi()
      return validateStartingInterpreter(pythonApi)
    },

    formatKnownEnvironments(knownEnvironments) {
      return formatEnvironments(knownEnvironments || [])
    },

    getFirstEnvironmentPathContaining,
  }
}

/**
 * Gets the first known environment path containing the requested fragment.
 *
 * Supports both legacy Python extension shapes seen in this codebase:
 * `{ internal: { path } }` and `{ "<id>": { path } }`. Direct `{ path }`
 * objects are also accepted to make the later Python Environments adapter
 * easier to normalize.
 *
 * @param {Array<Object>} knownEnvironments
 * @param {string} pathFragment
 * @returns {string|undefined}
 */
function getFirstEnvironmentPathContaining(knownEnvironments, pathFragment) {
  if (!Array.isArray(knownEnvironments) || !pathFragment) {
    return undefined
  }

  for (const environment of knownEnvironments) {
    const environmentPath = getEnvironmentPath(environment)
    if (environmentPath && environmentPath.includes(pathFragment)) {
      return environmentPath
    }
  }

  return undefined
}

/**
 * Extracts an interpreter/environment path from known Microsoft API shapes.
 *
 * @param {Object} environment
 * @returns {string|undefined}
 */
function getEnvironmentPath(environment) {
  if (!environment || typeof environment !== "object") {
    return undefined
  }

  if (typeof environment.path === "string") {
    return environment.path
  }

  if (environment.internal && typeof environment.internal.path === "string") {
    return environment.internal.path
  }

  for (const value of Object.values(environment)) {
    if (value && typeof value.path === "string") {
      return value.path
    }
  }

  return undefined
}

module.exports = {
  createEnvironmentSelector,
  createLegacyPythonEnvironmentSelector,
  getFirstEnvironmentPathContaining,
  getEnvironmentPath,
}
