"use strict"
const net = require("net")
const { SERVER_SOCKET_PATH } = require("../../../src/unixSocketServer/constants")

/**
 * Creates specialized test clients for various edge case scenarios
 */
class TestClientFactory {
  /**
   * Creates a standard client that properly terminates messages
   * @param {object} options - Client configuration options
   * @returns {object} Client with test methods
   */
  static createStandardClient(options = {}) {
    const client = new net.Socket()
    const timeoutMs = options.timeout || 5000

    return {
      connect: (server) => {
        const socketPath = server._socketPath || SERVER_SOCKET_PATH
        return new Promise((resolve, reject) => {
          client.connect(socketPath, () => resolve(client))
          client.on("error", reject)
          client.setTimeout(timeoutMs, () => {
            reject(new Error("Connection timeout"))
            client.destroy()
          })
        })
      },

      sendMessage: (message) => {
        const messageString = typeof message === "object" ? JSON.stringify(message) : message
        return client.write(
          Buffer.concat([
            Buffer.from(messageString, "utf8"),
            Buffer.from([0]), // NULL_BYTE
          ])
        )
      },

      sendUnterminatedMessage: (message) => {
        const messageString = typeof message === "object" ? JSON.stringify(message) : message
        return client.write(Buffer.from(messageString, "utf8"))
      },

      sendMultipleMessages: (messages) => {
        const buffer = Buffer.concat(
          messages.flatMap((msg) => {
            const messageString = typeof msg === "object" ? JSON.stringify(msg) : msg
            return [Buffer.from(messageString, "utf8"), Buffer.from([0])]
          })
        )
        return client.write(buffer)
      },

      waitForResponse: (timeout = 5000) => {
        return new Promise((resolve, reject) => {
          const responseBuffer = []
          const timeoutId = setTimeout(() => {
            client.removeListener("data", dataHandler)
            client.removeListener("error", errorHandler)
            client.removeListener("close", closeHandler)
            reject(new Error(`Response timeout after ${timeout}ms`))
          }, timeout)

          const dataHandler = (data) => {
            responseBuffer.push(data)
            if (data.includes("\0")) {
              // NULL byte terminator found
              clearTimeout(timeoutId)
              client.removeListener("data", dataHandler)
              client.removeListener("error", errorHandler)
              client.removeListener("close", closeHandler)
              resolve(Buffer.concat(responseBuffer).toString("utf8").replace(/\0/g, ""))
            }
          }

          const errorHandler = (err) => {
            clearTimeout(timeoutId)
            client.removeListener("data", dataHandler)
            client.removeListener("error", errorHandler)
            client.removeListener("close", closeHandler)
            reject(err)
          }

          const closeHandler = () => {
            clearTimeout(timeoutId)
            client.removeListener("data", dataHandler)
            client.removeListener("error", errorHandler)
            client.removeListener("close", closeHandler)
            reject(new Error("Connection closed before response received"))
          }

          client.on("data", dataHandler)
          client.on("error", errorHandler)
          client.on("close", closeHandler)
        })
      },

      waitForDisconnect: (timeout = 5000) => {
        return new Promise((resolve, reject) => {
          console.log("waitForDisconnect: Checking if client is already destroyed");
          if (client.destroyed) {
            console.log("waitForDisconnect: Client already destroyed, resolving immediately");
            return resolve(true); // Return a defined value here
          }

          const timeoutId = setTimeout(() => {
            console.log("waitForDisconnect: Timeout reached, cleaning up and rejecting");
            client.removeListener('close', closeHandler);
            client.removeListener('end', endHandler);
            client.removeListener('error', errorHandler);
            try { client.destroy(); } catch (e) {}
            reject(new Error(`Disconnect timeout after ${timeout}ms`));
          }, timeout);

          const closeHandler = () => {
            console.log("waitForDisconnect: 'close' event detected, resolving");
            clearTimeout(timeoutId);
            client.removeListener('close', closeHandler);
            client.removeListener('end', endHandler);
            client.removeListener('error', errorHandler);
            resolve(true); // Return a defined value here too
          };

          const endHandler = () => {
            console.log("waitForDisconnect: 'end' event detected, resolving");
            clearTimeout(timeoutId);
            client.removeListener('close', closeHandler);
            client.removeListener('end', endHandler);
            client.removeListener('error', errorHandler);
            resolve(true); // And here
          };

          const errorHandler = (err) => {
            console.log("waitForDisconnect: 'error' event detected, resolving");
            clearTimeout(timeoutId);
            client.removeListener('close', closeHandler);
            client.removeListener('end', endHandler);
            client.removeListener('error', errorHandler);
            resolve(true); // And here
          };

          client.on('close', closeHandler);
          client.on('end', endHandler);
          client.on('error', errorHandler);
        });
      },

      end: () => client.end(),
      destroy: () => client.destroy(),

      getRawSocket: () => {
        return new Promise((resolve, reject) => {
          if (client.connecting) {
            client.once("connect", () => resolve(client))
          } else if (client.destroyed) {
            reject(new Error("Socket is destroyed"))
          } else {
            resolve(client)
          }
        })
      },
    }
  }

  /**
   * Creates multiple clients for concurrent testing
   * @param {number} count - Number of clients to create
   * @returns {Promise<Array>} Array of connected clients
   */
  static async createMultipleClients(count, server) {
    const clients = []
    for (let i = 0; i < count; i++) {
      const client = TestClientFactory.createStandardClient()
      await client.connect(server)
      clients.push(client)
    }
    return clients
  }
}

module.exports = TestClientFactory

