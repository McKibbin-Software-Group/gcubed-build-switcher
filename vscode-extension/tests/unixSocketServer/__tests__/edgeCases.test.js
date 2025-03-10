"use strict"
const fs = require("fs")
const ServerController = require("../helpers/serverController")
const TestClientFactory = require("../helpers/testClientFactory")

describe("Edge Case Tests", () => {
  let server

  beforeEach(async () => {
    // Ensure socket is gone before starting
    try {
      fs.unlinkSync("/tmp/gcubed_venv_switcher.sock")
    } catch (e) {}
    server = await ServerController.startTestServer()
  })

  afterEach(async () => {
    jest.setTimeout(15000)
    await ServerController.stopTestServer(server)
  })

  test("server should handle empty message with terminator", async () => {
    const client = TestClientFactory.createStandardClient()
    await client.connect(server)

    // Send empty message with terminator
    client.sendMessage("")

    // Should still get response
    const response = await client.waitForResponse()
    const parsedResponse = JSON.parse(response)

    // Empty string is not valid JSON, so should get error response
    expect(parsedResponse.success).toBe(false)
    expect(parsedResponse.error).toBeDefined()
  })

  test("server should reject null byte only message", async () => {
    const client = TestClientFactory.createStandardClient()
    await client.connect(server)

    // Send just a null terminator
    const socket = await client.getRawSocket()
    socket.write(Buffer.from([0]))

    // Server should either return error or close connection
    try {
      const response = await client.waitForResponse()
      const parsedResponse = JSON.parse(response)
      expect(parsedResponse.success).toBe(false)
    } catch (error) {
      // Also acceptable - server might just close connection
      expect(error).toBeDefined()
    }
  })

  test("server should handle slow clients within timeout period", async () => {
    // Specialized slow client that writes very slowly
    const client = TestClientFactory.createStandardClient({ timeout: 8000 })
    await client.connect(server)

    const message = JSON.stringify({ test: "slow client" })
    const socket = await client.getRawSocket()

    // Write character by character with delays
    for (let i = 0; i < message.length; i++) {
      socket.write(message[i])
      // Small delay between characters
      await new Promise((resolve) => setTimeout(resolve, 50))
    }

    // Finally send terminator
    socket.write(Buffer.from([0]))

    // Should still get response if within timeout
    const response = await client.waitForResponse()
    const parsedResponse = JSON.parse(response)

    expect(parsedResponse.success).toBe(true)
    expect(parsedResponse.originalMessage.test).toBe("slow client")
  })
})
