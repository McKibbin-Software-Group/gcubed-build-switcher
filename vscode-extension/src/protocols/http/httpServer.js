/**
 * HTTP Server implementation for interpreter switching
 */
"use strict"
const http = require("http")
const { createHttpRequestAdapter } = require("./httpRequestAdapter")
const ServerInterface = require("../common/serverInterface")

/**
 * HTTP server that handles interpreter switching requests
 */
class HttpServer extends ServerInterface {
  /**
   * Creates a new HTTP server instance
   *
   * @param {Object} settings - Server configuration settings
   * @param {number} settings.port - Port to listen on
   * @param {string} [settings.host='localhost'] - Host to bind to
   * @param {Object} logger - Logger instance for recording server activity
   * @param {Function} messageProcessor - Function to process interpreter requests
   */
  constructor(settings, logger, messageProcessor) {
    super(settings, logger)
    this.messageProcessor = messageProcessor
    this.port = settings.port || 3000
    this.host = settings.host || "localhost"
  }

  /**
   * Initializes the HTTP server with the request adapter
   *
   * @returns {Promise<void>}
   */
  async initialize() {
    // Create a request adapter that will handle HTTP requests and call the message processor
    const requestHandler = createHttpRequestAdapter(this.messageProcessor)

    // Create the HTTP server with the adapter as the request handler
    this.server = http.createServer(requestHandler)

    this.logger.info(`HTTP server created, ready to start on ${this.host}:${this.port}`)
    return Promise.resolve()
  }

  /**
   * Starts the HTTP server listening on configured port
   *
   * @returns {Promise<void>}
   */
  async start() {
    return new Promise((resolve, reject) => {
      this.server.listen(this.port, this.host, () => {
        this.logger.info(`HTTP server started on ${this.host}:${this.port}`)
        resolve()
      })

      this.server.on("error", (error) => {
        this.logger.error(`HTTP server error: ${error.message}`)
        reject(error)
      })
    })
  }

  /**
   * Stops the HTTP server
   *
   * @returns {Promise<void>}
   */
  async stop() {
    return new Promise((resolve) => {
      if (!this.server) {
        this.logger.info("HTTP server already stopped")
        resolve()
        return
      }

      this.server.close(() => {
        this.logger.info("HTTP server stopped")
        this.server = null
        resolve()
      })
    })
  }
}

module.exports = HttpServer
