/**
 * @fileoverview Main entry point for the Python interpreter switcher extension
 * Handles extension lifecycle (activation/deactivation) and socket server management
 */

"use strict"
const vscode = require("vscode")
const { EXTENSION_NAME, EXTENSION_LOAD_TIME } = require("./utils/constants")
const { startUnixSocketServer, gracefullyShutdownServer } = require("./unixSocketServer")

/** @type {import('net').Server|null} Socket server instance for interpreter switching */
let server = null

/**
 * Extension activation handler
 * Initializes the socket server and registers cleanup handlers
 *
 * @param {vscode.ExtensionContext} context - Extension context provided by VS Code
 * @returns {Promise<void>}
 */
async function activate(context) {
  const activationTime = Date.now()
  const loadToActivateTime = activationTime - EXTENSION_LOAD_TIME
  console.log(`${EXTENSION_NAME} extension activated (took ${loadToActivateTime}ms since load)`)

  try {
    server = startUnixSocketServer()

    console.log(`Interpreter switcher socket server listening`)

    // Register server cleanup
    context.subscriptions.push({ dispose: deactivate })

    vscode.window.showInformationMessage(`${EXTENSION_NAME} extension activated`)
  } catch (error) {
    const message = `Failed to start ${EXTENSION_NAME}: ${error.message}`
    console.error(message)
    vscode.window.showErrorMessage(message)
  }
}

/**
 * Extension deactivation handler
 * Ensures socket server is properly shut down when VS Code closes
 *
 * @returns {void}
 */
function deactivate() {
  if (server) {
    console.log(`${EXTENSION_NAME} extension deactivated`)
    try {
      gracefullyShutdownServer(server)
    } catch (error) {
      console.error(`Error shutting down server: ${error.message}`)
    } finally {
      server = null
    }
  }
}

module.exports = { activate, deactivate }
