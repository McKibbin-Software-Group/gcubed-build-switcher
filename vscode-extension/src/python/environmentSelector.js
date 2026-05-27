/**
 * @fileoverview Adapter for selecting Python environments in VS Code.
 * Hides the concrete Microsoft extension API behind a small switcher-focused
 * interface so the Python Environments extension can be added without changing
 * socket handling or interpreter request validation.
 */

"use strict"

const vscode = require("vscode")
const { delay } = require("../utils/common")
const {
  getPythonApi,
  refreshPythonEnvironments,
  switchPythonEnvironment,
  formatEnvironmentsAsList,
  resolvePythonEnvironment,
  validateStartingPythonInterpreter,
} = require("./pythonExtension")

const PYTHON_ENVS_EXTENSION_ID = "ms-python.vscode-python-envs"
const LEGACY_PYTHON_EXTENSION_ID = "ms-python.python"
const PYTHON_ENVS_SELECTION_RETRY = Object.freeze({
  maxAttempts: 3,
  initialDelayMs: 500,
  backoffMultiplier: 2,
})

/**
 * Creates the default Python environment selector.
 *
 * Prefers ms-python.vscode-python-envs and falls back to the legacy
 * ms-python.python API when the new extension is unavailable, disabled, or
 * cannot select the requested interpreter.
 *
 * @returns {EnvironmentSelector}
 */
function createEnvironmentSelector() {
  return createFallbackEnvironmentSelector({
    primarySelector: createPythonEnvsEnvironmentSelector(),
    fallbackSelector: createLegacyPythonEnvironmentSelector(),
  })
}

/**
 * @typedef {Object} EnvironmentSelectionResult
 * @property {string} apiId - Concrete selector API that produced this result
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
 * Creates a selector that tries a primary implementation before falling back.
 *
 * @param {Object} dependencies
 * @param {EnvironmentSelector} dependencies.primarySelector
 * @param {EnvironmentSelector} dependencies.fallbackSelector
 * @returns {EnvironmentSelector}
 */
function createFallbackEnvironmentSelector({ primarySelector, fallbackSelector }) {
  return {
    apiId: `${primarySelector.apiId}->${fallbackSelector.apiId}`,

    async selectInterpreter(absolutePath, displayName) {
      try {
        const primaryResult = withSelectionApiId(
          await primarySelector.selectInterpreter(absolutePath, displayName),
          primarySelector.apiId
        )
        if (primaryResult.resolvedEnvironmentAfterSwitch !== undefined) {
          return primaryResult
        }
        console.warn(
          `${primarySelector.apiId} did not resolve the selected interpreter after switching; falling back to ${fallbackSelector.apiId}`
        )
      } catch (error) {
        console.warn(
          `${primarySelector.apiId} unavailable or failed; falling back to ${fallbackSelector.apiId}:`,
          error
        )
      }

      const fallbackResult = await fallbackSelector.selectInterpreter(absolutePath, displayName)
      return withSelectionApiId(fallbackResult, fallbackSelector.apiId)
    },

    async validateStartingInterpreter() {
      try {
        return await primarySelector.validateStartingInterpreter()
      } catch (error) {
        console.warn(
          `${primarySelector.apiId} unavailable during startup validation; falling back to ${fallbackSelector.apiId}:`,
          error
        )
        return fallbackSelector.validateStartingInterpreter()
      }
    },

    formatKnownEnvironments(knownEnvironments) {
      return formatKnownEnvironmentList(knownEnvironments || [])
    },

    getFirstEnvironmentPathContaining,
  }
}

/**
 * Wraps the Python Environments extension API in the selector interface.
 *
 * @param {Object} [dependencies] Injectable dependencies for unit tests.
 * @returns {EnvironmentSelector}
 */
function createPythonEnvsEnvironmentSelector({
  getApi = getPythonEnvsApi,
  getWorkspaceScope = getDefaultWorkspaceScope,
  uriFile = (filePath) => vscode.Uri.file(filePath),
  pathsMatch = areSamePath,
  wait = delay,
  selectionRetry = PYTHON_ENVS_SELECTION_RETRY,
} = {}) {
  return {
    apiId: PYTHON_ENVS_EXTENSION_ID,

    async selectInterpreter(absolutePath, displayName) {
      const pythonEnvsApi = await getApi()
      const scope = getWorkspaceScope()
      const interpreterUri = uriFile(absolutePath)
      const retryOptions = normalizeSelectionRetryOptions(selectionRetry)

      const selectionResult = await selectPythonEnvsInterpreterWithRetry({
        pythonEnvsApi,
        scope,
        interpreterUri,
        absolutePath,
        displayName,
        pathsMatch,
        wait,
        retryOptions,
      })
      return withSelectionApiId(selectionResult, PYTHON_ENVS_EXTENSION_ID)
    },

    async validateStartingInterpreter() {
      const pythonEnvsApi = await getApi()
      const scope = getWorkspaceScope()

      await pythonEnvsApi.refreshEnvironments(undefined)
      const knownVenvs = await pythonEnvsApi.getEnvironments("all")
      const activeEnvironment = await pythonEnvsApi.getEnvironment(scope)
      const activeInterpreterPath = getEnvironmentPath(activeEnvironment) || "none"

      if (activeEnvironment && activeInterpreterPath !== "none") {
        return { success: true, path: activeInterpreterPath, knownVenvs }
      }

      return { success: false, path: activeInterpreterPath, knownVenvs }
    },

    formatKnownEnvironments(knownEnvironments) {
      return formatKnownEnvironmentList(knownEnvironments || [])
    },

    getFirstEnvironmentPathContaining,
  }
}

async function selectPythonEnvsInterpreterWithRetry({
  pythonEnvsApi,
  scope,
  interpreterUri,
  absolutePath,
  displayName,
  pathsMatch,
  wait,
  retryOptions,
}) {
  let lastResult

  for (let attemptNumber = 1; attemptNumber <= retryOptions.maxAttempts; attemptNumber++) {
    lastResult = await selectPythonEnvsInterpreterOnce({
      pythonEnvsApi,
      scope,
      interpreterUri,
      absolutePath,
      pathsMatch,
    })

    if (lastResult.resolvedEnvironmentAfterSwitch !== undefined) {
      return lastResult
    }

    if (attemptNumber < retryOptions.maxAttempts) {
      const retryReason =
        lastResult.resolvedEnvironmentBeforeSwitch === undefined
          ? "could not resolve the requested interpreter"
          : "could not verify the selected interpreter"
      const retryDelayMs = getSelectionRetryDelayMs(attemptNumber, retryOptions)
      console.warn(
        `${PYTHON_ENVS_EXTENSION_ID} ${retryReason} on attempt ${attemptNumber}/${retryOptions.maxAttempts}; retrying in ${retryDelayMs}ms`
      )
      if (retryDelayMs > 0) {
        await wait(retryDelayMs)
      }
    }
  }

  if (!lastResult || lastResult.resolvedEnvironmentBeforeSwitch === undefined) {
    throw new Error(`Python Environments could not resolve '${displayName || absolutePath}' at ${absolutePath}`)
  }

  return lastResult
}

async function selectPythonEnvsInterpreterOnce({ pythonEnvsApi, scope, interpreterUri, absolutePath, pathsMatch }) {
  await pythonEnvsApi.refreshEnvironments(undefined)
  const knownEnvironmentsBeforeSwitch = await pythonEnvsApi.getEnvironments("all")
  const resolvedEnvironmentBeforeSwitch = await pythonEnvsApi.resolveEnvironment(interpreterUri)

  if (!resolvedEnvironmentBeforeSwitch) {
    return {
      knownEnvironmentsBeforeSwitch,
      resolvedEnvironmentBeforeSwitch,
      knownEnvironmentsAfterSwitch: knownEnvironmentsBeforeSwitch,
      resolvedEnvironmentAfterSwitch: undefined,
    }
  }

  await pythonEnvsApi.setEnvironment(scope, resolvedEnvironmentBeforeSwitch)

  await pythonEnvsApi.refreshEnvironments(undefined)
  const knownEnvironmentsAfterSwitch = await pythonEnvsApi.getEnvironments("all")
  const selectedEnvironment = await pythonEnvsApi.getEnvironment(scope)
  const selectedInterpreterPath = getEnvironmentPath(selectedEnvironment)
  const resolvedEnvironmentAfterSwitch =
    selectedInterpreterPath && pathsMatch(selectedInterpreterPath, absolutePath) ? selectedEnvironment : undefined

  return {
    knownEnvironmentsBeforeSwitch,
    resolvedEnvironmentBeforeSwitch,
    knownEnvironmentsAfterSwitch,
    resolvedEnvironmentAfterSwitch,
  }
}

function withSelectionApiId(selectionResult, apiId) {
  return {
    ...selectionResult,
    apiId: selectionResult.apiId || apiId,
  }
}

function normalizeSelectionRetryOptions(selectionRetry) {
  const options = selectionRetry || {}
  return {
    maxAttempts: getPositiveInteger(options.maxAttempts, PYTHON_ENVS_SELECTION_RETRY.maxAttempts),
    initialDelayMs: getNonNegativeNumber(options.initialDelayMs, PYTHON_ENVS_SELECTION_RETRY.initialDelayMs),
    backoffMultiplier: Math.max(
      1,
      getNonNegativeNumber(options.backoffMultiplier, PYTHON_ENVS_SELECTION_RETRY.backoffMultiplier)
    ),
  }
}

function getSelectionRetryDelayMs(attemptNumber, retryOptions) {
  return Math.round(
    retryOptions.initialDelayMs * Math.pow(retryOptions.backoffMultiplier, Math.max(0, attemptNumber - 1))
  )
}

function getPositiveInteger(value, fallback) {
  return Number.isInteger(value) && value > 0 ? value : fallback
}

function getNonNegativeNumber(value, fallback) {
  return Number.isFinite(value) && value >= 0 ? value : fallback
}

let cachedPythonEnvsApi

/**
 * Retrieves the Python Environments extension API.
 *
 * @param {Object} [dependencies] Injectable dependencies for unit tests.
 * @param {Object} [dependencies.extensions] VS Code extensions namespace.
 * @returns {Promise<Object>} Python Environments extension API.
 */
async function getPythonEnvsApi({ extensions = vscode.extensions } = {}) {
  if (cachedPythonEnvsApi) {
    return cachedPythonEnvsApi
  }

  const pythonEnvsExtension = extensions.getExtension(PYTHON_ENVS_EXTENSION_ID)
  if (!pythonEnvsExtension) {
    throw new Error("Python Environments extension not found")
  }

  const activationResult = pythonEnvsExtension.isActive ? undefined : await pythonEnvsExtension.activate()
  const pythonEnvsApi = pythonEnvsExtension.exports || activationResult
  validatePythonEnvsApi(pythonEnvsApi)
  cachedPythonEnvsApi = pythonEnvsApi
  return cachedPythonEnvsApi
}

/**
 * Validates the small subset of Python Environments API used by the switcher.
 *
 * @param {Object} pythonEnvsApi
 * @throws {Error} when the API is unavailable or incompatible.
 */
function validatePythonEnvsApi(pythonEnvsApi) {
  const requiredFunctions = [
    "refreshEnvironments",
    "getEnvironments",
    "resolveEnvironment",
    "setEnvironment",
    "getEnvironment",
  ]

  if (!pythonEnvsApi) {
    throw new Error("Python Environments extension API unavailable")
  }

  const missingFunctions = requiredFunctions.filter(
    (functionName) => typeof pythonEnvsApi[functionName] !== "function"
  )
  if (missingFunctions.length > 0) {
    throw new Error(`Python Environments extension API missing: ${missingFunctions.join(", ")}`)
  }
}

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
    apiId: LEGACY_PYTHON_EXTENSION_ID,

    async selectInterpreter(absolutePath, displayName) {
      const pythonApi = await getApi()

      const knownEnvironmentsBeforeSwitch = await refreshEnvironments(pythonApi)
      const resolvedEnvironmentBeforeSwitch = await resolveEnvironment(pythonApi, absolutePath, displayName)

      await switchEnvironment(pythonApi, absolutePath)

      const knownEnvironmentsAfterSwitch = await refreshEnvironments(pythonApi)
      const resolvedEnvironmentAfterSwitch = await resolveEnvironment(pythonApi, absolutePath, displayName)

      return {
        apiId: LEGACY_PYTHON_EXTENSION_ID,
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
 * objects are also accepted. For Python Environments API objects, this prefers
 * `execInfo.run.executable` over `environmentPath` because `environmentPath`
 * may be the venv directory rather than the interpreter binary.
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

  if (environment.execInfo && environment.execInfo.run && typeof environment.execInfo.run.executable === "string") {
    return environment.execInfo.run.executable
  }

  if (environment.internal && typeof environment.internal.path === "string") {
    return environment.internal.path
  }

  const environmentPath = getUriPath(environment.environmentPath)
  if (environmentPath) {
    return environmentPath
  }

  for (const value of Object.values(environment)) {
    if (value && typeof value.path === "string") {
      return value.path
    }
  }

  return undefined
}

/**
 * Formats mixed environment shapes for diagnostics.
 *
 * @param {Array<Object>} environments
 * @returns {Array<string>}
 */
function formatKnownEnvironmentList(environments) {
  if (!Array.isArray(environments)) {
    return []
  }

  return environments.map((environment) => {
    const path = getEnvironmentPath(environment) || "unknown"
    const id = getEnvironmentId(environment) || "unknown"
    return `${id}: path: '${path}'`
  })
}

/**
 * Extracts an environment identifier from known Microsoft API shapes.
 *
 * @param {Object} environment
 * @returns {string|undefined}
 */
function getEnvironmentId(environment) {
  if (!environment || typeof environment !== "object") {
    return undefined
  }

  if (typeof environment.id === "string") {
    return environment.id
  }

  if (environment.envId) {
    if (typeof environment.envId === "string") {
      return environment.envId
    }
    if (typeof environment.envId.id === "string" && typeof environment.envId.managerId === "string") {
      return `${environment.envId.managerId}:${environment.envId.id}`
    }
    if (typeof environment.envId.id === "string") {
      return environment.envId.id
    }
  }

  const keys = Object.keys(environment)
  if (keys.length === 1 && environment[keys[0]] && typeof environment[keys[0]] === "object") {
    return keys[0]
  }

  return undefined
}

/**
 * Gets the best default scope for project/workspace environment selection.
 *
 * @returns {import("vscode").Uri|undefined}
 */
function getDefaultWorkspaceScope() {
  if (!vscode.workspace.workspaceFolders || !vscode.workspace.workspaceFolders.length) {
    return undefined
  }
  return vscode.workspace.workspaceFolders[0].uri
}

/**
 * Extracts a filesystem path from a VS Code URI-like object.
 *
 * @param {Object} uri
 * @returns {string|undefined}
 */
function getUriPath(uri) {
  if (!uri || typeof uri !== "object") {
    return undefined
  }
  if (typeof uri.fsPath === "string") {
    return uri.fsPath
  }
  if (typeof uri.path === "string") {
    return uri.path
  }
  return undefined
}

/**
 * Compares filesystem paths after light normalization.
 *
 * @param {string} left
 * @param {string} right
 * @returns {boolean}
 */
function areSamePath(left, right) {
  return trimTrailingPathSeparator(left) === trimTrailingPathSeparator(right)
}

function trimTrailingPathSeparator(filePath) {
  return filePath.replace(/[\\/]+$/, "")
}

module.exports = {
  PYTHON_ENVS_EXTENSION_ID,
  LEGACY_PYTHON_EXTENSION_ID,
  createEnvironmentSelector,
  createFallbackEnvironmentSelector,
  createPythonEnvsEnvironmentSelector,
  createLegacyPythonEnvironmentSelector,
  getPythonEnvsApi,
  validatePythonEnvsApi,
  getFirstEnvironmentPathContaining,
  getEnvironmentPath,
  getEnvironmentId,
  formatKnownEnvironmentList,
}
