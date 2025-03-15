"use strict"
const net = require("net")

// Constants - match what the extension uses
const SERVER_SOCKET_PATH = "/tmp/gcubed_venv_switcher.sock"
const NULL_BYTE = 0

// Test cases from your extensionSocketTests.js
const testCases = [
  {
    name: "Test 1: Valid request with absolute path",
    payload: {
      pythonPath: "/usr/local/bin/python",
      action: "set-interpreter",
    },
    expectedStatus: true,
  },
  {
    name: "Test 2: Valid request with relative path",
    payload: {
      pythonPath: "venv/bin/python",
      action: "set-interpreter",
    },
    expectedStatus: true,
  },
  {
    name: "Test 3: Invalid path",
    payload: {
      pythonPath: "bad path",
      action: "set-interpreter",
    },
    expectedStatus: false,
  },
  {
    name: "Test 4: Missing pythonPath parameter",
    payload: {
      action: "set-interpreter",
    },
    expectedStatus: false,
  },
  {
    name: "Test 5: Empty pythonPath",
    payload: {
      pythonPath: "",
      action: "set-interpreter",
    },
    expectedStatus: false,
  },
  {
    name: "Test 6: pythonPath is not a string",
    payload: {
      pythonPath: 12345,
      action: "set-interpreter",
    },
    expectedStatus: false,
  },
  {
    name: "Test 7: Invalid action",
    payload: {
      pythonPath: "/usr/bin/python",
      action: "wrong-action",
    },
    expectedStatus: false,
  },
]

/**
 * Sends a message to the socket and returns the response
 *
 * @param {Object} payload - Message payload to send
 * @returns {Promise<Object>} Response object
 */
function sendMessage(payload) {
  return new Promise((resolve, reject) => {
    const client = net.createConnection(SERVER_SOCKET_PATH, () => {
      console.log(`Connected to socket at ${SERVER_SOCKET_PATH}`)
      const message = JSON.stringify(payload)
      console.log(`Sending: ${message}`)

      client.write(Buffer.concat([Buffer.from(message, "utf8"), Buffer.from([NULL_BYTE])]))
    })

    // Handle incoming data
    const chunks = []
    client.on("data", (data) => {
      chunks.push(data)

      // Check if we have the terminator
      if (data.includes(NULL_BYTE)) {
        // Combine all chunks and remove NULL_BYTE
        const responseText = Buffer.concat(chunks).toString("utf8").replace(/\0$/, "")

        try {
          const response = JSON.parse(responseText)
          resolve(response)
        } catch (error) {
          reject(new Error(`Invalid JSON response: ${error.message}`))
        }

        client.end()
      }
    })

    client.on("error", (error) => {
      reject(new Error(`Socket error: ${error.message}`))
    })

    client.on("close", () => {
      console.log("Connection closed")
    })

    // Set timeout
    setTimeout(() => {
      client.destroy()
      reject(new Error("Connection timeout"))
    }, 5000)
  })
}

/**
 * Run all tests sequentially
 */
async function runAllTests() {
  console.log("Starting tests against live extension socket")
  let passed = 0
  let failed = 0

  for (const test of testCases) {
    process.stdout.write(`\n🧪 Running: ${test.name}... `)

    try {
      const response = await sendMessage(test.payload)
      const success = response.success === test.expectedStatus
      console.log(`Response: ${JSON.stringify(response, null, 2)}`)

      if (success) {
        console.log("✅ PASSED")
        passed++
      } else {
        console.log("❌ FAILED")
        console.log(`Expected success: ${test.expectedStatus}, got: ${response.success}`)
        failed++
      }
    } catch (error) {
      console.log("❌ ERROR")
      console.log(`Test threw exception: ${error.message}`)
      failed++
    }
  }

  console.log(`\n🏁 Tests completed: ${passed} passed, ${failed} failed`)
}

// Check if socket file exists before starting
const fs = require("fs")
if (!fs.existsSync(SERVER_SOCKET_PATH)) {
  console.error(`❌ Socket file not found at ${SERVER_SOCKET_PATH}`)
  console.error("Is the extension running? Make sure VS Code is open with the extension active.")
  process.exit(1)
}

// Run the tests
runAllTests().catch((error) => {
  console.error(`❌ Fatal error: ${error.message}`)
  process.exit(1)
})
