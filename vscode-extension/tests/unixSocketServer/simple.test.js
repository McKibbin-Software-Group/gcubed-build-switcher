"use strict"
const fs = require("fs")
const ServerController = require("./helpers/serverController")
const TestClientFactory = require("./helpers/testClientFactory")

describe("Simple Socket Test", () => {
  let server

  beforeEach(async () => {
    server = await ServerController.startTestServer()
    // Debug info
    console.log(`Test server created with socket path: ${server._socketPath}`)
    console.log(`Socket file exists: ${fs.existsSync(server._socketPath)}`)
  })

  afterEach(async () => {
    await ServerController.stopTestServer(server)
  })

  test("basic communication", async () => {
    const client = TestClientFactory.createStandardClient()

    console.log(`Client connecting to: ${server._socketPath}`)
    await client.connect(server)
    console.log("Client connected successfully")

    client.sendMessage({ test: "message" })

    const response = await client.waitForResponse()
    console.log(`Response received: ${response}`)

    const parsedResponse = JSON.parse(response)
    expect(parsedResponse.success).toBe(true)

    client.end()
  })
})