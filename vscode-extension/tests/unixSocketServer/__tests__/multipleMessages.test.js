"use strict"
const fs = require("fs")
const ServerController = require("../helpers/serverController")
const TestClientFactory = require("../helpers/testClientFactory")

describe("Multiple Message Tests", () => {
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

  test("server should process only first message when multiple sent in single write", async () => {
    const client = TestClientFactory.createStandardClient()
    await client.connect(server)

    // Send multiple messages in one transmission
    const messages = [
      { id: 1, content: "first message" },
      { id: 2, content: "second message" }, // This should be ignored
      { id: 3, content: "third message" }, // This should be ignored
    ]

    client.sendMultipleMessages(messages)

    // We should only get one response (for the first message)
    const response = await client.waitForResponse()
    const parsedResponse = JSON.parse(response)

    expect(parsedResponse.originalMessage.id).toBe(1)

    // Server should close connection after response
    await new Promise((resolve) => setTimeout(resolve, 100))
    await expect(client.waitForDisconnect()).resolves.toBeDefined()
  })

  test("server should handle fragmented messages across multiple writes", async () => {
    // Create specialized fragmenting client
    const client = TestClientFactory.createStandardClient()
    await client.connect(server)

    const message = JSON.stringify({ test: "fragmented message" })
    const socket = await client.getRawSocket()

    // Fragment the message into chunks
    const firstHalf = message.substring(0, message.length / 2)
    const secondHalf = message.substring(message.length / 2) + "\0"

    // Send fragments with delay
    socket.write(firstHalf)

    // Wait briefly to ensure fragments are handled separately
    await new Promise((resolve) => setTimeout(resolve, 100))
    socket.write(secondHalf)

    // Should still get a complete response
    const response = await client.waitForResponse()
    const parsedResponse = JSON.parse(response)

    expect(parsedResponse.success).toBe(true)
    expect(parsedResponse.originalMessage.test).toBe("fragmented message")
  })
})
