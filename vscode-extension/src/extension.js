"use strict"
const vscode = require("vscode")
const { EXTENSION_NAME, EXTENSION_LOAD_TIME } = require("./utils/constants")
const { startUnixSocketServer, gracefullyShutdownServer } = require("./unixSocketServer")
const { handleSocketRequest } = require("./handlers/socketRequestHandler")

// Global server reference needed for activate/deactivate
let server = null

async function activate(context) {
  const activationTime = Date.now()
  const loadToActivateTime = activationTime - EXTENSION_LOAD_TIME
  console.log(`${EXTENSION_NAME} extension activated (took ${loadToActivateTime}ms since load)`)

  try {
    server = startUnixSocketServer(handleSocketRequest)

    console.log(`Interpreter switcher socket server listening`)

    // Register server cleanup
    context.subscriptions.push({ dispose: () => gracefullyShutdownServer(server) })

    vscode.window.showInformationMessage(`${EXTENSION_NAME} extension activated`)
  } catch (error) {
    const message = `Failed to start ${EXTENSION_NAME}: ${error.message}`
    console.error(message)
    vscode.window.showErrorMessage(message)
  }
}

function deactivate() {
  if (server) {
    console.log(`${EXTENSION_NAME} extension deactivated`)
    gracefullyShutdownServer(server)
    server = null
  }
}

module.exports = { activate, deactivate }
