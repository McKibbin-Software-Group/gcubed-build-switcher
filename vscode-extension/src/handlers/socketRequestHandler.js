"use strict"

const { switchInterpreter } = require("./interpreterHandler")

/**
 * Handles incoming socket requests and routes to appropriate handlers
 * @param {string} messageJson - Raw JSON message from client
 * @param {Function} sendResponse - Callback to send response to client
 */
async function handleSocketRequest(messageJson, sendResponse) {
  try {
    const requestData = JSON.parse(messageJson)
    console.log(`Socket server received message: ${JSON.stringify(requestData)}`)

    // Extract action and handle accordingly
    const action = requestData.action || ""

    if (action === "set-interpreter") {
      await handleSetInterpreterAction(requestData, sendResponse)
    } else {
      // Unsupported action
      sendResponse(
        JSON.stringify({
          success: false,
          error: `Unsupported action: ${action}`,
        })
      )
    }
  } catch (error) {
    console.error("Error handling socket message:", error)
    sendResponse(
      JSON.stringify({
        success: false,
        error: `Failed to process request: ${error.message}`,
      })
    )
  }
}

/**
 * Handles the set-interpreter action
 * @param {Object} requestData - Parsed request data
 * @param {Function} sendResponse - Callback to send response to client
 */
async function handleSetInterpreterAction(requestData, sendResponse) {
  if (!requestData.pythonPath) {
    sendResponse(
      JSON.stringify({
        success: false,
        error: "Missing required parameter: pythonPath",
      })
    )
    return
  }

  // Call core interpreter switching logic directly
  const result = await switchInterpreter(requestData.pythonPath, requestData.shortName)

  // Send the result directly - no HTTP conversion needed
  sendResponse(JSON.stringify(result))
}

module.exports = { handleSocketRequest }
