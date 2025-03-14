"use strict"
const { NULL_BYTE, MAX_BUFFER_SIZE, INCOMING_MESSAGE_COMPLETION_TIMEOUT_MS } = require("../utils/constants")

/**
 * Receives and accumulates data chunks until finding a null terminator
 * That data should be a JSON request (stringified & UTF-8 encoded)
 * Returns request object on success, rejects/throws errors
 * Does NOT close the socket connection
 * Manages listeners etc required to
 * Includes timeout protection and buffer overflow prevention
 *
 * @param {net.Socket} clientSocketConnection - Active client connection
 * @returns {Promise<Object>} Object containing the request
 * @throws {Error} On timeout, buffer overflow, or connection errors
 */

function receiveClientRequest(clientSocketConnection) {
  return new Promise((resolve, reject) => {
    let messageBuffer = null

    const dataHandler = (chunk) => {
      // Fast path: check for terminator
      const terminatorIndex = chunk.indexOf(NULL_BYTE)

      // if we find the terminator then stop listening for any more messages
      // from this client (only valid for client to send one request at a time)
      // and process the message.
      if (terminatorIndex !== -1) {
        // 1. Clean up event listeners first (guarantees no more callbacks)
        stopListeners()
        // Clear timeout
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
        stopListeners()
        clientSocketConnection.end()
        reject(new Error(`Message size exceeds limit of ${MAX_BUFFER_SIZE} bytes`))
        return
      }

      // Accumulate
      messageBuffer = !messageBuffer ? Buffer.from(chunk) : Buffer.concat([messageBuffer, chunk])
    }

    const errorHandler = (err) => reject(err)

    function stopListeners() {
      // Clean up event listeners first (guarantees no more callbacks)
      clientSocketConnection.removeListener("data", dataHandler)
      clientSocketConnection.removeListener("error", errorHandler)
    }

    function stopListenersAndEndConnection() {
      stopListeners()
      clientSocketConnection.end()
    }

    function startListeners() {
      // Set up listeners
      clientSocketConnection.on("data", dataHandler)
      clientSocketConnection.on("error", errorHandler)
    }

    // Add timeout handling - if message isn't completed within timeout then
    // reject with an error and close down the client connection
    const messageTimeout = setTimeout(() => {
      console.warn(`Message timed out after ${INCOMING_MESSAGE_COMPLETION_TIMEOUT_MS}ms`)
      stopListeners()
      clientSocketConnection.end()
      reject(new Error("Connection timeout - message incomplete"))
    }, INCOMING_MESSAGE_COMPLETION_TIMEOUT_MS)

    // Annnnd go!
    startListeners()
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
    const errorResponse = JSON.stringify({
      success: false,
      error: `Protocol error: ${clientError.message}`,
    })
    clientSocketConnection.write(Buffer.concat([Buffer.from(errorResponse, "utf8"), Buffer.from([NULL_BYTE])]))
    clientSocketConnection.end()
  } catch (e) {
    // Last resort if we can't write
    clientSocketConnection.destroy()
  }
}

module.exports = {
  receiveMessageUntilTerminator: receiveClientRequest,
  handleClientError,
}
