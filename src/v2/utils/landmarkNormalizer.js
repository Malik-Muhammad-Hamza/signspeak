/**
 * SignSpeak v2 — Landmark Normalizer
 *
 * Converts raw MediaPipe Hands landmarks into a wrist-relative,
 * scale-invariant 63-element float vector suitable for TCN input.
 *
 * Input:  Array of 21 landmark objects  { x, y, z }
 *         (values are 0-1 image-space from MediaPipe)
 * Output: Float32Array of length 63 (21 × 3)
 *
 * Normalisation steps
 * -------------------
 * 1. Translate so wrist (landmark 0) is at origin.
 * 2. Scale so that the max absolute value across all coords == 1.0
 *    (preserves hand shape regardless of distance from camera).
 * 3. Flatten to [x0,y0,z0, x1,y1,z1, …, x20,y20,z20].
 */

const NUM_LANDMARKS = 21;
const FEATURE_SIZE = NUM_LANDMARKS * 3; // 63

/**
 * @param {Array<{x:number, y:number, z:number}>} landmarks
 * @returns {Float32Array} length-63 normalised feature vector,
 *                         or null if landmarks are invalid.
 */
export function normalizeLandmarks(landmarks) {
  if (!landmarks || landmarks.length !== NUM_LANDMARKS) return null;

  const wrist = landmarks[0];
  const raw = new Float32Array(FEATURE_SIZE);

  // Step 1 — translate to wrist origin
  for (let i = 0; i < NUM_LANDMARKS; i++) {
    raw[i * 3 + 0] = landmarks[i].x - wrist.x;
    raw[i * 3 + 1] = landmarks[i].y - wrist.y;
    raw[i * 3 + 2] = landmarks[i].z - wrist.z;
  }

  // Step 2 — scale normalisation (max-abs across all coords)
  let maxAbs = 0;
  for (let v of raw) {
    const a = Math.abs(v);
    if (a > maxAbs) maxAbs = a;
  }

  if (maxAbs === 0) return null; // degenerate hand (all same point)

  for (let i = 0; i < raw.length; i++) {
    raw[i] /= maxAbs;
  }

  return raw;
}

export { FEATURE_SIZE, NUM_LANDMARKS };
