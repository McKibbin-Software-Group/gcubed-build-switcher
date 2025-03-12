// index.js - The public API facade
const { startUnixSocketServer } = require("./serverLifecycle")
const { gracefullyShutdownServer } = require("./serverLifecycle")

module.exports = {
  startUnixSocketServer,
  gracefullyShutdownServer,
  // Only export what should be public!
}
