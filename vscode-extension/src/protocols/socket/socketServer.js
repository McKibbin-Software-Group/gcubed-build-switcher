/**
 * Socket Server implementation for interpreter switching
 */
"use strict"
const fs = require("fs")
const path = require("path")
const { createSocketRequestAdapter } = require("./socketRequestAdapter")
const ServerInterface = require("../common/serverInterface")

// Import the socket server utilities
const { startUnixSocketServer, gracefullyShutdownServer } = require("./unixSocketServer/index")

/**
 * Socket server that handles interpreter switching requests
 */
class SocketServer extends ServerInterface {
  /**
   * Creates a new socket server instance
   *
   * @param {Object} settings - Server configuration settings
   * @param {string} settings.socketPath - Path for Unix socket
   * @param {Object} logger - Logger instance for recording server activity
   * @param {Function} messageProcessor - Function to process interpreter requests
   */
  constructor(settings, logger, messageProcessor) {
    super(settings, logger)
    this.messageProcessor = messageProcessor
    this.socketPath = settings.socketPath
    this.server = null
  }

  /**
   * Initializes the socket server with the request adapter
   *
   * @returns {Promise<void>}
   */
  async initialize() {
    // Ensure socket directory exists
    const socketDir = path.dirname(this.socketPath)
    if (!fs.existsSync(socketDir)) {
      fs.mkdirSync(socketDir, { recursive: true })
    }

    // Clean up existing socket if necessary
    this.cleanupExistingSocket()

    // Create a request adapter that will handle socket messages
    const requestHandler = createSocketRequestAdapter(this.messageProcessor)

    // Start the socket server with the adapter as the message handler
    this.server = startUnixSocketServer(requestHandler, {
      socketPath: this.socketPath,
    })

    this.logger.info(`Socket server created and listening on ${this.socketPath}`)
    return Promise.resolve()
  }

  /**
   * Removes the socket file if it exists
   * @private
   */
  cleanupExistingSocket() {
    if (fs.existsSync(this.socketPath)) {
      try {
        fs.unlinkSync(this.socketPath)
        this.logger.info(`Removed existing socket at ${this.socketPath}`)
      } catch (error) {
        this.logger.warn(`Could not remove existing socket: ${error.message}`)
      }
    }
  }

  /**
   * Starts the socket server (already started in initialize)
   * Kept for interface compatibility
   *
   * @returns {Promise<void>}
   */
  async start() {
    this.logger.info("Socket server already started during initialization")
    return Promise.resolve()
  }

  /**
   * Stops the socket server
   *
   * @returns {Promise<void>}
   */
  async stop() {
    if (!this.server) {
      this.logger.info("Socket server already stopped")
      return Promise.resolve()
    }

    try {
      await gracefullyShutdownServer(this.server)
      this.server = null

      // Clean up socket file
      this.cleanupExistingSocket()

      this.logger.info("Socket server stopped successfully")
      return Promise.resolve()
    } catch (error) {
      this.logger.error(`Error stopping socket server: ${error.message}`)
      throw error
    }
  }
}

module.exports = SocketServer
