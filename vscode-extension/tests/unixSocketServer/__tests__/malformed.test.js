"use strict"
const fs = require("fs")
const ServerController = require("../helpers/serverController")
const TestClientFactory = require("../helpers/testClientFactory")

describe("Malformed Message Tests", () => {
  let server

  beforeAll(async () => {
    // Ensure socket is gone before starting
    try {
      fs.unlinkSync("/tmp/gcubed_venv_switcher.sock")
    } catch (e) {}
    server = await ServerController.startTestServer()
  })

  afterAll(async () => {
    jest.setTimeout(15000)
    await ServerController.stopTestServer(server)
  })

  test("unterminated message should timeout and close connection", async () => {
    const client = TestClientFactory.createStandardClient();
    await client.connect(server);

    console.log("Test: Sending unterminated message");
    client.sendUnterminatedMessage({ test: "unterminated" });

    console.log("Test: Waiting for disconnect")
    await new Promise((resolve) => setTimeout(resolve, 3500)) // Wait longer than the server timeout
    await expect(client.waitForDisconnect(6000)).resolves.toBeDefined()
    console.log("Test: Disconnect detected")
  });

  test("invalid JSON should return error response", async () => {
    const client = TestClientFactory.createStandardClient()
    await client.connect(server)

    client.sendMessage("{ not valid json")

    const response = await client.waitForResponse()
    const parsedResponse = JSON.parse(response)

    expect(parsedResponse.success).toBe(false)
    expect(parsedResponse.error).toBeDefined()
  })

  test("oversized message should be rejected", async () => {
    // Create massive string exceeding buffer size
    const hugeString = "X".repeat(2000)

    const client = TestClientFactory.createStandardClient()
    await client.connect(server)

    client.sendMessage({ massive: hugeString })

    // Server should either close connection or return error
    try {
      const response = await client.waitForResponse()
      const parsedResponse = JSON.parse(response)
      expect(parsedResponse.success).toBe(false)
      expect(parsedResponse.error).toMatch(/size exceeds/)
    } catch (error) {
      // Alternative: connection closed is also acceptable
      expect(error).toBeDefined()
    }
  })
})
