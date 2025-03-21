/**
 * @fileoverview Unix Socket Server Manager for Python interpreter switching
 * Creates and manages a Unix socket server for IPC communication
 * Handles socket file lifecycle, server configuration, and connection management
 *
 * @module socketServerManager
 */

"use strict"

const { handleClientConnection } = require("./socketClientHandler")

const net = require("net")
const fs = require("fs")
const {
  SERVER_SOCKET_PATH,
  MAX_CONCURRENT_CLIENT_CONNECTIONS,
  SERVER_SOCKET_MODE,
  activeConnections,
} = require("../utils/constants")

/**
 * Starts a Unix socket server for secure JSON message exchange over IPC
 * Handles connection management, message parsing, and error handling
 *
 * @param {Object} [options] - Configuration options for the socket server
 * @param {string} [options.socketPath] - Custom socket file path
 * @returns {net.Server} The created server instance
 * @throws {Error} If socket file cannot be deleted or server cannot start
 */
function startUnixSocketServer(options = {}) {
  const socketPath = options.socketPath || SERVER_SOCKET_PATH
  console.info(`Starting socket server on ${socketPath}...`)

  _deleteStaleSocketFile(socketPath)

  const server = net.createServer(handleClientConnection)

  _configureAndStartServer(server, socketPath)

  return server
}

/**
 * Gracefully shuts down the server and cleans up resources
 * Closes all active connections and removes the socket file
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
      if (socketServer._socketPath) {
        _deleteStaleSocketFile(socketServer._socketPath)
        console.info(`Socket server running on ${socketServer._socketPath} shut down successfully`)
      } else {
        console.error("socketServer._socketPath not defined - socket file not deleted!")
      }
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
function _deleteStaleSocketFile(socketPath) {
  if (fs.existsSync(socketPath)) {
    try {
      console.log(`ensureSocketPathAvailable: Removing existing socket file at ${socketPath}`)
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
function _configureAndStartServer(socketServer, socketPath) {
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

module.exports = { startUnixSocketServer, gracefullyShutdownServer }
