"use strict";
const { startUnixSocketServer, gracefullyShutdownServer } = require("../../src/unixSocketServer");

/**
 * Starts a test server that echoes messages with metadata
 * Configures signal handlers for graceful shutdown
 */
function startTestServer() {
  console.info("Starting test server...")
  const server = startUnixSocketServer(handleIncomingMessage)

  console.info("Test server running. Press Ctrl+C to stop.")

  // Handle graceful shutdown
  process.on("SIGINT", handleShutdownRequest);
  process.on("SIGTERM", handleShutdownRequest);

  /**
   * Processes incoming message and returns formatted response
   * @param {string} incomingMessageJSON - JSON string from client
   * @param {Function} sendResponseCallback - Function to call with response
   */
  function handleIncomingMessage(incomingMessageJSON, sendResponseCallback) {
    try {
      console.info(`Server received: ${incomingMessageJSON}`)
      const parsedMessage = JSON.parse(incomingMessageJSON)

      // Echo back with metadata
      const response = JSON.stringify({
        success: true,
        originalMessage: parsedMessage,
        answer: "got it - all good!",
        timestamp: new Date().toISOString(),
      })
      sendResponseCallback(response)
    } catch (error) {
      console.error("Error processing message:", error)
      sendResponseCallback(
        JSON.stringify({
          success: false,
          error: error.message,
        })
      )
    }
  }

  /**
   * Handles shutdown signals with proper cleanup
   */
  async function handleShutdownRequest() {
    console.info("\nShutdown requested...")
    await gracefullyShutdownServer(server)
    console.info("Server stopped cleanly")
    process.exit(0)
  }
}

// Start the test server
startTestServer();