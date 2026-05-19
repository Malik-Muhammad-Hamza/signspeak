import * as fp from "fingerpose";
import { gestureDescriptions } from "./gestureDescriptions";

// Create one GestureEstimator instance
const estimator = new fp.GestureEstimator(gestureDescriptions);

const CONFIDENCE_THRESHOLD = 8.5;
const O_LIKE_THRESHOLD = 0.8;

// D/Z geometry thresholds
// If thumb tip is within this normalized distance of the index base or middle base,
// it is considered "in contact" / "circle position" → likely D.
// Lowered from 0.75 → 0.50 so a tucked thumb no longer triggers D.
const D_THUMB_CONTACT_THRESHOLD = 0.50;

// ─── Distance helpers ────────────────────────────────────────────────────────

const getDistance = (pointA, pointB) => {
  if (!pointA || !pointB) return Infinity;
  const dx = (pointA[0] ?? 0) - (pointB[0] ?? 0);
  const dy = (pointA[1] ?? 0) - (pointB[1] ?? 0);
  const dz = (pointA[2] ?? 0) - (pointB[2] ?? 0);
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
};

const getHandSize = (landmarks) => {
  if (!landmarks || !landmarks[0] || !landmarks[9]) return Infinity;
  return getDistance(landmarks[0], landmarks[9]);
};

const getNormalizedDistance = (landmarks, idxA, idxB) => {
  const handSize = getHandSize(landmarks);
  if (!handSize || handSize === Infinity) return Infinity;
  return getDistance(landmarks[idxA], landmarks[idxB]) / handSize;
};

// ─── O/C geometry ────────────────────────────────────────────────────────────

const isOLikeShape = (landmarks) => {
  if (!landmarks || !landmarks[4] || !landmarks[8] || !landmarks[0] || !landmarks[9]) {
    return false;
  }
  const referenceDistance = getDistance(landmarks[0], landmarks[9]);
  const pinchDistance = getDistance(landmarks[4], landmarks[8]);
  if (!referenceDistance || referenceDistance === Infinity) return false;
  return pinchDistance / referenceDistance < O_LIKE_THRESHOLD;
};

// ─── D/Z geometry ────────────────────────────────────────────────────────────

/**
 * Returns true if the thumb tip is near the index-finger base or middle-finger base.
 * This is the "D circle/contact" shape — thumb approaching the curled fingers.
 *
 * Landmarks:
 *   4 = thumb tip
 *   5 = index MCP (base)
 *   9 = middle MCP (base)
 */
const isDThumbCircleShape = (landmarks) => {
  if (!landmarks || landmarks.length < 21) return false;
  const thumbToIndexBase  = getNormalizedDistance(landmarks, 4, 5);
  const thumbToMiddleBase = getNormalizedDistance(landmarks, 4, 9);
  return thumbToIndexBase <= D_THUMB_CONTACT_THRESHOLD ||
         thumbToMiddleBase <= D_THUMB_CONTACT_THRESHOLD;
};

/**
 * Returns true if the thumb is NOT in the D contact position (i.e. thumb is tucked).
 * Used to confirm Z.
 */
const isZClosedThumbShape = (landmarks) => {
  return !isDThumbCircleShape(landmarks);
};

// ─── Open palm (NEXT_WORD) geometry ──────────────────────────────────────────

/**
 * NEXT_WORD: All 5 fingers INCLUDING thumb extended upward.
 * Key distinction from B:
 *   B:         thumb curled INSIDE the palm, 4 fingers up
 *   NEXT_WORD: thumb AND all 4 fingers all pointing up, no overlapping
 *
 * Checks:
 * 1. Index/middle/ring/pinky each have tip above PIP above MCP (in screen coords).
 * 2. Thumb tip (4) is above thumb IP (3) which is above thumb MCP (2) → thumb pointing up.
 * 3. Thumb tip is far from index base (5) → thumb spread wide, not tucked inside.
 */
const isOpenPalm = (landmarks) => {
  if (!landmarks || landmarks.length < 21) return false;

  // 4 fingers must be extended upward
  const fingers = [
    [8,  7,  5],  // index
    [12, 11, 9],  // middle
    [16, 15, 13], // ring
    [20, 19, 17], // pinky
  ];

  for (const [tip, pip, mcp] of fingers) {
    if (!landmarks[tip] || !landmarks[pip] || !landmarks[mcp]) return false;
    if (landmarks[tip][1] >= landmarks[pip][1]) return false;  // tip not above pip
    if (landmarks[pip][1] >= landmarks[mcp][1]) return false;  // pip not above mcp
  }

  // Thumb must also be extended upward (tip → IP → MCP, y decreasing)
  if (!landmarks[4] || !landmarks[3] || !landmarks[2]) return false;
  if (landmarks[4][1] >= landmarks[3][1]) return false; // thumb tip not above IP
  if (landmarks[3][1] >= landmarks[2][1]) return false; // thumb IP not above MCP

  // Thumb must be spread away from palm (not folded inside like B).
  // Normalized distance from thumb tip (4) to index base (5) must be large.
  const thumbSpread = getNormalizedDistance(landmarks, 4, 5);
  if (thumbSpread < 0.70) return false;

  return true;
};

/**
 * B guard: thumb must be tucked inside the palm.
 * Thumb tip (4) close to middle MCP (9) confirms thumb is folded across.
 */
const isBThumbInside = (landmarks) => {
  if (!landmarks || landmarks.length < 21) return false;
  // Thumb tip should be close to middle MCP (palm center area)
  const thumbToMiddle = getNormalizedDistance(landmarks, 4, 9);
  return thumbToMiddle <= 0.65;
};

// ─── Main detector ───────────────────────────────────────────────────────────

export const detectGesture = (predictions) => {
  try {
    if (!predictions || predictions.length === 0) {
      return null;
    }

    const landmarks = predictions[0].landmarks;

    if (!landmarks || landmarks.length < 21) {
      return null;
    }

    // ── Open palm / NEXT_WORD (checked before Fingerpose) ────────────────────
    // Priority: if palm is open, skip letter detection entirely.
    if (isOpenPalm(landmarks)) {
      return "NEXT_WORD";
    }

    const estimatedGestures = estimator.estimate(landmarks, CONFIDENCE_THRESHOLD);

    if (
      estimatedGestures &&
      estimatedGestures.gestures &&
      estimatedGestures.gestures.length > 0
    ) {
      const sortedGestures = estimatedGestures.gestures.sort(
        (a, b) => (b.score ?? b.confidence ?? 0) - (a.score ?? a.confidence ?? 0)
      );

      let highestConfidence = sortedGestures[0].name.toUpperCase();

      // ── C / O correction ─────────────────────────────────────────────────
      const isO = isOLikeShape(landmarks);

      if (highestConfidence === "C" && isO) {
        highestConfidence = "O";
      } else if (highestConfidence === "O" && !isO) {
        const secondBest = sortedGestures[1];
        highestConfidence = secondBest ? secondBest.name.toUpperCase() : "C";
      }

      // ── B correction: thumb must be tucked inside the palm ───────────────
      // Prevents a half-curled or extended thumb from being detected as B.
      if (highestConfidence === "B" && !isBThumbInside(landmarks)) {
        // Thumb is not folded inside — fall through to second best or null
        const secondBest = sortedGestures[1];
        highestConfidence = secondBest ? secondBest.name.toUpperCase() : null;
      }

      // ── D / Z correction ─────────────────────────────────────────────────
      // After the C/O correction, apply geometry to separate D from Z.
      if (highestConfidence === "D") {
        // D requires thumb in contact/circle position.
        // If thumb is tucked away, this is more likely Z.
        if (!isDThumbCircleShape(landmarks)) {
          highestConfidence = "Z";
        }
      } else if (highestConfidence === "Z") {
        // Z requires thumb tucked/closed.
        // If thumb is in the D contact position, this is more likely D.
        if (!isZClosedThumbShape(landmarks)) {
          highestConfidence = "D";
        }
      }

      return highestConfidence;
    }

    return null;
  } catch (error) {
    console.error("Error detecting gesture:", error);
    return null;
  }
};