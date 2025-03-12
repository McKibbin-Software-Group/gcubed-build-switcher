/**
 * Adapter for handling Socket requests
 */
"use strict"
const { truncateForLogging, isValidNonEmptyString } = require("../../utils/common")
const { createAndReportError, withErrorHandling } = require("../../utils/errors")
const { serverLogger: logger } = require("../../core/messaging")

/**
 * Creates a socket request adapter to handle interpreter switching requests
 *
 * @param {Function} messageProcessor - Function to process interpreter switch requests
 * @returns {Function} Data handler for socket server
 */
function createSocketRequestAdapter(messageProcessor) {
  /**
   * Handles messages received over socket connections
   * @param {string} message - JSON message from client
   * @param {Function} sendResponse - Function to send response to client
   */
  return withErrorHandling(
    async (message, sendResponse) => {
      logger.info(`Socket message received: ${truncateForLogging(message)}`)

      try {
        // Parse JSON message
        const requestData = JSON.parse(message)

        // Validate request
        if (!requestData || !isValidNonEmptyString(requestData.pythonPath)) {
          sendResponse(
            JSON.stringify({
              success: false,
              error: "Missing required parameter: pythonPath",
            })
          )
          return
        }

        // Process the request with the provided message processor
        const result = await messageProcessor(requestData)

        // Send response
        sendResponse(JSON.stringify(result))
      } catch (error) {
        logger.error(`Error processing socket message: ${error.message}`)
        sendResponse(
          JSON.stringify({
            success: false,
            error: `Failed to process request: ${error.message}`,
          })
        )
      }
    },
    { logger }
  )
}

module.exports = createSocketRequestAdapter
