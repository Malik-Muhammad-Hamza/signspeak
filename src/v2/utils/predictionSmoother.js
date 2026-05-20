/**
 * SignSpeak v2 — Prediction Smoother
 *
 * Accumulates the last `windowSize` model predictions and returns
 * the majority-vote winner only when it appears in >= `threshold`
 * fraction of the window. This prevents flickering from single-frame
 * misclassifications.
 *
 * Usage
 * -----
 *   const smoother = createPredictionSmoother({ windowSize: 10, threshold: 0.6 });
 *   const stable = smoother.push('A');  // returns 'A' or null
 */

/**
 * @param {object} opts
 * @param {number} [opts.windowSize=10]   Number of predictions to keep
 * @param {number} [opts.threshold=0.6]   Min fraction for a stable prediction
 */
export function createPredictionSmoother({ windowSize = 10, threshold = 0.6 } = {}) {
  const history = [];

  return {
    /**
     * Record a new prediction and return the stable label,
     * or null if no label meets the threshold.
     *
     * @param {string|null} label  The top-1 label from the model (or null for no hand)
     * @returns {string|null}
     */
    push(label) {
      history.push(label);
      if (history.length > windowSize) history.shift();

      return this.getStable();
    },

    /**
     * Compute the current majority-vote label without adding a new prediction.
     * @returns {string|null}
     */
    getStable() {
      if (history.length === 0) return null;

      const counts = {};
      for (const l of history) {
        if (l == null) continue;
        counts[l] = (counts[l] ?? 0) + 1;
      }

      let bestLabel = null;
      let bestCount = 0;
      for (const [lbl, cnt] of Object.entries(counts)) {
        if (cnt > bestCount) {
          bestCount = cnt;
          bestLabel = lbl;
        }
      }

      const fraction = bestCount / history.length;
      return fraction >= threshold ? bestLabel : null;
    },

    /** Clear history (e.g. after a word is committed). */
    reset() {
      history.length = 0;
    },

    /** Peek at current raw history (useful for debug overlays). */
    getHistory() {
      return [...history];
    },
  };
}
