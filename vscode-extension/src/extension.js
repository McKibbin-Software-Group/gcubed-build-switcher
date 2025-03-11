"use strict"
const vscode = require("vscode")
const { EXTENSION_NAME, EXTENSION_LOAD_TIME } = require("./utils/constants")
const { createServer } = require("./server/serverFactory")

// Global server reference needed for activate/deactivate
let server = null

/**
 * Extension activation handler
 * @param {vscode.ExtensionContext} context
 */
async function activate(context) {
  const activationTime = Date.now()
  const loadToActivateTime = activationTime - EXTENSION_LOAD_TIME
  console.log(`${EXTENSION_NAME} extension activated (took ${loadToActivateTime}ms since load)`)

  try {
    server = await createServer()

    // Register server cleanup on extension deactivation
    context.subscriptions.push({ dispose: () => server.shutdown() })

    vscode.window.showInformationMessage(`${EXTENSION_NAME} extension activated`)
  }
  catch (error) {
    const message = `Failed to start ${EXTENSION_NAME}: ${error.message}`
    console.error(message)
    vscode.window.showErrorMessage(message)
  }
}

/**
 * Extension deactivation handler
 */
function deactivate() {
  if (server) {
    const message = `${EXTENSION_NAME} extension deactivated`
    console.log(message)
    vscode.window.showInformationMessage(message)
    server.shutdown()
    server = null
  }
}

module.exports = { activate, deactivate }
