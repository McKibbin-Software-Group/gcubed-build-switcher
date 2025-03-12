"use strict"
const { NULL_BYTE, MAX_BUFFER_SIZE, INCOMING_MESSAGE_COMPLETION_TIMEOUT_MS } = require("./constants")


/**
 * Receives and accumulates data chunks until finding a null terminator
 * Includes timeout protection and buffer overflow prevention
 *
 * @param {net.Socket} clientSocketConnection - Active client connection
 * @returns {Promise<string>} UTF-8 decoded message content (without terminator)
 * @throws {Error} On timeout, buffer overflow, or connection errors
 */
function receiveMessageUntilTerminator(clientSocketConnection) {
  return new Promise((resolve, reject) => {
    let messageBuffer = null

    const dataHandler = (chunk) => {
      // Fast path: check for terminator
      const terminatorIndex = chunk.indexOf(NULL_BYTE)

      if (terminatorIndex !== -1) {
        // Clear timeout when message completes
        clearTimeout(messageTimeout)

        // 1. Clean up event listeners first (guarantees no more callbacks)
        clientSocketConnection.removeListener("data", dataHandler)
        clientSocketConnection.removeListener("error", errorHandler)

        // 2. Then process data (might throw)
        const messageString = !messageBuffer
          ? chunk.subarray(0, terminatorIndex).toString("utf8")
          : Buffer.concat([messageBuffer, chunk.subarray(0, terminatorIndex)]).toString("utf8")

        // When processing a message
        console.debug(`Processing message: ${messageString.substring(0, 50)}...`)

        // 3. Finally validate and resolve/reject
        try {
          JSON.parse(messageString)
          resolve(messageString)
        } catch (jsonError) {
          // When rejecting for invalid JSON
          console.warn(`Invalid JSON: ${jsonError.message}`)
          reject(new Error(`Invalid JSON in message: ${jsonError.message}`))
        }

        return
      }

      // Buffer overflow check
      const totalSize = (messageBuffer ? messageBuffer.length : 0) + chunk.length
      if (totalSize > MAX_BUFFER_SIZE) {
        clearTimeout(messageTimeout)
        clientSocketConnection.removeListener("data", dataHandler)
        clientSocketConnection.removeListener("error", errorHandler)
        reject(new Error(`Message size exceeds limit of ${MAX_BUFFER_SIZE} bytes`))
        return
      }

      // Accumulate
      messageBuffer = !messageBuffer ? Buffer.from(chunk) : Buffer.concat([messageBuffer, chunk])
    }

    const errorHandler = (err) => reject(err)

    // Set up listeners
    clientSocketConnection.on("data", dataHandler)
    clientSocketConnection.on("error", errorHandler)

    // Add timeout handling - if message isn't completed within timeout then
    // reject with an error and close down the client connection
    const messageTimeout = setTimeout(() => {
      console.warn(`Message timed out after ${INCOMING_MESSAGE_COMPLETION_TIMEOUT_MS}ms`)
      clientSocketConnection.removeListener("data", dataHandler)
      clientSocketConnection.removeListener("error", errorHandler)
      reject(new Error("Connection timeout - message incomplete"))
      clientSocketConnection.end()
    }, INCOMING_MESSAGE_COMPLETION_TIMEOUT_MS)
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
  receiveMessageUntilTerminator,
  handleClientError,
}
