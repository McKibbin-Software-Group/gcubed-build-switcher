"use strict"
const net = require("net")
const { sendTestMessage } = require("./testUnixSocketServer-client")


// Test cases that parallel the HTTP tests
const testCases = [
  {
    name: "Test 1: Valid request with absolute path",
    payload: {
      pythonPath: "/usr/local/bin/python",
      action: "set-interpreter" // Action is critical - must match what extension expects
    },
    expectedStatus: true
  },
  {
    name: "Test 2: Valid request with relative path",
    payload: {
      pythonPath: "venv/bin/python",
      action: "set-interpreter"
    },
    expectedStatus: true
  },
  {
    name: "Test 3: Invalid path",
    payload: {
      pythonPath: "bad path",
      action: "set-interpreter"
    },
    expectedStatus: false
  },
  {
    name: "Test 4: Missing pythonPath parameter",
    payload: {
      action: "set-interpreter"
    },
    expectedStatus: false
  },
  {
    name: "Test 5: Empty pythonPath",
    payload: {
      pythonPath: "",
      action: "set-interpreter"
    },
    expectedStatus: false
  },
  {
    name: "Test 6: pythonPath is not a string",
    payload: {
      pythonPath: 12345,
      action: "set-interpreter"
    },
    expectedStatus: false
  },
  {
    name: "Test 7: Invalid action",
    payload: {
      pythonPath: "/usr/bin/python",
      action: "wrong-action"
    },
    expectedStatus: false
  }
]

/**
 * Runs all test cases in sequence
 */
async function runAllTests() {
  console.log("Starting extension socket server tests")
  let failedTests = 0

  for (const test of testCases) {
    console.log(`\n${test.name}`)
    try {
      const response = await sendTestMessage(test.payload)
      const passed = response.success === test.expectedStatus

      if (passed) {
        console.log(`✅ PASSED: ${test.name}`)
      } else {
        console.log(`❌ FAILED: ${test.name}`)
        console.log(`Expected success: ${test.expectedStatus}, got: ${response.success}`)
        console.log(`Response: ${JSON.stringify(response, null, 2)}`)
        failedTests++
      }
    } catch (error) {
      console.log(`❌ ERROR: ${test.name}`)
      console.log(`Test threw exception: ${error.message}`)
      failedTests++
    }
  }

  console.log(`\nTests completed: ${testCases.length - failedTests} passed, ${failedTests} failed`)

  if (failedTests > 0) {
    process.exit(1)
  }
}

// Run all tests
runAllTests()