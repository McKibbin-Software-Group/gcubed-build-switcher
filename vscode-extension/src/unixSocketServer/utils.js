"use strict"
const { INCOMING_MESSAGE_COMPLETION_TIMEOUT_MS } = require("../utils/constants")

/**
 * Converts a callback-style message processor to a Promise
 * @param {Function} callbackStyleFunction - Function expecting (data, callback) pattern
 * @param {string} messageContent - Message data to pass to processor
 * @returns {Promise<string>} Promise resolving to response content
 */
function promisifyCallbackFunction(callbackStyleFunction, messageContent) {
  return new Promise((resolve, reject) => {
    const callbackTimeout = setTimeout(() => {
      const timeoutError = new Error(`Message processing timeout after ${INCOMING_MESSAGE_COMPLETION_TIMEOUT_MS}ms - no response received`)
      console.warn(timeoutError.message)
      reject(timeoutError)
    }, INCOMING_MESSAGE_COMPLETION_TIMEOUT_MS)

    try {
      callbackStyleFunction(messageContent, (result) => {
        clearTimeout(callbackTimeout)
        resolve(result)
      })
    } catch (error) {
      clearTimeout(callbackTimeout)
      reject(error)
    }
  })
}

module.exports = { promisifyCallbackFunction }
