"use strict"
const http = require("http")
const vscode = require("vscode")
const path = require("path")
const pythonExt = require("@vscode/python-extension")

// Extract what we need from modules
const { createServer } = http
const { window, workspace } = vscode
const { resolve } = path
const { PythonExtension } = pythonExt

// HTTP constants
const CONTENT_TYPE_JSON = "application/json"
const HTTP_OK = 200
const HTTP_BAD_REQUEST = 400
const HTTP_NOT_FOUND = 404
const HTTP_UNPROCESSABLE_ENTITY = 422
const HTTP_SERVER_ERROR = 500

let server

async function activate(context) {
  if (!workspace.workspaceFolders || workspace.workspaceFolders.length === 0) {
    const msg = "No workspace folder open"
    console.error(msg)
    window.showErrorMessage(msg)
    return
  }

  // Just in case, make sure the python extension is running
  const pythonExtension = await getPythonExtensionWithRetry({ maxRetries: 5, delayMs: 3000 })
  if (!pythonExtension) {
    vscode.window.showErrorMessage(
      "Python extension not found after multiple attempts. Please ensure it's installed and reload the window."
    )
    return
  }
  if (!pythonExtension.isActive) {
    console.log("Waiting for Python extension to activate...")
    await pythonExtension.activate()
    console.log("Python extension activated")
  }

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
  const { localPort = 9876, hostIP = "127.0.0.1" } = getExtensionConfiguration();
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
      const { pythonPath: requestedPythonPath } = parsedBody
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
      console.log(`Received request for interpreter: ${requestedPythonPath}, will set to: ${absolutePythonPath}`)

      try {
        // Step 4: Get Python environments and validate path
        const pythonApi = await PythonExtension.api()

        // Force a refresh of the environments
        await pythonApi.environments.refreshEnvironments({ forceRefresh: true })
        let knownEnvironments = pythonApi.environments.known

        console.log("Known environments before switching:")
        console.log(formatEnvironmentsAsList(knownEnvironments))

        // Step 5: Check if path exists in known environments. Retry if not
        if (!isPathInKnownEnvironments(absolutePythonPath, knownEnvironments)) {
          // give it a second to catch up
          console.warn(`Path not found in known environments, retrying after 1s: ${absolutePythonPath}`)
          await delay(1000)
          await pythonApi.environments.refreshEnvironments({ forceRefresh: true })
          knownEnvironments = pythonApi.environments.known
          console.log("Retrying after second force refresh. Fingers crossed!")
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
        await switchPythonEnvironment(pythonApi, absolutePythonPath, requestedPythonPath)

        await pythonApi.environments.refreshEnvironments({ forceRefresh: true })
        knownEnvironments = pythonApi.environments.known

        console.log("Known environments after switching:")
        console.log(formatEnvironmentsAsList(knownEnvironments))

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

async function switchPythonEnvironment(pythonApi, absolutePath, requestedPath) {
  const message = `Switching venv to: '${requestedPath}'`
  console.log(message)
  window.showInformationMessage(message)
  return await pythonApi.environments.updateActiveEnvironmentPath(absolutePath)
}

function handlePythonApiError(err, res) {
  const errorMessage = `Failed to get Python interpreter: ${err.message || String(err)}`
  console.error("Error using Python API:", err)
  window.showErrorMessage(errorMessage)
  sendJsonResponse(res, HTTP_SERVER_ERROR, {
    success: false,
    error: errorMessage,
  })
}

function handleGeneralError(error, res) {
  console.error("Error in request handler:", error)
  sendJsonResponse(res, HTTP_SERVER_ERROR, {
    success: false,
    error: String(error),
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
 * Attempts to get the Python extension with multiple retries
 * @param {Object} options - Options for retry attempts
 * @param {number} options.maxRetries - Maximum number of retry attempts
 * @param {number} options.delayMs - Delay between retries in milliseconds
 * @returns {Promise<any>} - The Python extension or null if not found after retries
 */
async function getPythonExtensionWithRetry({ maxRetries = 5, delayMs = 3000 } = {}) {
  let retryCount = 0
  let pythonExtension = vscode.extensions.getExtension("ms-python.python")
  console.log("Got Python extension: ", pythonExtension)

  while (!pythonExtension && retryCount < maxRetries) {
    console.log(`Python extension not found, retrying (${retryCount + 1}/${maxRetries})...`)
    await delay(delayMs)
    pythonExtension = vscode.extensions.getExtension("ms-python.python")
    retryCount++
  }

  return pythonExtension
}

/**
 * Gets extension configuration with defaults
 * @returns {Object} Configuration values
 */
function getExtensionConfiguration() {
  const config = workspace.getConfiguration('gcubedVenvSwitcher');
  return {
    localPort: config.get('localPort'),
    hostIP: config.get('hostIP')
  };
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
