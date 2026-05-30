/**
 * SignSpeak v2 — Frame Buffer
 *
 * Maintains a sliding window of the last `capacity` normalised landmark
 * vectors. When full, provides a [capacity, FEATURE_SIZE] Float32Array
 * ready to be passed directly to the TCN model as a single batch item.
 *
 * Usage
 * -----
 *   const buf = createFrameBuffer(32, 126);
 *   buf.push(normalizedVector);
 *   if (buf.isFull()) {
 *     const tensor = buf.getTensor(); // shape [1, 32, 126]
 *   }
 */

/**
 * @param {number} capacity  Number of frames the model expects (e.g. 32)
 * @param {number} featureSize  Features per frame (e.g. 126)
 */
export function createFrameBuffer(capacity = 32, featureSize = 126) {
  // Ring buffer backed by a flat Float32Array for zero-copy slice
  const data = new Float32Array(capacity * featureSize);
  let count = 0;
  let head = 0; // next write position

  return {
    /** Push one normalised feature vector into the buffer. */
    push(vector) {
      if (vector.length !== featureSize) {
        console.warn(`[FrameBuffer] Expected ${featureSize} features, got ${vector.length}`);
        return;
      }
      data.set(vector, head * featureSize);
      head = (head + 1) % capacity;
      if (count < capacity) count++;
    },

    /** True once the buffer holds `capacity` frames. */
    isFull() {
      return count === capacity;
    },

    /** How many frames are currently buffered. */
    size() {
      return count;
    },

    /** Reset the buffer (e.g. when hand leaves frame). */
    reset() {
      count = 0;
      head = 0;
      data.fill(0);
    },

    /**
     * Returns ordered [capacity, featureSize] Float32Array
     * (oldest frame first, newest last).
     * Only valid when isFull() is true.
     */
    getSequence() {
      if (!this.isFull()) return null;
      // Re-order so oldest frame comes first
      const ordered = new Float32Array(capacity * featureSize);
      for (let i = 0; i < capacity; i++) {
        const srcIdx = (head + i) % capacity;
        ordered.set(
          data.subarray(srcIdx * featureSize, (srcIdx + 1) * featureSize),
          i * featureSize,
        );
      }
      return ordered;
    },
  };
}
