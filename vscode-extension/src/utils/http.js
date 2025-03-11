"use strict"
const { HTTP } = require("./constants")

/**
 * Sends a JSON response
 * @param {http.ServerResponse} res - HTTP response
 * @param {number} statusCode - HTTP status code
 * @param {Object} data - Response data
 */
function sendJsonResponse(res, statusCode, data) {
  res.writeHead(statusCode, { "Content-Type": HTTP.CONTENT_TYPE_JSON })
  res.end(JSON.stringify(data))
}

module.exports = {
  sendJsonResponse
}