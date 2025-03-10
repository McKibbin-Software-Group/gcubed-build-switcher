"use strict"
const net = require("net")

const SERVER_SOCKET_PATH = "/tmp/gcubed_venv_switcher.sock"

/**
 * Sends a test message to the server and handles the response
 * @param {string|object} message - Message to send (object will be stringified)
 */
function sendTestMessage(message) {
  // Convert objects to JSON strings
  const messageString = typeof message === "object" ? JSON.stringify(message) : message

  console.log(`Sending test message: ${messageString}`)

  const client = net.createConnection(SERVER_SOCKET_PATH, () => {
    console.log("Connected to server")
    // Append null terminator to message
    client.write(messageString + "\0")
  })

  client.on("data", (data) => {
    // Remove null terminator if present
    const response = data.toString().replace(/\0$/, "")
    console.log("Received response:", response)

    try {
      const jsonResponse = JSON.parse(response)
      console.log("Parsed response:", JSON.stringify(jsonResponse, null, 2))
    } catch (err) {
      console.error("Failed to parse response as JSON:", err)
    }

    client.end()
  })

  client.on("end", () => console.log("Disconnected from server"))

  client.on("error", (err) => {
    console.error("Client error:", err)
    process.exit(1)
  })
}

// Run with a test message
sendTestMessage({
  pythonPath: "/usr/bin/python3",
  testId: Date.now(),
})
