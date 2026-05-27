"use strict"

const ServerController = require("../helpers/serverController")
const TestClientFactory = require("../helpers/testClientFactory")

describe("Python IPC compatibility contract", () => {
  let server

  afterEach(async () => {
    await ServerController.stopTestServer(server)
  })

  test("accepts the stable Python client payload and returns the old extension response shape", async () => {
    let handledRequest
    server = await ServerController.startTestServer((pythonPath, shortName, requestObject) => {
      handledRequest = requestObject
      return {
        success: true,
        message: `Switched to ${pythonPath}`,
        requestedPath: pythonPath,
      }
    })

    const client = TestClientFactory.createStandardClient()
    await client.connect(server)
    client.sendMessage({
      action: "set-interpreter",
      pythonPath: "/workspace/project/venv_gcubed_c_0002/bin/python",
      shortName: "venv_gcubed_c_0002",
    })

    const response = JSON.parse(await client.waitForResponse())

    expect(handledRequest).toMatchObject({
      action: "set-interpreter",
      pythonPath: "/workspace/project/venv_gcubed_c_0002/bin/python",
      shortName: "venv_gcubed_c_0002",
      isValid: true,
    })
    expect(response).toEqual({
      success: true,
      message: "Switched to /workspace/project/venv_gcubed_c_0002/bin/python",
      requestedPath: "/workspace/project/venv_gcubed_c_0002/bin/python",
    })

    client.end()
  })

  test("accepts the stable Python client payload and may include the new apiId response field", async () => {
    server = await ServerController.startTestServer((pythonPath) => ({
      success: true,
      message: `Switched to ${pythonPath}`,
      requestedPath: pythonPath,
      apiId: "ms-python.vscode-python-envs",
    }))

    const client = TestClientFactory.createStandardClient()
    await client.connect(server)
    client.sendMessage({
      action: "set-interpreter",
      pythonPath: "/workspace/project/venv_gcubed_c_0002/bin/python",
      shortName: "venv_gcubed_c_0002",
    })

    const response = JSON.parse(await client.waitForResponse())

    expect(response).toEqual({
      success: true,
      message: "Switched to /workspace/project/venv_gcubed_c_0002/bin/python",
      requestedPath: "/workspace/project/venv_gcubed_c_0002/bin/python",
      apiId: "ms-python.vscode-python-envs",
    })

    client.end()
  })
})
