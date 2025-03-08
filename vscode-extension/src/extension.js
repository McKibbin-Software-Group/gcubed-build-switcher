"use strict"
const http = require("http")
const vscode = require("vscode")
const path = require("path")
const pythonExt = require("@vscode/python-extension")

// Extract what we need from modules
const { createServer } = http
const { window, workspace, extensions } = vscode
const { resolve } = path
const { PythonExtension } = pythonExt

// HTTP constants
const CONTENT_TYPE_JSON = "application/json"
const HTTP_OK = 200
const HTTP_BAD_REQUEST = 400
const HTTP_NOT_FOUND = 404
const HTTP_UNPROCESSABLE_ENTITY = 422
const HTTP_SERVER_ERROR = 500

// Diagnostic
const EXTENSION_LOAD_TIME = Date.now()
console.log("G-Cubed venv switcher extension loaded at:", new Date().toISOString())

// Needs to be in global context as shared between activate & deactivate
let server

async function activate(context) {
  const activationTime = Date.now()
  const loadToActivateTime = activationTime - EXTENSION_LOAD_TIME
  console.log(`G-Cubed venv switcher extension activated (took ${loadToActivateTime}ms since load)`)

  // Do we even care - our job is to expose a listener and talk to the python extension
  // if (!workspace.workspaceFolders || workspace.workspaceFolders.length === 0) {
  //   const msg = "No workspace folder open"
  //   console.error(msg)
  //   window.showErrorMessage(msg)
  //   return
  // }

  console.log("Starting server...")

  // create server to serve requests on the API port and route
  server = createServer(async (req, res) => {
    if (req.method === "POST" && req.url === "/set-interpreter") {
      handleSetInterpreterRequest(req, res)
    } else {
      console.error(`Endpoint not found: ${req.method} ${req.url}`)
      sendJsonResponse(res, HTTP_NOT_FOUND, {
        success: false,
        error: "Endpoint not found",
      })
    }
  })

  // Subscribe to error events & report them
  server.on("error", (err) => {
    console.error("Server error:", err)
    window.showErrorMessage(`Server error: ${err.message}`)
  })

  // start the server listening on configured address/port with fallback defaults
  const { localPort = 9876, hostIP = "127.0.0.1" } = getExtensionConfiguration()
  server.listen(localPort, hostIP, () => {
    console.log(`Interpreter switcher server listening on ${hostIP}:${localPort}`)
  })

  context.subscriptions.push({ dispose: () => server.close() })

  const activationMessage = "G-Cubed venv switcher extension activated"
  console.log(`${activationMessage} on ${hostIP}:${localPort}`)
  window.showInformationMessage(activationMessage)
}

// Main request handler for the /set-interpreter endpoint
function handleSetInterpreterRequest(req, res) {
  let body = ""
  req.on("data", (chunk) => (body += chunk.toString()))
  req.on("end", async () => {
    try {
      // Step 1: Parse and validate request body
      const parsedBody = await parseRequestBody(body)
      if (!isValidRequest(parsedBody)) {
        console.error("Invalid request: missing pythonPath parameter")
        sendJsonResponse(res, HTTP_BAD_REQUEST, {
          success: false,
          error: "Missing required parameter: pythonPath",
        })
        return
      }

      // Step 2: Extract and validate pythonPath parameter
      const { pythonPath: requestedPythonPath, shortName: shortVenvName } = parsedBody
      if (!isValidPathString(requestedPythonPath)) {
        console.error("Invalid request: pythonPath must be a non-empty string")
        sendJsonResponse(res, HTTP_BAD_REQUEST, {
          success: false,
          error: "pythonPath must be a non-empty string",
        })
        return
      }

      // Step 3: Resolve absolute path
      const absolutePythonPath = resolveAbsolutePath(requestedPythonPath)
      console.info(`Received request for interpreter: ${requestedPythonPath}, will set to: ${absolutePythonPath}`)

      try {
        // Step 4: Get Python environments and validate path. Throws exception within
        // about 1.5s if Python extension isn't available or can't be (re)activated
        await checkForAndAttemptActivatePythonExtension({ maxRetries: 3, delayMs: 500 })
        const pythonApi = await PythonExtension.api()

        // Force a refresh of the environments
        console.info("Forcing refresh of Python Environments...")
        await pythonApi.environments.refreshEnvironments({ forceRefresh: true })
        let knownEnvironments = pythonApi.environments.known

        console.info("Known environments before switching:")
        console.info(formatEnvironmentsAsList(knownEnvironments))

        // Step 5: Check if path exists in known environments. Retry if not
        if (!isPathInKnownEnvironments(absolutePythonPath, knownEnvironments)) {
          // give it a second to catch up
          console.warn(`Path not found in known environments, forcing refresh & retrying after 1s: ${absolutePythonPath}`)
          await delay(1000)
          await pythonApi.environments.refreshEnvironments({ forceRefresh: true })
          knownEnvironments = pythonApi.environments.known
          console.warn("Retrying after second force refresh. Fingers crossed!")
        }

        if (!isPathInKnownEnvironments(absolutePythonPath, knownEnvironments)) {
          const knownEnvironmentsString = formatEnvironmentsAsList(knownEnvironments)
          const message = `Cannot switch to '${requestedPythonPath}' - not found in available Python environments`

          console.error(`${message}\nKnown environments:\n${knownEnvironmentsString}`)
          window.showErrorMessage(message)
          sendJsonResponse(res, HTTP_BAD_REQUEST, {
            success: false,
            error: message,
            requestedPath: absolutePythonPath,
            knownEnvironments: knownEnvironmentsString,
          })
          return
        }

        // Step 6: Switch Python environment
        console.info("Switching environments...")
        await switchPythonEnvironment(pythonApi, absolutePythonPath, requestedPythonPath, shortVenvName)

        console.info("Forcing refresh...")
        await pythonApi.environments.refreshEnvironments({
          forceRefresh: true,
        })
        knownEnvironments = pythonApi.environments.known

        console.info("Known environments after switching:")
        console.info(formatEnvironmentsAsList(knownEnvironments))

        sendJsonResponse(res, HTTP_OK, {
          success: true,
          requestedPath: requestedPythonPath,
        })
      } catch (err) {
        handlePythonApiError(err, res)
      }
    } catch (error) {
      handleGeneralError(error, res)
    }
  })
}

// Helper functions
async function parseRequestBody(body) {
  return JSON.parse(body)
}

function isValidRequest(parsedBody) {
  return parsedBody && parsedBody.pythonPath
}

function isValidPathString(path) {
  return typeof path === "string" && path.trim() !== ""
}

function resolveAbsolutePath(requestedPythonPath) {
  return resolve(workspace.workspaceFolders[0].uri.fsPath, requestedPythonPath)
}

function isPathInKnownEnvironments(absolutePath, environments) {
  return environments.some((env) => {
    const key = Object.keys(env)[0]
    return env[key].path === absolutePath
  })
}

function formatEnvironmentsAsList(environments) {
  return environments
    .map((env) => {
      const key = Object.keys(env)[0]
      return `${key}: id: '${env[key].id}', path: '${env[key].path}'`
    })
    .join("\n")
}

async function switchPythonEnvironment(pythonApi, absolutePath, requestedPath, shortVenvName) {
  const message = `Switching venv to: '${shortVenvName || requestedPath}'`
  console.log(message)
  window.showInformationMessage(message)
  return await pythonApi.environments.updateActiveEnvironmentPath(absolutePath)
}

function handlePythonApiError(err, res) {
  console.error("Error using Python API:", err)

  const errorMessage = `Failed to get Python interpreter. Check that the MS Python extension is loaded, enabled, and activated. Error from API: ${err.message || String(err)}`
  window.showErrorMessage(errorMessage)
  sendJsonResponse(res, HTTP_SERVER_ERROR, {
    success: false,
    error: errorMessage,
  })
}

function handleGeneralError(error, res) {
  console.error("Error in request handler:", error)

  const errorMessage = `Error in request handler: ${err.message || String(err)}`
  window.showErrorMessage(errorMessage)
  sendJsonResponse(res, HTTP_SERVER_ERROR, {
    success: false,
    error: errorMessage,
  })
}

function sendJsonResponse(res, statusCode, data) {
  res.writeHead(statusCode, { "Content-Type": CONTENT_TYPE_JSON })
  res.end(JSON.stringify(data))
}

/**
 * Creates a Promise that resolves after a specified delay
 *
 * @param {number} ms - Delay in milliseconds
 * @returns {Promise<void>} Promise that resolves after the specified delay
 */
function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Ensures the Python extension is available and active
 * @param {Object} [options] - Configuration options
 * @param {number} [options.maxRetries=5] - Maximum number of retry attempts to find the extension
 * @param {number} [options.delayMs=3000] - Delay between retries in milliseconds
 * @returns {Promise<vscode.Extension<any>>} The activated Python extension
 * @throws {Error} When the extension cannot be found after retries
 * @throws {Error} When the extension fails to activate
 */
async function checkForAndAttemptActivatePythonExtension({ maxRetries = 5, delayMs = 3000 } = {}) {
  // Test if the python extension is active and try to activate it if not
  console.info("Checking Python extension...")
  const pythonExtension = await getPythonExtensionWithRetry({ maxRetries, delayMs })
  if (!pythonExtension)
    throw createAndReportError(
      "Python extension not found after multiple attempts. Please ensure it's installed and reload the window."
    )

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
 * @returns {Promise<vscode.Extension<any> | undefined>} - The Python extension or null if not found after retries
 */
async function getPythonExtensionWithRetry({ maxRetries = 0, delayMs = 3000 } = {}) {
  let retryCount = 0
  let pythonExtension = extensions.getExtension("ms-python.python")
  console.info("Got Python extension: ", pythonExtension)

  while (!pythonExtension && retryCount < maxRetries) {
    console.warn(`Python extension not found, retrying (${retryCount + 1}/${maxRetries})...`)
    await delay(delayMs)
    pythonExtension = extensions.getExtension("ms-python.python")
    retryCount++
  }
  return pythonExtension
}

function createAndReportError(message) {
  console.error(message)
  window.showErrorMessage(message)
  return new Error(message)
}

/**
 * Gets extension configuration with defaults
 * @returns {Object} Configuration values
 */
function getExtensionConfiguration() {
  const config = workspace.getConfiguration("gcubedVenvSwitcher")
  return {
    localPort: config.get("localPort"),
    hostIP: config.get("hostIP"),
  }
}

function deactivate() {
  if (server) {
    const message = "G-Cubed venv switcher extension deactivated"
    console.log(message)
    window.showInformationMessage(message)
    server.close()
    server = undefined
  }
}

// Export the functions using CommonJS
module.exports = { activate, deactivate }
