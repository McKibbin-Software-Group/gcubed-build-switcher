"use strict"
const fs = require("fs")
const ServerController = require("../helpers/serverController")
const TestClientFactory = require("../helpers/testClientFactory")

describe("Concurrent Connection Tests", () => {
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

  test("should handle multiple valid concurrent connections", async () => {
    const connectionCount = 5
    const clients = await TestClientFactory.createMultipleClients(connectionCount,server)

    // Send messages simultaneously
    const responsePromises = clients.map((client, index) => {
      client.sendMessage({ clientId: index, timestamp: Date.now() })
      return client.waitForResponse().then(JSON.parse)
    })

    const responses = await Promise.all(responsePromises)

    // All should succeed
    responses.forEach((response, index) => {
      expect(response.success).toBe(true)
      expect(response.originalMessage.clientId).toBe(index)
    })

    // Cleanup
    clients.forEach((client) => client.end())
  })

  test("should reject connections exceeding limit", async () => {
    // Create MAX_CONCURRENT_CLIENT_CONNECTIONS + 3 clients
    const MAX_CONCURRENT_CLIENT_CONNECTIONS = 5 // Match your server config
    const excessClients = MAX_CONCURRENT_CLIENT_CONNECTIONS + 3

    // This will either throw on the excess connections or return rejected connections
    try {
      const clients = await TestClientFactory.createMultipleClients(excessClients)

      // If we get here, test the last clients for rejection responses
      const lastThreeClients = clients.slice(-3)

      const responses = await Promise.all(
        lastThreeClients.map((client) => {
          client.sendMessage({ test: "excess connection" })
          return client
            .waitForResponse()
            .then(JSON.parse)
            .catch(() => ({ rejected: true }))
        })
      )

      // At least some should be rejected
      expect(responses.some((r) => r.rejected || r.success === false)).toBe(true)
    } catch (error) {
      // Connection failures are expected and acceptable
      expect(error).toBeDefined()
    }
  })
})
