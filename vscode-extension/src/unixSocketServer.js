"use strict"
const net = require("net")
const fs = require("fs")

/**
 * Path to the Unix socket file for IPC communication
 * @constant {string}
 */
const SERVER_SOCKET_PATH = "/tmp/gcubed_venv_switcher.sock"

/**
 * Null byte used as message terminator in the protocol
 * @constant {number}
 */
const NULL_BYTE = 0

/**
 * Maximum allowed message buffer size in bytes
 * @constant {number}
 */
const MAX_BUFFER_SIZE = 1024 // Only 1KB - consider increasing if JSON messages might be larger

/**
 * Starts a Unix socket server for secure JSON message exchange
 * Messages are null-terminated and UTF-8 encoded
 *
 * @param {Function} messageHandlerCallback - Callback to process incoming messages
 * @param {string} messageHandlerCallback.message - The received message string
 * @param {Function} messageHandlerCallback.sendResponse - Function to send response back to client
 * @param {string} messageHandlerCallback.sendResponse.responseData - Response string to send
 * @returns {net.Server} Active server instance
 */
function startUnixSocketServer(messageHandlerCallback) {
  ensureSocketPathAvailable(SERVER_SOCKET_PATH)

  const server = net.createServer((clientSocketConnection) => {
    console.log("Client connected")

    handleClientConnection(clientSocketConnection, processIncomingMessageCallback)

    clientSocketConnection.on("end", () => console.log("Client disconnected"))
    clientSocketConnection.on("error", (err) => console.error("Client error:", err))

    function processIncomingMessageCallback(messageString) {
      messageHandlerCallback(messageString, respondToIncomingMessageCallback)
    }

    function respondToIncomingMessageCallback(responseString) {
      clientSocketConnection.write(Buffer.concat([Buffer.from(responseString, "utf8"), Buffer.from([NULL_BYTE])]))
    }
  })

  // Configure and start server
  configureAndStartServer(server)
  return server
}

/**
 * Gracefully handles client errors with appropriate response
 * Attempts to send error JSON then cleanly terminates connection
 *
 * @param {net.Socket} clientSocketConnection - Client connection with error
 * @param {Error} clientError - Error that occurred during processing
 */
function handleClientError(clientSocketConnection, clientError) {
  console.error("Client processing error:", clientError.message)
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

/**
 * Configure server and start listening
 */
function configureAndStartServer(socketServer) {
  socketServer.maxConnections = 10 // Prevent DoS

  socketServer.listen(SERVER_SOCKET_PATH, () => {
    console.log(`Unix socket server listening on ${SERVER_SOCKET_PATH}`)
    fs.chmodSync(SERVER_SOCKET_PATH, 0o666)
  })

  socketServer.on("error", (err) => console.error("Server error:", err))
}

/**
 * Ensure socket path is available for use
 */
function ensureSocketPathAvailable(socketPath) {
  if (fs.existsSync(socketPath)) {
    try {
      fs.unlinkSync(socketPath)
    } catch (err) {
      throw new Error(`Failed to remove existing socket: ${err.message}`)
    }
  }
}

/**
 * Handles client data with optimized parsing for null-terminated messages
 * Designed for single-message-per-connection protocol pattern
 *
 * @param {net.Socket} clientSocketConnection - Active client connection socket
 * @param {Function} processIncomingMessageCallback - Callback for complete messages
 * @param {string} processIncomingMessageCallback.messageString - Complete decoded message
 */
function handleClientConnection(clientSocketConnection, processIncomingMessageCallback) {
  let accumulatedMessageBuffer = null

  clientSocketConnection.on("data", (incomingChunk) => {
    // Fast path: check for terminator anywhere in this chunk
    const terminatorIndex = incomingChunk.indexOf(NULL_BYTE)

    if (terminatorIndex !== -1) {
      // Message completes in this chunk
      const messageString = !accumulatedMessageBuffer
        ? // Direct conversion without unnecessary copy
          incomingChunk.subarray(0, terminatorIndex).toString("utf8")
        : // accumulating in a buffer object as UTF-8 & similar
          // could be split across chunk boundaries
          // so an early conversion toString would break the encoding
          Buffer.concat([accumulatedMessageBuffer, Buffer.from(incomingChunk.subarray(0, terminatorIndex))]).toString(
            "utf8"
          )

      // Process complete message
      processIncomingMessageCallback(messageString)
      return
    }

    // Calculate total buffer size to prevent overflow attacks
    const totalBufferSize = accumulatedMessageBuffer
      ? accumulatedMessageBuffer.length + incomingChunk.length
      : incomingChunk.length

    if (totalBufferSize > MAX_BUFFER_SIZE) {
      handleClientError(clientSocketConnection, new Error(`Message size exceeds limit of ${MAX_BUFFER_SIZE} bytes`))
      return
    }

    // No terminator yet - store chunk (lazy buffer allocation)
    accumulatedMessageBuffer = !accumulatedMessageBuffer
      ? Buffer.from(incomingChunk)
      : Buffer.concat([accumulatedMessageBuffer, Buffer.from(incomingChunk)])
  })
}

module.exports = { startUnixSocketServer }
