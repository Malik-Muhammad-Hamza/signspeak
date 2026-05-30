/**
 * SignSpeak v2 — Model Loader
 *
 * Loads the TF.js TCN model and label map, runs a warm-up inference,
 * and returns ready-to-use references.
 *
 * Also exports runInference() which returns raw probabilities
 * needed by the prediction hook for top-2 gap guard.
 *
 * Memory safety
 * -------------
 * Tensors are created with tf.tensor3d() (no Array.from copy needed when
 * the input is already a typed array) and disposed in a finally block so
 * that disposal happens even if output.data() or downstream code throws.
 * The returned `probs` Float32Array is copied out of GPU memory before
 * disposal, so it remains valid after the tensor is gone.
 */

import * as tf from '@tensorflow/tfjs';

const DEBUG_MEMORY = false;   // set true to log tf.memory() after each inference

const base          = import.meta.env.BASE_URL || '/';
const MODEL_URL     = `${base}v2/model/model.json`;
const LABEL_MAP_URL = `${base}v2/model/label_map.json`;
const FRAME_COUNT = 32;
const FEATURE_SIZE = 126;

let cachedModel    = null;
let cachedLabelMap = null;

/**
 * @returns {Promise<{ model: tf.LayersModel, labelMap: Object<string,string> }>}
 */
export async function loadV2Model() {
  if (cachedModel && cachedLabelMap) {
    return { model: cachedModel, labelMap: cachedLabelMap };
  }

  console.log('[V2 ModelLoader] modelUrl    :', MODEL_URL);
  console.log('[V2 ModelLoader] labelMapUrl :', LABEL_MAP_URL);

  const labelRes = await fetch(LABEL_MAP_URL);
  if (!labelRes.ok) {
    throw new Error(`[V2 ModelLoader] Failed to fetch label map: HTTP ${labelRes.status}`);
  }
  const labelMap = await labelRes.json();
  console.log('[V2 ModelLoader] label map loaded:', labelMap);

  let model;
  try {
    model = await tf.loadLayersModel(MODEL_URL);
  } catch (err) {
    throw new Error(`[V2 ModelLoader] Failed to load model: ${err.message ?? err}`, { cause: err });
  }

  const inputShape = model.inputs[0].shape;
  if (inputShape[1] !== FRAME_COUNT || inputShape[2] !== FEATURE_SIZE) {
    throw new Error(`[V2 ModelLoader] Expected model input [1, ${FRAME_COUNT}, ${FEATURE_SIZE}], got ${JSON.stringify(inputShape)}`);
  }

  // Warm-up inside tf.tidy to avoid leaking tensors
  tf.tidy(() => {
    const warmup = tf.zeros([1, FRAME_COUNT, FEATURE_SIZE]);
    model.predict(warmup);
  });

  cachedModel    = model;
  cachedLabelMap = labelMap;

  console.info('[SignSpeak v2] Model ready.', {
    inputShape:  model.inputs[0].shape,
    outputShape: model.outputs[0].shape,
    numClasses:  Object.keys(labelMap).length,
    backend:     tf.getBackend(),
  });

  return { model, labelMap };
}

/**
 * Run a single inference pass.
 *
 * Tensors are disposed in a finally block — no leak even on errors.
 * The Float32Array returned in `probs` is valid after disposal because
 * output.data() copies the values out of GPU memory.
 *
 * @param {tf.LayersModel}            model
 * @param {Object<string,string>}     labelMap   { "0": "HELLO", … }
 * @param {Float32Array}              sequence   Flat [32 * 126] typed array
 *
 * @returns {Promise<{
 *   rawLabel: string,
 *   confidence: number,
 *   probs: Float32Array,
 *   topPredictions: Array<{ label: string, confidence: number }>
 * }>}
 */
export async function runInference(model, labelMap, sequence) {
  // tf.tensor3d accepts a TypedArray directly — no Array.from copy needed.
  const numClasses = Object.keys(labelMap).length;
  if (sequence.length !== FRAME_COUNT * FEATURE_SIZE) {
    throw new Error(`[V2 ModelLoader] Expected sequence length ${FRAME_COUNT * FEATURE_SIZE}, got ${sequence.length}`);
  }
  const input  = tf.tensor3d(sequence, [1, FRAME_COUNT, FEATURE_SIZE]);
  let output   = null;
  let probs;

  try {
    output = model.predict(input);
    // output.data() copies values out of GPU memory into a JS Float32Array.
    // This must complete before we dispose the tensor.
    probs = await output.data();
  } finally {
    input.dispose();
    output?.dispose();
  }

  if (DEBUG_MEMORY) {
    const mem = tf.memory();
    console.debug(`[V2 Memory] tensors=${mem.numTensors}  bytes=${mem.numBytes}`);
  }

  // Build sorted topPredictions array (all classes, descending confidence)
  const topPredictions = Array.from(probs)
    .map((p, i) => ({ label: labelMap[String(i)] ?? `class_${i}`, confidence: p }))
    .sort((a, b) => b.confidence - a.confidence);

  // Guard: if probs is shorter than expected (model/label_map mismatch)
  if (topPredictions.length !== numClasses) {
    console.warn(`[V2 ModelLoader] probs length (${topPredictions.length}) ≠ label map size (${numClasses})`);
  }

  const rawLabel   = topPredictions[0].label;
  const confidence = topPredictions[0].confidence;

  return { rawLabel, confidence, probs, topPredictions };
}
