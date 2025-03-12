"use strict"
const vscode = require("vscode")
const path = require("path")
const { HTTP } = require("../utils/constants")
const { sendJsonResponse } = require("../utils/http")
const { delay } = require("../utils/common")
const {
  getPythonApi,
  refreshPythonEnvironments,
  switchPythonEnvironment,
  isPathInKnownEnvironments,
  formatEnvironmentsAsList
} = require("../python/pythonExtension")

/**
 * Handles an incoming request to switch Python interpreter
 * @param {http.IncomingMessage} req - HTTP request
 * @param {http.ServerResponse} res - HTTP response
 */
function handleInterpreterRequest(req, res) {
  let body = ""
  req.on("data", (chunk) => (body += chunk.toString()))
  req.on("end", async () => {
    try {
      // Parse and validate request
      const parsedBody = JSON.parse(body)

      if (!parsedBody || !parsedBody.pythonPath) {
        console.error("Invalid request: missing pythonPath parameter")
        sendJsonResponse(res, HTTP.STATUS.BAD_REQUEST, {
          success: false,
          error: "Missing required parameter: pythonPath",
        })
        return
      }

      const { pythonPath: requestedPythonPath, shortName: shortVenvName } = parsedBody

      if (typeof requestedPythonPath !== "string" || requestedPythonPath.trim() === "") {
        console.error("Invalid request: pythonPath must be a non-empty string")
        sendJsonResponse(res, HTTP.STATUS.BAD_REQUEST, {
          success: false,
          error: "pythonPath must be a non-empty string",
        })
        return
      }

      // Resolve absolute path
      const absolutePythonPath = resolveAbsolutePath(requestedPythonPath)
      console.info(`Received request for interpreter: ${requestedPythonPath}, will set to: ${absolutePythonPath}`)

      // Process interpreter switching
      await processInterpreterSwitching(absolutePythonPath, requestedPythonPath, shortVenvName, res)
    } catch (error) {
      handleProcessingError(error, res)
    }
  })
}

/**
 * Processes interpreter switching logic
 * @param {string} absolutePath - Absolute path to interpreter
 * @param {string} requestedPath - Original requested path
 * @param {string} shortVenvName - Short display name for the environment
 * @param {http.ServerResponse} res - HTTP response
 */
async function processInterpreterSwitching(absolutePath, requestedPath, shortVenvName, res) {
  try {
    // Get Python API
    const pythonApi = await getPythonApi()

    // Get environments and check if requested interpreter exists
    let knownEnvironments = await refreshPythonEnvironments(pythonApi)
    console.info("Known environments before switching:")
    console.info(formatEnvironmentsAsList(knownEnvironments))

    // Retry once if not found (Python extension might need time to discover)
    if (!isPathInKnownEnvironments(absolutePath, knownEnvironments)) {
      console.warn(`Path not found in known environments, forcing refresh & retrying after 1s: ${absolutePath}`)
      await delay(1000)
      knownEnvironments = await refreshPythonEnvironments(pythonApi)
      console.warn("Retrying after second force refresh. Fingers crossed!")
    }

    // Check again after retry
    if (!isPathInKnownEnvironments(absolutePath, knownEnvironments)) {
      const knownEnvironmentsString = formatEnvironmentsAsList(knownEnvironments)
      const message = `Cannot switch to '${requestedPath}' - not found in available Python environments`

      console.error(`${message}\nKnown environments:\n${knownEnvironmentsString}`)
      vscode.window.showErrorMessage(message)
      sendJsonResponse(res, HTTP.STATUS.BAD_REQUEST, {
        success: false,
        error: message,
        requestedPath: absolutePath,
        knownEnvironments: knownEnvironmentsString,
      })
      return
    }

    // Switch interpreter
    await switchPythonEnvironment(pythonApi, absolutePath, shortVenvName || requestedPath)

    // Refresh and display final state
    knownEnvironments = await refreshPythonEnvironments(pythonApi)
    console.info("Known environments after switching & forced refresh:")
    console.info(formatEnvironmentsAsList(knownEnvironments))

    // Send success response
    sendJsonResponse(res, HTTP.STATUS.OK, {
      success: true,
      requestedPath: requestedPath,
    })
  } catch (error) {
    console.error("Error using Python API:", error)
    const errorMessage = `Failed to get Python interpreter. Check that the MS Python extension is loaded, enabled, and activated. Error from API: ${error.message || String(error)}`

    vscode.window.showErrorMessage(errorMessage)
    sendJsonResponse(res, HTTP.STATUS.SERVER_ERROR, {
      success: false,
      error: errorMessage,
    })
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

/**
 * Handles processing errors
 * @param {Error} error - Error object
 * @param {http.ServerResponse} res - HTTP response
 */
function handleProcessingError(error, res) {
  console.error("Error in request handler:", error)
  const errorMessage = `Error in request handler: ${error.message || String(error)}`

  vscode.window.showErrorMessage(errorMessage)
  sendJsonResponse(res, HTTP.STATUS.SERVER_ERROR, {
    success: false,
    error: errorMessage,
  })
}

module.exports = {
  handleInterpreterRequest
}