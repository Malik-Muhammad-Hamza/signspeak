/**
 * SignSpeak v2 — Prediction Smoother  ⚠ NOT IN LIVE PIPELINE
 *
 * This module is NOT imported by useV2Prediction.js or live inference code.
 * The active commit-stability logic lives entirely in useV2Prediction.js.
 * See that file for: confidence thresholds, top-2 margin, confusion-pair
 * guards, COMMIT_STABILITY_MS, COMMIT_COOLDOWN_MS, and clearOnNoHand().
 *
 * This file is kept as a reference majority-vote implementation.
 * Do NOT import without updating docs/v2-architecture.md.
 *
 * Original description:
 *
 * Accumulates the last `windowSize` model predictions and returns
 * the majority-vote winner only when it passes all stability checks.
 *
 * Stability checks (in order):
 *   1. Majority vote threshold   — label must appear in >= threshold fraction
 *   2. Confidence threshold      — class-specific minimum top-1 confidence
 *   3. Top-1 / Top-2 gap guard  — top-1 must beat top-2 by MIN_CONFIDENCE_GAP
 *   4. Confusion rule            — THANKYOU↔GOOD: requires larger gap (CONFUSION_GAP_REQUIRED)
 *
 * Returns { label, uncertain, message } instead of a plain string.
 *   label     — stable label, or null if not confident
 *   uncertain — true when THANKYOU/GOOD confusion detected
 *   message   — human-readable hint for the UI
 */

// ── Thresholds ────────────────────────────────────────────────────────────────

const DEFAULT_CONFIDENCE_THRESHOLD = 0.75;

// Higher threshold for signs that are commonly confused
const CLASS_CONFIDENCE_THRESHOLDS = {
  THANKYOU: 0.82,
  GOOD:     0.82,
};

// Minimum gap between top-1 and top-2 probabilities
const MIN_CONFIDENCE_GAP = 0.15;

// Extra-strict gap required when top-1/top-2 are the confused pair
const CONFUSION_GAP_REQUIRED = 0.20;

// The specific confused pair — in normalised form (uppercase, no spaces)
const CONFUSED_PAIRS = [
  new Set(["THANKYOU", "GOOD"]),
];

function isConfusedPair(a, b) {
  return CONFUSED_PAIRS.some(pair => pair.has(a) && pair.has(b));
}

/**
 * @param {object} opts
 * @param {number} [opts.windowSize=10]
 * @param {number} [opts.threshold=0.6]
 */
export function createPredictionSmoother({ windowSize = 10, threshold = 0.6 } = {}) {
  const history = [];

  return {
    /**
     * Push a new prediction and apply all stability checks.
     *
     * @param {string|null}   label        Top-1 label from the model
     * @param {Float32Array|number[]} probs Full probability array (length = num_classes)
     * @param {Object<string,string>} labelMap  { "0": "HELLO", … }
     *
     * @returns {{ label: string|null, uncertain: boolean, message: string|null }}
     */
    push(label, probs, labelMap) {
      history.push(label);
      if (history.length > windowSize) history.shift();
      return this.getStable(probs, labelMap);
    },

    /**
     * Compute stable result without adding a new prediction.
     */
    getStable(probs, labelMap) {
      const EMPTY = { label: null, uncertain: false, message: null };
      if (history.length === 0) return EMPTY;

      // ── 1. Majority vote ────────────────────────────────────────────────────
      const counts = {};
      for (const l of history) {
        if (l == null) continue;
        counts[l] = (counts[l] ?? 0) + 1;
      }

      let bestLabel = null;
      let bestCount = 0;
      for (const [lbl, cnt] of Object.entries(counts)) {
        if (cnt > bestCount) { bestCount = cnt; bestLabel = lbl; }
      }
      if (!bestLabel || bestCount / history.length < threshold) return EMPTY;

      // ── 2. Class-specific confidence threshold ─────────────────────────────
      if (!probs || !labelMap) {
        // No probabilities available — skip remaining checks
        return { label: bestLabel, uncertain: false, message: null };
      }

      // Find top-1 and top-2 indices
      const probArray = Array.from(probs);
      const sorted    = probArray
        .map((p, i) => ({ p, label: labelMap[String(i)] ?? `class_${i}` }))
        .sort((a, b) => b.p - a.p);

      const top1 = sorted[0];
      const top2 = sorted[1];

      const minConf = CLASS_CONFIDENCE_THRESHOLDS[top1.label] ?? DEFAULT_CONFIDENCE_THRESHOLD;
      if (top1.p < minConf) return EMPTY;

      // ── 3. Top-1 / Top-2 gap guard ─────────────────────────────────────────
      const gap = top2 ? (top1.p - top2.p) : 1.0;
      if (gap < MIN_CONFIDENCE_GAP) return EMPTY;

      // ── 4. THANKYOU ↔ GOOD confusion rule ─────────────────────────────────
      if (top2 && isConfusedPair(top1.label, top2.label)) {
        if (gap < CONFUSION_GAP_REQUIRED) {
          return {
            label:     null,
            uncertain: true,
            message:   `Uncertain: ${top1.label === "THANKYOU" ? "Thank You" : "Good"} / ${top1.label === "THANKYOU" ? "Good" : "Thank You"}`,
          };
        }
      }

      return { label: bestLabel, uncertain: false, message: null };
    },

    reset() {
      history.length = 0;
    },

    getHistory() {
      return [...history];
    },
  };
}
