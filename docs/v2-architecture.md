# SignSpeak v2 — Architecture & Design

## Overview

SignSpeak v2 replaces the rule-based Fingerpose v1 gesture detector with a
**Temporal Convolutional Network (TCN)** trained on MS-ASL video data.
V1 continues to function unchanged.

---

## System Diagram

```
┌─────────────────────────────────────────────────┐
│               OFFLINE TRAINING (Python)         │
│                                                 │
│  MS-ASL videos                                  │
│       │                                         │
│       ▼                                         │
│  01_extract_landmarks.py                        │
│  MediaPipe Hands → (T, 21, 3) .npy per clip    │
│       │                                         │
│       ▼                                         │
│  02_build_dataset.py                            │
│  uniform 32-frame sample + normalise            │
│  → dataset.h5  [N, 32, 63]                     │
│  → label_map.json                               │
│       │                                         │
│       ▼                                         │
│  03_train_tcn.py                                │
│  TCN (dilated causal conv, residual)            │
│  → models/tcn_v2/best.keras                     │
│       │                                         │
│       ▼                                         │
│  04_evaluate.py                                 │
│  Top-1/3 accuracy, confusion matrix             │
│       │                                         │
│       ▼                                         │
│  05_export_tfjs.py                              │
│  → public/v2/model/{model.json, *.bin,          │
│                      label_map.json}            │
└─────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────┐
│            BROWSER INFERENCE (React + TF.js)    │
│                                                 │
│  Webcam <video>                                 │
│       │                                         │
│       ▼                                         │
│  useV2HandDetection                             │
│  MediaPipe Hands → 21 landmarks/frame          │
│       │                                         │
│       ▼                                         │
│  landmarkNormalizer                             │
│  wrist-relative + scale-invariant → 63 floats  │
│       │                                         │
│       ▼                                         │
│  frameBuffer (ring buffer, capacity=32)         │
│  slides 1 frame per detection cycle            │
│       │ (when full)                             │
│       ▼                                         │
│  useV2Prediction → TF.js model.predict()        │
│  output: softmax [1, N_classes]                 │
│       │                                         │
│       ▼                                         │
│  predictionSmoother (majority-vote, window=10)  │
│  stable label only when ≥60 % agreement        │
│       │                                         │
│       ▼                                         │
│  V2PredictionBadge + V2Overlay (debug)          │
│  text / TTS output (existing speechOutput.js)  │
└─────────────────────────────────────────────────┘
```

---

## Normalisation Contract

The **same algorithm** is implemented in both:
- `training/` — `02_build_dataset.py` (`normalize()`)  
- `src/v2/utils/landmarkNormalizer.js` (`normalizeLandmarks()`)

**Steps**:
1. Subtract wrist (landmark 0) from all 21 landmarks → origin at wrist.
2. Divide every coordinate by `max(|x|, |y|, |z|)` across the whole hand → range `[-1, 1]`.
3. Flatten to 63-element vector: `[x0,y0,z0, …, x20,y20,z20]`.

> ⚠️ If the normalisation drifts between Python and JS, inference quality will degrade silently. Any change must be applied to **both** files simultaneously.

---

## TCN Architecture

```
Input [1, 32, 63]
  └─ ResidualTCNBlock(filters=64,  dilation=1)
  └─ ResidualTCNBlock(filters=128, dilation=2)
  └─ ResidualTCNBlock(filters=256, dilation=4)
  └─ GlobalAveragePooling1D
  └─ Dense(128, relu)
  └─ Dropout(0.3)
  └─ Dense(N_classes, softmax)
Output [1, N_classes]
```

Each `ResidualTCNBlock`:
```
x → Conv1D(causal, dilation) → BN → Dropout
  → Conv1D(causal, dilation) → BN → Dropout
  → Add(skip_connection)
```

---

## Model Asset Contract

| Asset | Path | Loaded by |
|-------|------|-----------|
| TF.js topology | `public/v2/model/model.json` | `modelLoader.js` |
| Weight shards | `public/v2/model/group1-shard*.bin` | TF.js (auto) |
| Label map | `public/v2/model/label_map.json` | `modelLoader.js` |

The React app uses a **singleton loader** — model is loaded once per session and cached.

---

## V1 / V2 Coexistence

| Aspect | V1 (unchanged) | V2 (new) |
|--------|---------------|----------|
| Detection | Fingerpose rules | TCN model |
| Input | Single frame landmarks | 32-frame sequence |
| Files | `src/utils/gestureDetector.js` | `src/v2/` (isolated directory) |
| Model | None (rule-based) | `public/v2/model/` |
| Hook | `useHandDetection.js` | `useV2HandDetection.js` |
| Training | N/A | `training/` Python pipeline |

V2 components can be **imported optionally** in `App.jsx` behind a feature flag or
a separate route without affecting the v1 render path at all.

---

## Next Steps

1. **Data prep**: Download MS-ASL, set `config.yaml` paths, run steps 1–2.
2. **Training**: Run step 3 on GPU machine (or Colab).
3. **Evaluation**: Run step 4, review confusion matrix.
4. **Export**: Run step 5, verify `public/v2/model/` is populated.
5. **Integration**: Import `useV2HandDetection` + `useV2Prediction` + `V2PredictionBadge` into `App.jsx` (behind a v2 toggle or new route).
6. **Refinement**: Adjust `config.yaml` (num_classes, TCN depth) and retrain.
