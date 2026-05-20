/**
 * SignSpeak v2 — Model Loader
 *
 * Loads the TF.js TCN model and label map from the public directory,
 * runs a warm-up inference, and returns ready-to-use references.
 *
 * Expected public asset layout:
 *   public/v2/model/model.json
 *   public/v2/model/label_map.json   → { "0": "A", "1": "B", … }
 *   public/v2/model/group1-shard*.bin
 *
 * Usage (inside a React component / hook):
 *   const { model, labelMap, error } = await loadV2Model();
 */

import * as tf from '@tensorflow/tfjs';

const MODEL_URL = '/v2/model/model.json';
const LABEL_MAP_URL = '/v2/model/label_map.json';

// Singleton cache so the model is loaded only once per session
let cachedModel = null;
let cachedLabelMap = null;

/**
 * @returns {Promise<{ model: tf.LayersModel, labelMap: Object<string,string> }>}
 */
export async function loadV2Model() {
  if (cachedModel && cachedLabelMap) {
    return { model: cachedModel, labelMap: cachedLabelMap };
  }

  // Load label map first (small JSON fetch)
  const labelRes = await fetch(LABEL_MAP_URL);
  if (!labelRes.ok) {
    throw new Error(`[V2 ModelLoader] Failed to fetch label map: ${labelRes.status}`);
  }
  const labelMap = await labelRes.json();

  // Load TF.js model
  const model = await tf.loadLayersModel(MODEL_URL);

  // Warm-up inference to initialise WebGL kernels
  const numClasses = Object.keys(labelMap).length;
  const warmup = tf.zeros([1, 32, 63]);
  const result = model.predict(warmup);
  result.dispose();
  warmup.dispose();

  cachedModel = model;
  cachedLabelMap = labelMap;

  console.info('[SignSpeak v2] Model loaded.', {
    inputShape: model.inputs[0].shape,
    outputShape: model.outputs[0].shape,
    numClasses,
  });

  return { model, labelMap };
}

/**
 * Run a single inference pass.
 *
 * @param {tf.LayersModel} model
 * @param {Float32Array}   sequence  Flat [32 * 63] array (oldest-first)
 * @returns {{ label: string, confidence: number, probabilities: Float32Array }}
 */
export function runInference(model, labelMap, sequence) {
  return tf.tidy(() => {
    const input = tf.tensor3d(sequence, [1, 32, 63]);
    const output = model.predict(input); // [1, numClasses]
    const probs = output.dataSync();

    let bestIdx = 0;
    let bestProb = 0;
    for (let i = 0; i < probs.length; i++) {
      if (probs[i] > bestProb) {
        bestProb = probs[i];
        bestIdx = i;
      }
    }

    const label = labelMap[String(bestIdx)] ?? `class_${bestIdx}`;
    return { label, confidence: bestProb, probabilities: Float32Array.from(probs) };
  });
}
