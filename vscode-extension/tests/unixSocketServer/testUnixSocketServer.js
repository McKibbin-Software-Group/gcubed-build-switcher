"use strict"
const net = require("net")
const path = require("path")

const SOCKET_PATH = "/tmp/gcubed_venv_switcher.sock"

function sendMessage(message) {
  const client = net.createConnection(SOCKET_PATH, () => {
    console.log("Connected to server")
    client.write(message + "\0")
  })

  client.on("data", (data) => {
    console.log("Received response:", data.toString())
    client.end()
  })

  client.on("end", () => {
    console.log("Disconnected from server")
  })

  client.on("error", (err) => {
    console.error("Client error:", err)
  })
}

// Test the Unix socket server by sending a message
sendMessage(JSON.stringify({ pythonPath: "/usr/bin/python3" }))
