/**
 * @fileoverview Handles Unix socket client connections for the Python interpreter switcher
 * Manages connection lifecycle, message parsing, and response handling
 * Implements robust error handling and resource cleanup
 */

"use strict"

const { switchInterpreter } = require("../handlers/interpreterHandler")

const {
  MAX_CONCURRENT_CLIENT_CONNECTIONS,
  MAX_BUFFER_SIZE,
  NULL_BYTE,
  SOCKET_INACTIVITY_TIMEOUT,
  FIRM_SOCKET_CLOSE_TIMEOUT,
  INCOMING_MESSAGE_COMPLETION_TIMEOUT_MS,
  activeConnections,
} = require("../utils/constants")

/**
 * Handles an individual connection lifecycle from acceptance to termination
 * Enforces connection limits, processes requests, and ensures proper cleanup
 *
 * @param {net.Socket} clientSocketConnection - Active client socket connection
 * @returns {Promise<void>}
 */
async function handleClientConnection(clientSocketConnection) {
  // Check connection limit BEFORE adding to active connections
  if (activeConnections.size >= MAX_CONCURRENT_CLIENT_CONNECTIONS) {
    console.warn(
      `Connection limit reached (${activeConnections.size}/${MAX_CONCURRENT_CLIENT_CONNECTIONS}). Rejecting connection.`
    )
    try {
      sendJsonResponse(clientSocketConnection, {
        success: false,
        error: "Server connection limit reached",
      })
    } finally {
      firmlyCloseClientConnection(clientSocketConnection)
    }
    return // Stop processing this connection
  }

  addActiveConnectionToTracker(clientSocketConnection)
  startListeners(clientSocketConnection)

  // Wait for a request, error, or timeout. A valid request is
  // a JSON object with at least 'pythonPath' and 'action' keys
  try {
    let requestObject = await receiveClientRequest(clientSocketConnection)
    requestObject = validateClientRequest(requestObject)

    if (!requestObject.isValid) throw new Error(requestObject.error)

    const response = await switchInterpreter(requestObject.pythonPath, requestObject.shortName)
    await sendJsonResponseAndWait(clientSocketConnection, response)
  } catch (error) {
    handleClientError(clientSocketConnection, error)
  } finally {
    firmlyCloseClientConnection(clientSocketConnection)
  }
}

/**
 * Receives and accumulates data chunks until finding a null terminator
 * That data should be a JSON request (stringified & UTF-8 encoded)
 * Returns request object on success, rejects/throws errors
 *
 * @param {net.Socket} clientSocketConnection - Active client connection
 * @returns {Promise<Object>} Object containing the request
 * @throws {Error} On timeout, buffer overflow, or connection errors
 */
function receiveClientRequest(clientSocketConnection) {
  return new Promise((resolve, reject) => {
    let messageBuffer = null

    // Add timeout handling - if message isn't completed within timeout then
    // reject with an error and close down the client connection
    const messageTimeout = setTimeout(() => {
      console.warn(`Message timed out after ${INCOMING_MESSAGE_COMPLETION_TIMEOUT_MS}ms`)
      firmlyCloseClientConnection(clientSocketConnection)
      reject(new Error("Connection timeout - message incomplete"))
    }, INCOMING_MESSAGE_COMPLETION_TIMEOUT_MS)

    // Annnnd go!
    clientSocketConnection.on("data", dataEventHandler)

    // Listener for incoming data. Assembles and verifies request message
    function dataEventHandler(chunk) {
      // Fast path: check for terminator
      const terminatorIndex = chunk.indexOf(NULL_BYTE)

      // if we find the terminator then stop listening for any more messages
      // from this client (only valid for client to send one request at a time)
      // and process the message.
      if (terminatorIndex !== -1) {
        clientSocketConnection.removeListener("data", dataEventHandler)
        clearTimeout(messageTimeout)

        // 2. Then process data (might throw)
        let messageString = !messageBuffer
          ? chunk.subarray(0, terminatorIndex).toString("utf8")
          : Buffer.concat([messageBuffer, chunk.subarray(0, terminatorIndex)]).toString("utf8")

        // Strip UTF-8 BOM if present
        if (messageString.charCodeAt(0) === 0xfeff) {
          messageString = messageString.substring(1)
          console.debug("Stripped UTF-8 BOM from incoming message")
        }

        console.debug(`Processing message: ${messageString.substring(0, 50)}...`)

        // 3. Finally validate and resolve/reject
        try {
          resolve(JSON.parse(messageString))
        } catch (jsonError) {
          // When rejecting for invalid JSON
          console.warn(`Invalid JSON: ${jsonError.message}`)
          reject(new Error(`Invalid JSON in message: ${jsonError.message}`))
        }
        // can do any other cleanup here before the reject is received and processed...
        return
      }

      // Buffer overflow check
      const totalSize = (messageBuffer ? messageBuffer.length : 0) + chunk.length
      if (totalSize > MAX_BUFFER_SIZE) {
        clearTimeout(messageTimeout)
        firmlyCloseClientConnection(clientSocketConnection)
        reject(new Error(`Message size exceeds limit of ${MAX_BUFFER_SIZE} bytes`))
        return
      }

      // Accumulate
      messageBuffer = !messageBuffer ? Buffer.from(chunk) : Buffer.concat([messageBuffer, chunk])
    }
  })
}

/**
 * Sets up event listeners for socket lifecycle events
 * Registers handlers for timeout, end, error and close events
 *
 * @param {net.Socket} clientSocketConnection - Active client connection
 */
function startListeners(clientSocketConnection) {
  clientSocketConnection.setTimeout(SOCKET_INACTIVITY_TIMEOUT)
  // Register socket event handlers
  clientSocketConnection.on("timeout", () => {
    firmlyCloseClientConnection(clientSocketConnection)
  })
  clientSocketConnection.on("end", () => console.info("Client disconnected (end event)"))
  clientSocketConnection.on("error", (clientError) => handleClientError(clientSocketConnection, clientError))

  // Important to detect "close" event and free any remaining resources
  clientSocketConnection.once("close", () => {
    clientSocketConnection.removeAllListeners()
    activeConnections.delete(clientSocketConnection)
    console.info(`Client connection closed (active: ${activeConnections.size})`)
  })
}

/**
 * Gracefully handles client errors with appropriate response
 * Attempts to send error JSON then cleanly terminates connection
 *
 * @param {net.Socket} clientSocketConnection - Client connection with error
 * @param {Error} clientError - Error that occurred during processing
 */
function handleClientError(clientSocketConnection, clientError) {
  console.error(`Client error: ${clientError.message}`, clientError)
  try {
    sendJsonResponse(clientSocketConnection, {
      success: false,
      error: `Error - ${clientError.message}`,
    })
  } catch (err) {
    // Ignore errors when sending error responses - we're already in an error state
  }
}

/**
 * Validates incoming client request structure and content
 * Checks for required fields and proper action type
 *
 * @param {Object} requestObject - Raw request object from client
 * @returns {Object} Object with shape {isValid: boolean, error?: string, pythonPath?: string, ...}
 */
function validateClientRequest(requestObject) {
  try {
    // Extract action and handle accordingly
    const action = requestObject.action || ""

    if (action === "set-interpreter" && requestObject.pythonPath) {
      requestObject.isValid = true
      return requestObject
    } else {
      return {
        isValid: false,
        error: `Unsupported request: ${JSON.stringify(requestObject)}`,
      }
    }
  } catch (error) {
    console.error("Error handling socket message:", error)
    return {
      isValid: false,
      error: `Failed to process request: ${error.message}`,
    }
  }
}

/**
 * Sends a JSON response to the client
 *
 * @param {net.Socket} clientSocketConnection - The client connection
 * @param {Object} responseObject - Response object to send
 * @param {Function} [callback] - Optional callback when write completes
 */
function sendJsonResponse(clientSocketConnection, responseObject, callback) {
  clientSocketConnection.write(
    Buffer.concat([Buffer.from(JSON.stringify(responseObject), "utf8"), Buffer.from([NULL_BYTE])]),
    callback
  )
}

/**
 * Sends response to client with null termination and returns a Promise
 * that resolves when the data is written to kernel buffers
 *
 * @param {net.Socket} clientSocketConnection - The client connection
 * @param {Object} responseObject - Response object to send
 * @returns {Promise<void>} Resolves when data is written to kernel buffers
 */
async function sendJsonResponseAndWait(clientSocketConnection, responseObject) {
  return new Promise((resolve, reject) => {
    sendJsonResponse(clientSocketConnection, responseObject, (err) => {
      if (err) reject(err)
      else resolve()
    })
  })
}

/**
 * Adds connection to active connections tracker and records connection time
 *
 * @param {net.Socket} clientSocketConnection - Active client connection
 */
function addActiveConnectionToTracker(clientSocketConnection) {
  clientSocketConnection._connectedAt = Date.now() // Track connection time
  activeConnections.add(clientSocketConnection)
  console.info(`Client connected (active: ${activeConnections.size}/${MAX_CONCURRENT_CLIENT_CONNECTIONS})`)
}

/**
 * Tries to write remaining data and politely close the client connection
 * If client doesn't close gracefully within timeout, forces closure
 * Socket cleanup handled by the 'close' event handler
 *
 * @param {net.Socket} clientSocketConnection - The client connection to close
 */
function firmlyCloseClientConnection(clientSocketConnection) {
  if (!clientSocketConnection) return

  // Capture in closure for safety
  const socket = clientSocketConnection

  // Always check after timeout to ensure the socket fully closed
  // Don't care if this is redundant. Belts & braces!
  setTimeout(() => {
    if (!socket.destroyed) {
      console.warn("Socket didn't close gracefully within timeout, forcing closure")
      socket.destroy()
    }
  }, FIRM_SOCKET_CLOSE_TIMEOUT)

  // the close eventListener will release resources when either end() or destroy() is successful
  socket.end()
}

module.exports = {
  handleClientConnection,
}
