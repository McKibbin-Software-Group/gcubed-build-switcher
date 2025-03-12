/**
 * Adapter for handling HTTP requests
 */
"use strict"
const url = require("url")
const { HTTP } = require("../../utils/constants")
const { sendJsonResponse } = require("../../utils/http")
const { truncateForLogging, isValidNonEmptyString } = require("../../utils/common")
const { createAndReportError, withErrorHandling } = require("../../utils/errors")
const { serverLogger: logger } = require("../../core/messaging")

/**
 * Creates an HTTP request adapter to handle interpreter switching requests
 *
 * @param {Function} messageProcessor - Function to process interpreter switch requests
 * @returns {Function} Request handler for HTTP server
 */
function createHttpRequestAdapter(messageProcessor) {
  /**
   * Handles HTTP requests and routes to appropriate handlers
   * @param {http.IncomingMessage} req - HTTP request
   * @param {http.ServerResponse} res - HTTP response
   */
  return withErrorHandling(
    async (req, res) => {
      const parsedUrl = url.parse(req.url, true)
      const path = parsedUrl.pathname

      logger.info(`HTTP request received: ${req.method} ${path}`)

      // Handle only POST requests to /set-interpreter
      if (req.method === "POST" && path === "/set-interpreter") {
        let requestBody = ""

        req.on("data", (chunk) => {
          requestBody += chunk.toString()
          // Prevent DOS attacks with large payloads
          if (requestBody.length > 10000) {
            logger.warn("Request payload too large, connection terminated")
            res.writeHead(413) // Payload Too Large
            res.end('{"success":false,"error":"Request payload too large"}')
            req.socket.destroy()
          }
        })

        req.on("end", async () => {
          try {
            // Parse JSON request body
            const requestData = JSON.parse(requestBody)
            logger.info(`Processing interpreter request: ${truncateForLogging(JSON.stringify(requestData))}`)

            // Validate request
            if (!requestData || !isValidNonEmptyString(requestData.pythonPath)) {
              sendJsonResponse(res, HTTP.STATUS.BAD_REQUEST, {
                success: false,
                error: "Missing required parameter: pythonPath",
              })
              return
            }

            // Process the request with the provided message processor
            const result = await messageProcessor(requestData)

            // Send appropriate response
            sendJsonResponse(res, result.success ? HTTP.STATUS.OK : HTTP.STATUS.BAD_REQUEST, result)
          } catch (error) {
            logger.error(`Error processing request: ${error.message}`)
            sendJsonResponse(res, HTTP.STATUS.SERVER_ERROR, {
              success: false,
              error: `Failed to process request: ${error.message}`,
            })
          }
        })
      } else {
        // Handle unsupported endpoints or methods
        sendJsonResponse(res, HTTP.STATUS.NOT_FOUND, {
          success: false,
          error: `Endpoint not found: ${req.method} ${path}`,
        })
      }
    },
    { logger }
  )
}

module.exports = createHttpRequestAdapter
