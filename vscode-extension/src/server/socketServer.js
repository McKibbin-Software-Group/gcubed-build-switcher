"use strict"
const vscode = require("vscode")
const ServerInterface = require("./serverInterface")
const { HTTP } = require("../utils/constants")
const { handleInterpreterRequest } = require("../handlers/interpreterHandler")

// Import the Unix socket server functions - direct from index.js
const { startUnixSocketServer, gracefullyShutdownServer } = require("../unixSocketServer")

/**
 * Unix Socket Server implementation of ServerInterface
 */
class SocketServer extends ServerInterface {
  /**
   * Creates a new socket server instance
   * @param {Object} config - Server configuration
   * @param {string} config.socketPath - Unix socket path
   */
  constructor(config) {
    super()
    this.config = config
    this.server = null
  }

  /**
   * Initializes the socket server
   * @returns {Promise<this>}
   */
  async initialize() {
    try {
      // Create Unix socket server using the functional API
      this.server = startUnixSocketServer(this.handleSocketMessage.bind(this), {
        socketPath: this.config.socketPath
      })

      console.log(`Interpreter switcher socket server listening on ${this.config.socketPath}`)
      return this
    } catch (error) {
      console.error("Failed to start socket server:", error)
      throw error
    }
  }

  /**
   * Message handler for socket communications
   * @param {string} messageJson - JSON message from client
   * @param {Function} sendResponse - Callback to send response
   */
  handleSocketMessage(messageJson, sendResponse) {
    try {
      const requestData = JSON.parse(messageJson)
      console.log(`Socket server received message: ${JSON.stringify(requestData)}`)

      // Extract Python interpreter path
      if (!requestData.pythonPath) {
        sendResponse(JSON.stringify({
          success: false,
          error: "Missing required parameter: pythonPath"
        }))
        return
      }

      // Create a stream-like adapter to match the HTTP handler expectations
      const bodyParts = []
      const pseudoReq = {
        method: "POST",
        url: "/set-interpreter",
        on: (event, callback) => {
          if (event === 'data') {
            callback(Buffer.from(messageJson))
          } else if (event === 'end') {
            callback()
          }
        }
      }

      const pseudoRes = {
        writeHead: (statusCode, headers) => {
          pseudoRes.statusCode = statusCode
          pseudoRes.headers = headers
        },
        end: (responseBody) => {
          // Send response through socket callback
          sendResponse(responseBody)
        }
      }

      // Use the existing handler logic
      handleInterpreterRequest(pseudoReq, pseudoRes)
    } catch (error) {
      console.error("Error handling socket message:", error)
      sendResponse(JSON.stringify({
        success: false,
        error: `Failed to process request: ${error.message}`
      }))
    }
  }

  /**
   * Shuts down the socket server
   * @returns {Promise<void>}
   */
  async shutdown() {
    if (this.server) {
      await gracefullyShutdownServer(this.server)
      this.server = null
    }
    return Promise.resolve()
  }
}

module.exports = SocketServer