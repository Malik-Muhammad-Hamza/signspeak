/**
 * SignSpeak v2 - Landmark Normalizer
 *
 * Converts MediaPipe Hands results into a two-hand, wrist-relative,
 * scale-invariant 126-element float vector for TCN input.
 *
 * Output order is stable:
 *   [left_hand_63, right_hand_63]
 *
 * Missing hands remain 63 zeros.
 */

const NUM_LANDMARKS = 21;
const COORDS_PER_LANDMARK = 3;
const HAND_FEATURE_SIZE = NUM_LANDMARKS * COORDS_PER_LANDMARK; // 63
const FEATURE_SIZE = HAND_FEATURE_SIZE * 2; // 126

function isFiniteLandmark(lm) {
  return Number.isFinite(lm?.x) && Number.isFinite(lm?.y) && Number.isFinite(lm?.z);
}

/**
 * @param {Array<{x:number, y:number, z:number}>} landmarks
 * @returns {Float32Array|null}
 */
export function normalizeHandLandmarks(landmarks) {
  if (!landmarks || landmarks.length !== NUM_LANDMARKS) return null;
  if (!landmarks.every(isFiniteLandmark)) return null;

  const wrist = landmarks[0];
  const raw = new Float32Array(HAND_FEATURE_SIZE);

  for (let i = 0; i < NUM_LANDMARKS; i++) {
    raw[i * 3 + 0] = landmarks[i].x - wrist.x;
    raw[i * 3 + 1] = landmarks[i].y - wrist.y;
    raw[i * 3 + 2] = landmarks[i].z - wrist.z;
  }

  let maxAbs = 0;
  for (const v of raw) {
    const a = Math.abs(v);
    if (a > maxAbs) maxAbs = a;
  }

  if (maxAbs < 1e-6) return null;

  for (let i = 0; i < raw.length; i++) {
    raw[i] /= maxAbs;
    if (!Number.isFinite(raw[i])) return null;
  }

  return raw;
}

function handednessLabel(entry) {
  return entry?.label ?? entry?.classification?.[0]?.label ?? null;
}

function sortHandsByX(handLandmarks) {
  return handLandmarks
    .filter(Boolean)
    .slice(0, 2)
    .sort((a, b) => (a[0]?.x ?? 0) - (b[0]?.x ?? 0));
}

function assignHands(handLandmarks, handedness) {
  const assigned = { left: null, right: null };
  const labels = handedness?.map(handednessLabel) ?? [];
  const hasUsableHandedness = labels.length >= handLandmarks.length
    && labels.some(label => label === 'Left' || label === 'Right');

  if (hasUsableHandedness) {
    for (let i = 0; i < Math.min(handLandmarks.length, 2); i++) {
      const label = labels[i];
      if (label === 'Left' && !assigned.left) {
        assigned.left = handLandmarks[i];
      } else if (label === 'Right' && !assigned.right) {
        assigned.right = handLandmarks[i];
      }
    }
  }

  const remaining = handLandmarks.filter(hand => hand && hand !== assigned.left && hand !== assigned.right);
  const sortedRemaining = sortHandsByX(remaining);

  for (const hand of sortedRemaining) {
    if (!assigned.left) {
      assigned.left = hand;
    } else if (!assigned.right) {
      assigned.right = hand;
    }
  }

  return assigned;
}

/**
 * @param {Array<Array<{x:number, y:number, z:number}>>} handLandmarks
 * @param {Array<object>} handedness
 * @returns {Float32Array|null}
 */
export function normalizeLandmarks(handLandmarks, handedness = []) {
  if (!handLandmarks || handLandmarks.length === 0) return null;

  const output = new Float32Array(FEATURE_SIZE);
  const assigned = assignHands(handLandmarks, handedness);
  let anyValid = false;

  const left = normalizeHandLandmarks(assigned.left);
  if (left) {
    output.set(left, 0);
    anyValid = true;
  }

  const right = normalizeHandLandmarks(assigned.right);
  if (right) {
    output.set(right, HAND_FEATURE_SIZE);
    anyValid = true;
  }

  return anyValid ? output : null;
}

export { FEATURE_SIZE, HAND_FEATURE_SIZE, NUM_LANDMARKS };
