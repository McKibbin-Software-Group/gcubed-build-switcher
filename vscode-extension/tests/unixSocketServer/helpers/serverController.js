"use strict"
const { startUnixSocketServer, gracefullyShutdownServer } = require("../../../src/unixSocketServer")
const fs = require("fs")
const path = require("path")

/**
 * Creates and manages test server instances
 */
class ServerController {
  /**
   * Creates a server with specified message handling behavior
   * @param {Function} messageHandler - Custom message handler or uses echo by default
   * @returns {Promise<Object>} Server instance
   */
  static async startTestServer(messageHandler = null, options = {}) {
    // Create unique socket path for each test
    const testSocketPath = `/tmp/gcubed_test_${Date.now()}_${Math.floor(Math.random() * 10000)}.sock`;

    // Clean up any existing socket file
    try {
      if (fs.existsSync(testSocketPath)) {
        fs.unlinkSync(testSocketPath);
      }
    } catch (e) {}

    const defaultHandler = (message, sendResponse) => {
      try {
        const responseData = {
          success: true,
          originalMessage: JSON.parse(message),
          timestamp: new Date().toISOString(),
        };

        if (options.responseDelay) {
          setTimeout(() => sendResponse(JSON.stringify(responseData)), options.responseDelay);
        } else {
          sendResponse(JSON.stringify(responseData));
        }
      } catch (error) {
        sendResponse(JSON.stringify({
          success: false,
          error: error.message
        }));
      }
    };

    // Use the new parameter option in serverLifecycle
    const server = startUnixSocketServer(messageHandler || defaultHandler, {
      socketPath: testSocketPath
    });

    // Wait for server to be ready - fixed method call
    await ServerController.waitForSocketFileCreation(testSocketPath);

    return server;
  }

  /**
   * Waits for a socket file to be created, with timeout
   * @param {string} socketPath - Path to monitor for creation
   * @returns {Promise<void>}
   */
  static async waitForSocketFileCreation(socketPath) {
    return new Promise(resolve => {
      const checkInterval = setInterval(() => {
        if (fs.existsSync(socketPath)) {
          clearInterval(checkInterval);
          clearTimeout(timeoutTimer); // Clear the timeout when successful
          resolve();
        }
      }, 50);

      // Timeout after 3 seconds
      const timeoutTimer = setTimeout(() => {
        clearInterval(checkInterval);
        resolve();
      }, 3000);
    });
  }

  /**
   * Stops a running server instance
   * @param {Object} server - Server instance to stop
   * @returns {Promise<void>}
   */
  static async stopTestServer(server) {
    if (!server) return

    await gracefullyShutdownServer(server)

    // Additional cleanup
    try {
      if (server._socketPath && fs.existsSync(server._socketPath)) {
        fs.unlinkSync(server._socketPath)
      }
    } catch (e) {}
  }
}

module.exports = ServerController
