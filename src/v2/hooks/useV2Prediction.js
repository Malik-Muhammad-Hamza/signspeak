/**
 * SignSpeak v2 — useV2Prediction
 *
 * React hook that:
 *  1. Loads the TF.js TCN model on mount.
 *  2. Accepts a 32-frame landmark sequence via `runPrediction()`.
 *  3. Returns the smoothed label, raw confidence, and model load state.
 *
 * Usage
 * -----
 *   const { runPrediction, stableLabel, confidence, modelReady, error }
 *     = useV2Prediction({ smootherWindow: 10, smootherThreshold: 0.6 });
 *
 *   // Inside useV2HandDetection's onSequenceReady:
 *   runPrediction(sequence);
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { loadV2Model, runInference } from '../utils/modelLoader';
import { createPredictionSmoother } from '../utils/predictionSmoother';

/**
 * @param {object} opts
 * @param {number} [opts.smootherWindow=10]
 * @param {number} [opts.smootherThreshold=0.6]
 */
export function useV2Prediction({
  smootherWindow = 10,
  smootherThreshold = 0.6,
} = {}) {
  const [modelReady, setModelReady] = useState(false);
  const [error, setError] = useState(null);
  const [stableLabel, setStableLabel] = useState(null);
  const [confidence, setConfidence] = useState(0);

  const modelRef = useRef(null);
  const labelMapRef = useRef(null);
  const smootherRef = useRef(
    createPredictionSmoother({ windowSize: smootherWindow, threshold: smootherThreshold }),
  );

  // Load model once on mount
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

  /**
   * Run one inference pass.
   * @param {Float32Array} sequence  Flat [32 * 63] oldest-first sequence
   */
  const runPrediction = useCallback(async (sequence) => {
    if (!modelRef.current || !labelMapRef.current) return;

    try {
      const { label, confidence: conf } = await runInference(
        modelRef.current,
        labelMapRef.current,
        sequence,
      );

      setConfidence(conf);

      const stable = smootherRef.current.push(label);
      setStableLabel(stable);
    } catch (err) {
      console.error('[useV2Prediction] Inference error:', err);
    }
  }, []);

  /** Call this when the user commits a letter to reset smoother state. */
  const resetSmoother = useCallback(() => {
    smootherRef.current.reset();
    setStableLabel(null);
    setConfidence(0);
  }, []);

  return { runPrediction, resetSmoother, stableLabel, confidence, modelReady, error };
}
