/**
 * SignSpeak v2 — useV2Prediction
 *
 * Handles model inference + commit-stability logic.
 *
 * Pipeline
 * --------
 *  Webcam → [sequence] → runInference → raw probabilities
 *    → confidence + top-2 margin check
 *    → candidate stability window (COMMIT_STABILITY_MS)
 *    → cooldown guard (COMMIT_COOLDOWN_MS)
 *    → duplicate prevention
 *    → commit
 *
 * No-hand signal
 * --------------
 *  clearOnNoHand() — call when the hand leaves the frame.
 *  Resets: liveLabel, liveConfidence, candidate state, lastCommittedLabel,
 *  uncertain flag. This allows the same sign to be re-committed after the
 *  hand is lowered and raised again.
 *
 * Returned state
 * --------------
 *  liveLabel       — top-1 prediction right now (updates every frame)
 *  liveConfidence  — confidence of liveLabel
 *  commitStatus    — "Detecting…" | "Stabilizing…" | "Committed: X" | "Uncertain gesture…"
 *  committedLabel  — the label that just committed (or null)
 *  uncertain       — true when confused pair detected
 *  uncertainMessage
 *  modelReady / error
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { loadV2Model, runInference } from '../utils/modelLoader';

// ── Timing ────────────────────────────────────────────────────────────────────
/** Min ms between GPU inference calls (prevents saturation). */
const PREDICTION_INTERVAL_MS = 100;

/** A label must stay top-1 for this long before it is committed. */
const COMMIT_STABILITY_MS = 400;

/** After committing, block new commits for this long. */
const COMMIT_COOLDOWN_MS = 700;

// ── Confidence thresholds ─────────────────────────────────────────────────────
/** Default minimum top-1 confidence to allow a commit. */
const DEFAULT_CONFIDENCE_THRESHOLD = 0.78;

/** Per-class overrides — higher for commonly confused signs. */
const CLASS_THRESHOLDS = {
  THANKYOU: 0.84,
  GOOD:     0.84,
  HELLO:    0.82,
};

/** Minimum gap between top-1 and top-2 confidence. */
const MIN_TOP2_MARGIN = 0.18;

// ── Confusion pairs ───────────────────────────────────────────────────────────
/**
 * When top-1 and top-2 belong to a confused pair AND gap < CONFUSION_PAIR_MARGIN,
 * we show an uncertain warning and do NOT commit.
 */
const CONFUSION_PAIR_MARGIN = 0.22;

const CONFUSED_PAIRS = [
  new Set(['HELLO',   'THANKYOU']),
  new Set(['GOOD',    'THANKYOU']),
  new Set(['PLEASE',  'SORRY']),
];

function isConfusedPair(a, b) {
  return CONFUSED_PAIRS.some(pair => pair.has(a) && pair.has(b));
}

// ── Helper ────────────────────────────────────────────────────────────────────
function getThreshold(label) {
  return CLASS_THRESHOLDS[label] ?? DEFAULT_CONFIDENCE_THRESHOLD;
}


// ── Hook ──────────────────────────────────────────────────────────────────────
export function useV2Prediction() {
  // Model
  const [modelReady, setModelReady] = useState(false);
  const [error,      setError]      = useState(null);

  // Live prediction (updates every inference frame)
  const [liveLabel,      setLiveLabel]      = useState(null);
  const [liveConfidence, setLiveConfidence] = useState(0);

  // Commit state
  const [committedLabel,   setCommittedLabel]   = useState(null);
  const [commitStatus,     setCommitStatus]     = useState('Detecting…');
  const [uncertain,        setUncertain]        = useState(false);
  const [uncertainMessage, setUncertainMessage] = useState(null);

  // Refs
  const modelRef    = useRef(null);
  const labelMapRef = useRef(null);

  // Throttle / concurrency
  const lastRunRef  = useRef(0);
  const runningRef  = useRef(false);

  // Stability tracking
  const candidateLabelRef     = useRef(null);
  const candidateStartedAtRef = useRef(0);

  // Commit tracking
  const lastCommittedLabelRef = useRef(null);
  const lastCommitTimeRef     = useRef(0);

  // ── Load model ──────────────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    loadV2Model()
      .then(({ model, labelMap }) => {
        if (cancelled) return;
        modelRef.current    = model;
        labelMapRef.current = labelMap;
        setModelReady(true);
      })
      .catch((err) => {
        if (cancelled) return;
        console.error('[useV2Prediction] Model load failed:', err);
        setError(err.message ?? String(err));
      });
    return () => { cancelled = true; };
  }, []);

  // ── runPrediction ──────────────────────────────────────────────────────────
  const runPrediction = useCallback(async (sequence) => {
    if (!modelRef.current || !labelMapRef.current) return;

    // Throttle
    const now = Date.now();
    if (now - lastRunRef.current < PREDICTION_INTERVAL_MS) return;

    // Concurrency guard
    if (runningRef.current) return;

    lastRunRef.current = now;
    runningRef.current = true;

    try {
      const { rawLabel, confidence, topPredictions: top } =
        await runInference(modelRef.current, labelMapRef.current, sequence);

      // ── Update live state ───────────────────────────────────────────────────
      setLiveLabel(rawLabel);
      setLiveConfidence(confidence);

      const top1 = top[0] ?? { label: null, confidence: 0 };
      const top2 = top[1] ?? { label: null, confidence: 0 };
      const margin = top1.confidence - top2.confidence;

      // ── 1. Confidence threshold ─────────────────────────────────────────────
      const threshold = getThreshold(top1.label);
      if (top1.confidence < threshold) {
        // Not confident enough — reset candidate
        candidateLabelRef.current     = null;
        candidateStartedAtRef.current = 0;
        setUncertain(false);
        setUncertainMessage(null);
        setCommitStatus('Detecting…');
        return;
      }

      // ── 2. Top-2 margin check ───────────────────────────────────────────────
      if (margin < MIN_TOP2_MARGIN) {
        candidateLabelRef.current     = null;
        candidateStartedAtRef.current = 0;

        // Check if this is a known confusion pair
        if (top2.label && isConfusedPair(top1.label, top2.label) && margin < CONFUSION_PAIR_MARGIN) {
          const msg = `Uncertain gesture — complete the sign clearly`;
          setUncertain(true);
          setUncertainMessage(msg);
          setCommitStatus(msg);
        } else {
          setUncertain(false);
          setUncertainMessage(null);
          setCommitStatus('Detecting…');
        }
        return;
      }

      // ── 3. Confusion-pair extra gap check ───────────────────────────────────
      if (top2.label && isConfusedPair(top1.label, top2.label) && margin < CONFUSION_PAIR_MARGIN) {
        candidateLabelRef.current     = null;
        candidateStartedAtRef.current = 0;
        const msg = `Uncertain gesture — complete the sign clearly`;
        setUncertain(true);
        setUncertainMessage(msg);
        setCommitStatus(msg);
        return;
      }

      // Passed all checks — clear uncertain
      setUncertain(false);
      setUncertainMessage(null);

      // ── 4. Candidate stability window ──────────────────────────────────────
      if (top1.label !== candidateLabelRef.current) {
        // New label — start stability timer
        candidateLabelRef.current     = top1.label;
        candidateStartedAtRef.current = now;
        setCommitStatus('Stabilizing…');
        return;
      }

      const elapsed = now - candidateStartedAtRef.current;
      if (elapsed < COMMIT_STABILITY_MS) {
        setCommitStatus('Stabilizing…');
        return;
      }

      // ── 5. Cooldown check ──────────────────────────────────────────────────
      const sinceLast = now - lastCommitTimeRef.current;
      if (sinceLast < COMMIT_COOLDOWN_MS) {
        return;
      }

      // ── 6. Duplicate prevention ────────────────────────────────────────────
      if (top1.label === lastCommittedLabelRef.current) {
        return;
      }

      // ── ✅ Commit ───────────────────────────────────────────────────────────
      lastCommittedLabelRef.current = top1.label;
      lastCommitTimeRef.current     = now;

      // Reset candidate so same sign can't re-trigger without dropping
      candidateLabelRef.current     = null;
      candidateStartedAtRef.current = 0;

      setCommittedLabel(top1.label);
      setCommitStatus(`Committed: ${top1.label === 'THANKYOU' ? 'THANK YOU' : top1.label}`);

      // Reset committedLabel after one render cycle (it's a one-shot event)
      setTimeout(() => setCommittedLabel(null), 0);

    } catch (err) {
      console.error('[useV2Prediction] Inference error:', err);
    } finally {
      runningRef.current = false;
    }
  }, []);

  // ── clearOnNoHand — called when the hand leaves the frame ─────────────────
  /**
   * Resets all live prediction state so the UI returns to the placeholder/
   * detecting state.  Also clears lastCommittedLabel so the same sign can
   * be committed again after the hand is raised.
   */
  const clearOnNoHand = useCallback(() => {
    setLiveLabel(null);
    setLiveConfidence(0);
    setUncertain(false);
    setUncertainMessage(null);
    setCommitStatus('Detecting…');
    candidateLabelRef.current     = null;
    candidateStartedAtRef.current = 0;
    lastCommittedLabelRef.current = null;  // allow same sign to recommit
  }, []);

  // ── Reset (after clearAll) ─────────────────────────────────────────────────
  const resetPrediction = useCallback(() => {
    setLiveLabel(null);
    setLiveConfidence(0);
    setCommittedLabel(null);
    setCommitStatus('Detecting…');
    setUncertain(false);
    setUncertainMessage(null);
    candidateLabelRef.current     = null;
    candidateStartedAtRef.current = 0;
    lastCommittedLabelRef.current = null;
    lastCommitTimeRef.current     = 0;
  }, []);

  /**
   * @deprecated Use clearOnNoHand instead. Kept for API compatibility.
   * Allows the same sign to be committed again next time.
   */
  const clearLastCommitted = useCallback(() => {
    lastCommittedLabelRef.current = null;
  }, []);

  return {
    // Model
    modelReady,
    error,
    // Live prediction
    liveLabel,
    liveConfidence,
    // Commit state
    committedLabel,
    commitStatus,
    uncertain,
    uncertainMessage,
    // Actions
    runPrediction,
    resetPrediction,
    clearOnNoHand,
    clearLastCommitted, // deprecated — kept for backwards compat
  };
}
