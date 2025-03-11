"use strict"
const net = require("net")
const NULL_BYTE = 0

/**
 * Path to the Unix socket file for IPC communication
 * Must match the path used by the server
 * @constant {string}
 */
const SERVER_SOCKET_PATH = "/tmp/gcubed-venv-switcher.sock"

/**
 * Sends a test message to the server and processes the response
 * Handles JSON serialization/deserialization and socket lifecycle
 *
 * @param {string|object} messageContent - Message to send (object will be stringified)
 * @returns {Promise<object>} Promise resolving to parsed server response
 */
function sendTestMessage(messageContent) {
  return new Promise((resolve, reject) => {
    // Convert objects to JSON strings
    const serializedMessage = typeof messageContent === "object" ?
      JSON.stringify(messageContent) : messageContent

    console.info(`Sending test message: ${serializedMessage}`)

    const socketConnection = net.createConnection(SERVER_SOCKET_PATH, () => {
      console.info("Connected to server")
      // Append null terminator to message
      socketConnection.write(Buffer.concat([
        Buffer.from(serializedMessage, 'utf8'),
        Buffer.from([NULL_BYTE])
      ]))
    })

    socketConnection.on("data", (responseData) => {
      // Remove null terminator if present
      const responseText = responseData.toString().replace(/\0$/, "")
      console.info("Received response from server")

      try {
        const parsedResponse = JSON.parse(responseText)
        console.info("Parsed response:", JSON.stringify(parsedResponse, null, 2))
        resolve(parsedResponse)
      } catch (parseError) {
        console.error("Failed to parse response as JSON:", parseError)
        reject(parseError)
      }

      socketConnection.end()
    })

    socketConnection.on("end", () => console.info("Disconnected from server"))

    socketConnection.on("error", (connectionError) => {
      console.error("Client connection error:", connectionError)
      reject(connectionError)
    })

    // Add timeout protection
    socketConnection.setTimeout(5000, () => {
      console.error("Connection timed out waiting for server response")
      socketConnection.destroy()
      reject(new Error("Connection timeout"))
    })
  })
}

/**
 * Runs the client test with predefined test data
 */
async function runClientTest() {
  try {
    const testPayload = {
      pythonPath: "/usr/bin/python3-doesn't-exist",
      testId: Date.now(),
      action: "test"
    }

    await sendTestMessage(testPayload)
    console.info("Test completed successfully")
  } catch (testError) {
    console.error("Test failed:", testError)
    process.exit(1)
  }
}

// Execute the test
runClientTest()

module.exports = {
  sendTestMessage,
  runClientTest
}
