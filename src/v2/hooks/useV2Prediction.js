/**
 * SignSpeak v2 - useV2Prediction
 *
 * Handles model inference and the commit-stability gate.
 *
 * Pipeline:
 *   Webcam -> sequence -> runInference -> raw probabilities
 *   -> live prediction state
 *   -> confidence / top-2 margin checks
 *   -> candidate stability timer
 *   -> cooldown / duplicate-hold checks
 *   -> onCommit(label)
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { loadV2Model, runInference } from '../utils/modelLoader';

const PREDICTION_INTERVAL_MS = 100;
const COMMIT_STABILITY_MS = 300;
const COMMIT_COOLDOWN_MS = 500;

const DEFAULT_CONFIDENCE_THRESHOLD = 0.68;
const CLASS_THRESHOLDS = {
  THANKYOU: 0.72,
  HOME: 0.70,
  STOP: 0.70,
  SICK: 0.70,
  GOOD: 0.78,
  ME: 0.72,
  HELLO: 0.75,
  DEFAULT: DEFAULT_CONFIDENCE_THRESHOLD,
};

const MIN_TOP2_MARGIN = 0.10;
const CONFUSION_PAIR_MARGIN = 0.18;
const DEBUG_COMMIT = false;

const DISPLAY_LABELS = {
  THANKYOU: 'THANK YOU',
  ME: 'I / ME',
  FOOD: 'FOOD / EAT',
};

const TWO_HAND_REQUIRED_SIGNS = new Set([
  'HELP',
  'MORE',
]);

const CORRECTION_PAIRS = [
  new Set(['GOOD', 'THANKYOU']),
  new Set(['HELLO', 'THANKYOU']),
  new Set(['PLEASE', 'SORRY']),
  new Set(['ME', 'GOOD']),
  new Set(['ME', 'THANKYOU']),
  new Set(['STOP', 'GOOD']),
  new Set(['STOP', 'THANKYOU']),
  new Set(['NEED', 'MORE']),
  new Set(['WANT', 'HELP']),
  new Set(['HOME', 'BATHROOM']),
  new Set(['SICK', 'ME']),
  new Set(['SICK', 'WHERE']),
];

function isCorrectionPair(a, b) {
  return CORRECTION_PAIRS.some(pair => pair.has(a) && pair.has(b));
}

function getThreshold(label) {
  return CLASS_THRESHOLDS[label] ?? CLASS_THRESHOLDS.DEFAULT;
}

function debugCommit(event, details) {
  if (!DEBUG_COMMIT) return;
  console.debug('[V2 commit]', event, details);
}

export function useV2Prediction({ onCommit } = {}) {
  const [modelReady, setModelReady] = useState(false);
  const [error, setError] = useState(null);

  const [liveLabel, setLiveLabel] = useState(null);
  const [liveConfidence, setLiveConfidence] = useState(0);
  const [topPredictions, setTopPredictions] = useState([]);

  const [commitStatus, setCommitStatus] = useState('Detecting…');
  const [uncertain, setUncertain] = useState(false);
  const [uncertainMessage, setUncertainMessage] = useState(null);
  const [correctionOptions, setCorrectionOptions] = useState([]);

  const modelRef = useRef(null);
  const labelMapRef = useRef(null);

  const lastRunRef = useRef(0);
  const runningRef = useRef(false);

  const candidateLabelRef = useRef(null);
  const candidateStartedAtRef = useRef(0);
  const lastCommittedLabelRef = useRef(null);
  const lastCommitTimeRef = useRef(0);
  const canCommitRef = useRef(true);
  const onCommitRef = useRef(onCommit);

  useEffect(() => {
    onCommitRef.current = onCommit;
  }, [onCommit]);

  useEffect(() => {
    let cancelled = false;

    loadV2Model()
      .then(({ model, labelMap }) => {
        if (cancelled) return;
        modelRef.current = model;
        labelMapRef.current = labelMap;
        setModelReady(true);
      })
      .catch((err) => {
        if (cancelled) return;
        console.error('[useV2Prediction] Model load failed:', err);
        setError(err.message ?? String(err));
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const resetCandidate = useCallback(() => {
    candidateLabelRef.current = null;
    candidateStartedAtRef.current = 0;
  }, []);

  const markPredictionInvalid = useCallback(() => {
    resetCandidate();
    lastCommittedLabelRef.current = null;
    canCommitRef.current = true;
  }, [resetCandidate]);

  const commitLabel = useCallback((label, source = 'auto') => {
    if (!label) return;

    lastCommittedLabelRef.current = label;
    lastCommitTimeRef.current = Date.now();
    resetCandidate();
    canCommitRef.current = false;

    setUncertain(false);
    setUncertainMessage(null);
    setCorrectionOptions([]);
    setCommitStatus(`Committed: ${DISPLAY_LABELS[label] || label}`);
    onCommitRef.current?.(label);

    debugCommit('committed', { label, source });
  }, [resetCandidate]);

  const runPrediction = useCallback(async (sequence, handsDetectedCount = 0) => {
    if (!modelRef.current || !labelMapRef.current) return;

    const now = Date.now();
    if (now - lastRunRef.current < PREDICTION_INTERVAL_MS) return;
    if (runningRef.current) return;

    lastRunRef.current = now;
    runningRef.current = true;

    try {
      const { rawLabel, confidence, topPredictions: top } =
        await runInference(modelRef.current, labelMapRef.current, sequence);

      setLiveLabel(rawLabel);
      setLiveConfidence(confidence);
      setTopPredictions(top);

      const top1 = top[0] ?? { label: null, confidence: 0 };
      const top2 = top[1] ?? { label: null, confidence: 0 };
      const margin = top1.confidence - top2.confidence;
      const threshold = getThreshold(top1.label);
      const elapsed = top1.label === candidateLabelRef.current && candidateStartedAtRef.current
        ? now - candidateStartedAtRef.current
        : 0;
      const visibleHands = Math.min(Math.max(Number(handsDetectedCount) || 0, 0), 2);
      const cooldownRemaining = Math.max(
        0,
        COMMIT_COOLDOWN_MS - (now - lastCommitTimeRef.current),
      );

      debugCommit('frame', {
        label: top1.label,
        confidence: top1.confidence,
        candidateLabel: candidateLabelRef.current,
        elapsedStabilityMs: elapsed,
        threshold,
        top2Label: top2.label,
        top2Confidence: top2.confidence,
        top2Margin: margin,
        cooldownRemainingMs: cooldownRemaining,
        handsDetectedCount: visibleHands,
        canCommit: canCommitRef.current,
        lastCommittedLabel: lastCommittedLabelRef.current,
      });

      if (!top1.label || top1.confidence < threshold) {
        markPredictionInvalid();
        setUncertain(false);
        setUncertainMessage(null);
        setCorrectionOptions([]);
        setCommitStatus('Detecting…');
        debugCommit('blocked', {
          reason: 'below_threshold',
          label: top1.label,
          confidence: top1.confidence,
          threshold,
          candidateLabel: candidateLabelRef.current,
          elapsedStabilityMs: 0,
          top2Margin: margin,
          cooldownRemainingMs: cooldownRemaining,
          handsDetectedCount: visibleHands,
        });
        return;
      }

      if (top2.label && isCorrectionPair(top1.label, top2.label) && margin < CONFUSION_PAIR_MARGIN) {
        resetCandidate();
        const msg = 'Uncertain gesture — choose correction';
        setUncertain(true);
        setUncertainMessage(msg);
        setCorrectionOptions([
          { label: top1.label, confidence: top1.confidence },
          { label: top2.label, confidence: top2.confidence },
        ]);
        setCommitStatus(msg);
        debugCommit('blocked', {
          reason: 'correction_pair_margin',
          label: top1.label,
          confidence: top1.confidence,
          threshold,
          candidateLabel: candidateLabelRef.current,
          elapsedStabilityMs: 0,
          top2Label: top2.label,
          top2Margin: margin,
          requiredMargin: CONFUSION_PAIR_MARGIN,
          cooldownRemainingMs: cooldownRemaining,
          handsDetectedCount: visibleHands,
        });
        return;
      }

      if (margin < MIN_TOP2_MARGIN) {
        markPredictionInvalid();
        setUncertain(false);
        setUncertainMessage(null);
        setCorrectionOptions([]);
        setCommitStatus('Detecting…');
        debugCommit('blocked', {
          reason: 'low_top2_margin',
          label: top1.label,
          confidence: top1.confidence,
          threshold,
          candidateLabel: candidateLabelRef.current,
          elapsedStabilityMs: 0,
          top2Label: top2.label,
          top2Margin: margin,
          requiredMargin: MIN_TOP2_MARGIN,
          cooldownRemainingMs: cooldownRemaining,
          handsDetectedCount: visibleHands,
        });
        return;
      }

      setUncertain(false);
      setUncertainMessage(null);
      setCorrectionOptions([]);

      if (TWO_HAND_REQUIRED_SIGNS.has(top1.label) && visibleHands < 2) {
        markPredictionInvalid();
        const msg = `${DISPLAY_LABELS[top1.label] || top1.label} requires two hands`;
        setUncertain(true);
        setUncertainMessage(msg);
        setCorrectionOptions([]);
        setCommitStatus(msg);
        debugCommit('blocked', {
          reason: 'two_hands_required',
          label: top1.label,
          confidence: top1.confidence,
          threshold,
          candidateLabel: candidateLabelRef.current,
          elapsedStabilityMs: 0,
          top2Margin: margin,
          cooldownRemainingMs: cooldownRemaining,
          handsDetectedCount: visibleHands,
        });
        return;
      }

      if (!canCommitRef.current && top1.label === lastCommittedLabelRef.current) {
        setCommitStatus(`Committed: ${DISPLAY_LABELS[top1.label] || top1.label}`);
        debugCommit('blocked', {
          reason: 'duplicate_hold',
          label: top1.label,
          confidence: top1.confidence,
          threshold,
          candidateLabel: candidateLabelRef.current,
          elapsedStabilityMs: elapsed,
          top2Margin: margin,
          cooldownRemainingMs: cooldownRemaining,
          handsDetectedCount: visibleHands,
        });
        return;
      }

      if (top1.label !== candidateLabelRef.current) {
        candidateLabelRef.current = top1.label;
        candidateStartedAtRef.current = now;
        setCommitStatus('Stabilizing…');
        debugCommit('blocked', {
          reason: 'candidate_started',
          label: top1.label,
          confidence: top1.confidence,
          threshold,
          candidateLabel: candidateLabelRef.current,
          elapsedStabilityMs: 0,
          top2Margin: margin,
          cooldownRemainingMs: cooldownRemaining,
          handsDetectedCount: visibleHands,
        });
        return;
      }

      const stableElapsed = now - candidateStartedAtRef.current;
      if (stableElapsed < COMMIT_STABILITY_MS) {
        setCommitStatus('Stabilizing…');
        debugCommit('blocked', {
          reason: 'stability_window',
          label: top1.label,
          confidence: top1.confidence,
          threshold,
          candidateLabel: candidateLabelRef.current,
          elapsedStabilityMs: stableElapsed,
          requiredStabilityMs: COMMIT_STABILITY_MS,
          top2Margin: margin,
          cooldownRemainingMs: cooldownRemaining,
          handsDetectedCount: visibleHands,
        });
        return;
      }

      const sinceLast = now - lastCommitTimeRef.current;
      if (sinceLast < COMMIT_COOLDOWN_MS) {
        debugCommit('blocked', {
          reason: 'cooldown',
          label: top1.label,
          confidence: top1.confidence,
          threshold,
          candidateLabel: candidateLabelRef.current,
          elapsedStabilityMs: stableElapsed,
          top2Margin: margin,
          cooldownRemainingMs: COMMIT_COOLDOWN_MS - sinceLast,
          handsDetectedCount: visibleHands,
        });
        return;
      }

      if (top1.label === lastCommittedLabelRef.current) {
        debugCommit('blocked', {
          reason: 'duplicate_label',
          label: top1.label,
          confidence: top1.confidence,
          threshold,
          candidateLabel: candidateLabelRef.current,
          elapsedStabilityMs: stableElapsed,
          top2Margin: margin,
          cooldownRemainingMs: 0,
          handsDetectedCount: visibleHands,
        });
        return;
      }

      commitLabel(top1.label, 'auto');
    } catch (err) {
      console.error('[useV2Prediction] Inference error:', err);
    } finally {
      runningRef.current = false;
    }
  }, [commitLabel, markPredictionInvalid, resetCandidate]);

  const commitCorrection = useCallback((label) => {
    commitLabel(label, 'manual_correction');
  }, [commitLabel]);

  const clearOnNoHand = useCallback(() => {
    setLiveLabel(null);
    setLiveConfidence(0);
    setTopPredictions([]);
    setUncertain(false);
    setUncertainMessage(null);
    setCorrectionOptions([]);
    setCommitStatus('Detecting…');
    resetCandidate();
    lastCommittedLabelRef.current = null;
    canCommitRef.current = true;
    debugCommit('reset', { reason: 'no_hand' });
  }, [resetCandidate]);

  const resetPrediction = useCallback(() => {
    setLiveLabel(null);
    setLiveConfidence(0);
    setTopPredictions([]);
    setCommitStatus('Detecting…');
    setUncertain(false);
    setUncertainMessage(null);
    setCorrectionOptions([]);
    resetCandidate();
    lastCommittedLabelRef.current = null;
    lastCommitTimeRef.current = 0;
    canCommitRef.current = true;
    debugCommit('reset', { reason: 'manual_reset' });
  }, [resetCandidate]);

  /**
   * @deprecated Use clearOnNoHand instead. Kept for API compatibility.
   */
  const clearLastCommitted = useCallback(() => {
    lastCommittedLabelRef.current = null;
    canCommitRef.current = true;
  }, []);

  return {
    modelReady,
    error,
    liveLabel,
    liveConfidence,
    topPredictions,
    commitStatus,
    uncertain,
    uncertainMessage,
    correctionOptions,
    commitCorrection,
    runPrediction,
    resetPrediction,
    clearOnNoHand,
    clearLastCommitted,
  };
}
