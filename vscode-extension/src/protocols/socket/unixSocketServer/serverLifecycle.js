"use strict"
const net = require("net")
const fs = require("fs")
const {
  SERVER_SOCKET_PATH,
  NULL_BYTE,
  MAX_CONCURRENT_CLIENT_CONNECTIONS,
  SERVER_SOCKET_MODE,
  activeConnections,
} = require("./constants")
const { receiveMessageUntilTerminator, handleClientError } = require("./messageHandlers")
const { promisifyCallbackFunction } = require("./utils")

/**
 * Starts a Unix socket server for secure JSON message exchange over IPC
 * Handles connection management, message parsing, and error handling
 *
 * @param {Function} incomingMessageProcessor - Function to process incoming messages
 * @param {string} incomingMessageProcessor.messageContent - JSON-formatted message string
 * @param {Function} incomingMessageProcessor.sendResponseCallback - Response callback function
 * @param {string} incomingMessageProcessor.sendResponseCallback.responseContent - JSON response to send
 * @param {Object} [options] - Optional configuration options
 * @param {string} [options.socketPath] - Custom socket path
 * @returns {net.Server} Configured server instance that can be closed with server.close()
 * @throws {Error} If socket file cannot be created or secured
 */
function startUnixSocketServer(incomingMessageProcessor, options = {}) {
  console.info("Starting promise-based socket server...")
  const socketPath = options.socketPath || SERVER_SOCKET_PATH
  ensureSocketPathAvailable(socketPath)

  const server = net.createServer(async (clientSocketConnection) => {
    // Check connection limit BEFORE adding to active connections
    if (activeConnections.size >= MAX_CONCURRENT_CLIENT_CONNECTIONS) {
      console.warn(`Connection limit reached (${activeConnections.size}/${MAX_CONCURRENT_CLIENT_CONNECTIONS}). Rejecting connection.`)
      const rejectionPayload = {
        success: false,
        error: "Server connection limit reached",
      }
      clientSocketConnection.write(Buffer.concat([
        Buffer.from(JSON.stringify(rejectionPayload), "utf8"),
        Buffer.from([NULL_BYTE])
      ]))
      clientSocketConnection.end()
      return // Stop processing this connection
    }

    // Register event handlers immediately
    clientSocketConnection.on("end", () => console.info("Client disconnected"))
    clientSocketConnection.on("error", (err) => console.error("Client error:", err))

    // Only add to activeConnections if below limit
    activeConnections.add(clientSocketConnection)
    clientSocketConnection._connectedAt = Date.now() // Track connection time

    console.info(`Client connected (active: ${activeConnections.size}/${MAX_CONCURRENT_CLIENT_CONNECTIONS})`)

    try {
      // Wait for complete message
      const completeMessageContent = await receiveMessageUntilTerminator(clientSocketConnection)

      // Process message and get response
      const response = await promisifyCallbackFunction(incomingMessageProcessor, completeMessageContent)

      // Send response
      clientSocketConnection.write(Buffer.concat([Buffer.from(response, "utf8"), Buffer.from([NULL_BYTE])]))
      // After sending response, explicitly end the connection
      clientSocketConnection.end()
    } catch (error) {
      handleClientError(clientSocketConnection, error)
    } finally {
      activeConnections.delete(clientSocketConnection)
      // Client cleanup will happen on 'end' event
    }
  })

  // Pass the socketPath to configureAndStartServer
  configureAndStartServer(server, socketPath)
  return server
}

/**
 * Gracefully shuts down the server and cleans up resources
 *
 * @param {net.Server} socketServer - Server instance to shut down
 * @returns {Promise<void>} Promise resolving when server is fully closed
 */
function gracefullyShutdownServer(socketServer) {
  return new Promise((resolve) => {
    console.info("Shutting down socket server...")

    // Close all active connections
    for (const connection of activeConnections) {
      try {
        connection.end()
      } catch (err) {
        // Forcibly close if needed
        try {
          connection.destroy()
        } catch (_) {
          /* ignore */
        }
      }
    }

    // Close server
    socketServer.close(() => {
      // Remove socket file
      ensureSocketPathAvailable(SERVER_SOCKET_PATH)
      console.info("Socket server shut down successfully")
      resolve()
    })
  })
}

/**
 * Ensures the socket path is available by removing any stale socket file
 * Critical for restarting the server after crashes or unexpected termination
 *
 * @param {string} socketPath - Path to the socket file
 * @throws {Error} If existing socket file cannot be removed
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
 * Configures server settings and starts listening on the socket path
 * Sets connection limits and file permissions for security
 *
 * @param {net.Server} socketServer - Server instance to configure
 * @param {string} [socketPath] - Custom socket path
 * @throws {Error} If socket cannot be bound or permissions cannot be set
 */
function configureAndStartServer(socketServer, socketPath = SERVER_SOCKET_PATH) {
  // add an extra 2 to maxConnections so that we can soft-fail the
  // max+1 connection attempt (with backup from stack if another occurs
  // concurrently)
  socketServer.maxConnections = MAX_CONCURRENT_CLIENT_CONNECTIONS + 2

  socketServer.listen(socketPath, () => {
    console.info(`Unix socket server listening on ${socketPath}`)
    fs.chmodSync(socketPath, SERVER_SOCKET_MODE)
  })

  // Save path on server object for client access
  socketServer._socketPath = socketPath

  socketServer.on("error", (err) => console.error("Server error:", err))
}

/**
 * Logs server statistics such as memory usage and active connections
 */
function logServerStats() {
  console.info(`Memory usage: ${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB, Connections: ${activeConnections.size}`)
}

module.exports = { startUnixSocketServer, gracefullyShutdownServer }
