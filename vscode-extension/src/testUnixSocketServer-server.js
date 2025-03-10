"use strict";
const { startUnixSocketServer } = require("./unixSocketServer");

/**
 * Starts a test server that echoes messages with metadata
 */
function startTestServer() {
  console.log("Starting test server...");
  const server = startUnixSocketServer((message, sendResponse) => {
    try {
      console.log(`Server received: ${message}`);
      const parsedMessage = JSON.parse(message);

      // Echo back with metadata
      const response = JSON.stringify({
        success: true,
        originalMessage: parsedMessage,
        answer: "got it - all good!",
        timestamp: new Date().toISOString()
      });

      sendResponse(response);
    } catch (error) {
      console.error("Error processing message:", error);
      sendResponse(JSON.stringify({
        success: false,
        error: error.message
      }));
    }
  });

  console.log("Test server running. Press Ctrl+C to stop.");

  // Handle graceful shutdown
  process.on("SIGINT", () => {
    console.log("\nShutting down server...");
    server.close(() => {
      console.log("Server stopped");
      process.exit(0);
    });
  });
}

// Start the test server
startTestServer();