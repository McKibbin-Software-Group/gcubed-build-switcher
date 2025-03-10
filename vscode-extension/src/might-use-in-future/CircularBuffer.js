/**
 * CircularBuffer - Efficient fixed-size circular buffer with zero-copy operations
 * @class
 */
class CircularBuffer {
  /**
   * Creates a fixed-size circular buffer
   * @param {number} capacity - Total buffer size in bytes
   */
  constructor(capacity) {
    this.buffer = Buffer.alloc(capacity)
    this.capacity = capacity
    this.head = 0 // Read position
    this.tail = 0 // Write position
    this.available = 0 // Bytes available to read
  }

  /**
   * Writes data to the buffer without additional allocations
   * @param {Buffer} chunk - Data to write
   * @returns {boolean} True if write succeeded, false if buffer would overflow
   */
  write(chunk) {
    if (chunk.length > this.capacity - this.available) {
      return false // Buffer overflow
    }

    // Copy in two parts if wrapping around buffer end
    let remainingBufferSpace = this.capacity - this.tail
    const firstWrite = Math.min(chunk.length, remainingBufferSpace)
    chunk.copy(this.buffer, this.tail, 0, firstWrite)

    console.log(`WRITE -> ChunkLength: ${chunk.length}, remainingBufferSpace: ${remainingBufferSpace}`)

    // If we need to wrap, copy the rest to the beginning
    if (firstWrite < chunk.length) {
      chunk.copy(this.buffer, 0, firstWrite)
    }

    this.tail = (this.tail + chunk.length) % this.capacity
    this.available += chunk.length

    console.log(`WRITE -> head: ${this.head}. tail: ${this.tail}. available: ${this.available}`)

    return true
  }

  /**
   * Finds and extracts a complete message up to the delimiter
   * @param {number} delimiter - Delimiter byte (e.g., NULL_BYTE)
   * @returns {Buffer|null} Complete message or null if no complete message
   */
  readUntilDelimiter(delimiter) {
    // Find delimiter starting from head
    let delimiterPos = -1
    let searchPos = this.head
    let bytesSearched = 0

    while (bytesSearched < this.available) {
      if (this.buffer[searchPos] === delimiter) {
        delimiterPos = searchPos
        break
      }
      searchPos = (searchPos + 1) % this.capacity
      bytesSearched++
    }

    if (delimiterPos === -1) {
      console.warn(`READ -> no complete message in buffer`)
      return null // No complete message
    }

    // Calculate message length (excluding delimiter)
    const messageLength =
      delimiterPos >= this.head ? delimiterPos - this.head : this.capacity - this.head + delimiterPos

    // Create a new buffer for the message (unavoidable allocation)
    const message = Buffer.alloc(messageLength)

    // Copy in two parts if wrapping around
    const firstRead = Math.min(messageLength, this.capacity - this.head)
    this.buffer.copy(message, 0, this.head, this.head + firstRead)

    if (firstRead < messageLength) {
      this.buffer.copy(message, firstRead, 0, messageLength - firstRead)
    }

    console.log(`READ -> head: ${this.head}. tail: ${this.tail}.  delimiterPos: ${delimiterPos}`)

    // Advance head past the delimiter
    this.head = (delimiterPos + 1) % this.capacity
    this.available -= messageLength + 1 // +1 for delimiter

    console.log(
      `READ -> Head stepped over delimiter: head: ${this.head}. tail: ${this.tail}. MessageLength: ${messageLength}. Available: ${this.available}`
    )

    return message
  }
}

module.exports = { CircularBuffer }
