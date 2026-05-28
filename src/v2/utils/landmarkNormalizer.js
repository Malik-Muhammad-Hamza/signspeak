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
 * MUST stay bit-for-bit identical to:
 *   training/utils/normalizer.py → normalize_frame()
 *
 * Algorithm (mirrors Python exactly):
 *   1. Translate so wrist (landmark 0) is at origin.
 *   2. Scale so max(|value|) == 1.0  (uses 1e-6 guard, same as Python).
 *   3. Check all values finite after division.
 *   4. Flatten to [x0,y0,z0, x1,y1,z1, …, x20,y20,z20].
 */

const NUM_LANDMARKS = 21;
const FEATURE_SIZE  = NUM_LANDMARKS * 3; // 63

/**
 * @param {Array<{x:number, y:number, z:number}>} landmarks
 * @returns {Float32Array|null}
 */
export function normalizeLandmarks(landmarks) {
  if (!landmarks || landmarks.length !== NUM_LANDMARKS) return null;

  const wrist = landmarks[0];
  const raw   = new Float32Array(FEATURE_SIZE);

  // Step 1 — wrist-relative translation (mirrors Python: shifted = frame - wrist)
  for (let i = 0; i < NUM_LANDMARKS; i++) {
    raw[i * 3 + 0] = landmarks[i].x - wrist.x;
    raw[i * 3 + 1] = landmarks[i].y - wrist.y;
    raw[i * 3 + 2] = landmarks[i].z - wrist.z;
  }

  // Step 2 — max-abs scale normalisation (mirrors Python: max_abs = np.abs(flat).max())
  let maxAbs = 0;
  for (const v of raw) {
    const a = Math.abs(v);
    if (a > maxAbs) maxAbs = a;
  }

  // Step 3 — degenerate frame guard (mirrors Python: if max_abs < 1e-6: return None)
  if (maxAbs < 1e-6) return null;

  for (let i = 0; i < raw.length; i++) {
    raw[i] /= maxAbs;
    // NaN/Inf guard (mirrors Python: if not np.all(np.isfinite(normed)): return None)
    if (!isFinite(raw[i])) return null;
  }

  return raw;
}

export { FEATURE_SIZE, NUM_LANDMARKS };
