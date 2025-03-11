"use strict"
const http = require("http")
const vscode = require("vscode")
const ServerInterface = require("./serverInterface")
const { HTTP } = require("../utils/constants")
const { sendJsonResponse } = require("../utils/http")
const { handleInterpreterRequest } = require("../handlers/interpreterHandler")

/**
 * HTTP Server implementation of ServerInterface
 */
class HttpServer extends ServerInterface {
  /**
   * Creates a new HTTP server instance
   * @param {Object} config - Server configuration
   * @param {number} config.localPort - Port to listen on
   * @param {string} config.hostIP - Host IP to bind to
   */
  constructor(config) {
    super()
    this.config = config
    this.server = null
  }

  /**
   * Initializes the HTTP server
   * @returns {Promise<void>}
   */
  async initialize() {
    // Create HTTP server
    this.server = http.createServer(this.handleRequest.bind(this))

    // Error handling
    this.server.on("error", (err) => {
      console.error("Server error:", err)
      vscode.window.showErrorMessage(`Server error: ${err.message}`)
    })

    // Start listening
    const { localPort, hostIP } = this.config
    await new Promise((resolve, reject) => {
      this.server.listen(localPort, hostIP, () => {
        console.log(`Interpreter switcher server listening on ${hostIP}:${localPort}`)
        resolve()
      })

      // Add error handling for startup failure
      this.server.once("error", reject)
    })

    // Remove the startup-specific error handler
    this.server.removeAllListeners("error")

    return this
  }

  /**
   * Handles incoming HTTP requests
   * @param {http.IncomingMessage} req - HTTP request
   * @param {http.ServerResponse} res - HTTP response
   */
  handleRequest(req, res) {
    // Route handling
    if (req.method === "POST" && req.url === "/set-interpreter") {
      handleInterpreterRequest(req, res)
    } else {
      console.error(`Endpoint not found: ${req.method} ${req.url}`)
      sendJsonResponse(res, HTTP.STATUS.NOT_FOUND, {
        success: false,
        error: "Endpoint not found",
      })
    }
  }

  /**
   * Shuts down the HTTP server
   * @returns {Promise<void>}
   */
  async shutdown() {
    if (this.server) {
      return new Promise((resolve) => {
        this.server.close(() => {
          this.server = null
          resolve()
        })
      })
    }
    return Promise.resolve()
  }
}

module.exports = HttpServer