/**
 * SignSpeak v2 — Model Loader
 *
 * Loads the TF.js TCN model and label map from the public directory,
 * runs a warm-up inference, and returns ready-to-use references.
 *
 * Expected public asset layout:
 *   public/v2/model/model.json
 *   public/v2/model/label_map.json   → { "0": "HELLO", "1": "YES", … }
 *   public/v2/model/group1-shard*.bin
 *
 * NOTE: import.meta.env.BASE_URL is injected by Vite at build time
 * and equals the `base` option in vite.config.js (e.g. "/signspeak/").
 * All asset fetches must be relative to this base to avoid 404s.
 */

import * as tf from '@tensorflow/tfjs';

// ── Asset URLs (BASE_URL-aware) ───────────────────────────────────────────────
const base        = import.meta.env.BASE_URL || '/';
const MODEL_URL   = `${base}v2/model/model.json`;
const LABEL_MAP_URL = `${base}v2/model/label_map.json`;

// Singleton cache — model loaded only once per session
let cachedModel    = null;
let cachedLabelMap = null;

// ── Display name overrides ────────────────────────────────────────────────────
// The label map uses compact keys (e.g. "THANKYOU").
// Map them to human-readable display strings shown in the UI.
const DISPLAY_NAMES = {
  THANKYOU: 'THANK YOU',
};

/** Return the human-readable label for a raw class name. */
function displayName(raw) {
  return DISPLAY_NAMES[raw] ?? raw;
}

/**
 * @returns {Promise<{ model: tf.LayersModel, labelMap: Object<string,string> }>}
 */
export async function loadV2Model() {
  if (cachedModel && cachedLabelMap) {
    return { model: cachedModel, labelMap: cachedLabelMap };
  }

  console.log('[V2 ModelLoader] modelUrl    :', MODEL_URL);
  console.log('[V2 ModelLoader] labelMapUrl :', LABEL_MAP_URL);

  // ── Load label map (small JSON fetch) ────────────────────────────────────
  const labelRes = await fetch(LABEL_MAP_URL);
  if (!labelRes.ok) {
    throw new Error(
      `[V2 ModelLoader] Failed to fetch label map: ${LABEL_MAP_URL} → HTTP ${labelRes.status}`,
    );
  }
  const labelMap = await labelRes.json();
  console.log('[V2 ModelLoader] label map loaded:', labelMap);

  // ── Load TF.js LayersModel ─────────────────────────────────────────────
  // The model was exported with tensorflowjs.converters.save_keras_model(),
  // which produces a LayersModel (weightsManifest format).
  // Use tf.loadLayersModel — NOT tf.loadGraphModel.
  let model;
  try {
    model = await tf.loadLayersModel(MODEL_URL);
  } catch (err) {
    throw new Error(
      `[V2 ModelLoader] Failed to load model: ${MODEL_URL} → ${err.message ?? err}`,
    );
  }

  // ── Warm-up inference ─────────────────────────────────────────────────
  const warmup = tf.zeros([1, 32, 63]);
  const result = model.predict(warmup);
  result.dispose();
  warmup.dispose();

  cachedModel    = model;
  cachedLabelMap = labelMap;

  console.info('[SignSpeak v2] Model ready.', {
    inputShape:  model.inputs[0].shape,
    outputShape: model.outputs[0].shape,
    numClasses:  Object.keys(labelMap).length,
  });

  return { model, labelMap };
}

/**
 * Run a single inference pass.
 *
 * @param {tf.LayersModel} model
 * @param {Object<string,string>} labelMap
 * @param {Float32Array} sequence  Flat [32 * 63] array (oldest-first)
 * @returns {Promise<{ label: string, confidence: number, probabilities: Float32Array }>}
 */
export async function runInference(model, labelMap, sequence) {
  const input  = tf.tensor3d(sequence, [1, 32, 63]);
  const output = model.predict(input);   // [1, numClasses]

  // Use async data() — non-blocking, works in WebGL backend
  const probs = await output.data();
  input.dispose();
  output.dispose();

  let bestIdx  = 0;
  let bestProb = 0;
  for (let i = 0; i < probs.length; i++) {
    if (probs[i] > bestProb) {
      bestProb = probs[i];
      bestIdx  = i;
    }
  }

  const rawLabel = labelMap[String(bestIdx)] ?? `class_${bestIdx}`;
  const label    = displayName(rawLabel);
  return { label, confidence: bestProb, probabilities: Float32Array.from(probs) };
}

