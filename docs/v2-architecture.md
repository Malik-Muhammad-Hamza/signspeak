# SignSpeak v2 — Architecture & Design

## Overview

SignSpeak v2 replaces the rule-based Fingerpose v1 gesture detector with a
**Temporal Convolutional Network (TCN)** trained on the Hugging Face ASL dataset
(`akasheroor/American-Sign-Language-Dataset`). V1 continues to function unchanged.

> **Prototype notice:** This module recognises a limited set of 10 ASL word signs.
> It is NOT a full ASL translator.

---

## System Diagram

```
┌─────────────────────────────────────────────────┐
│               OFFLINE TRAINING (Python)         │
│                                                 │
│  HF-ASL videos  (hf_dataset.enabled: true)      │
│       │                                         │
│       ▼                                         │
│  00_download_hf_clips.py                        │
│  HF repo → per-class MP4 clips                  │
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
│  TCN (dilated same-padding Conv1D, residual)    │
│  → models/tcn_v2/best.keras                     │
│       │                                         │
│       ▼                                         │
│  04_evaluate.py                                 │
│  Top-1/2 accuracy, per-class support, confusion │
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
│  (fires onNoHand when hand disappears)          │
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
│  Commit-stability logic (in useV2Prediction):   │
│  ┌── class confidence threshold                 │
│  ├── top-2 margin guard                         │
│  ├── confusion-pair extra margin                │
│  ├── COMMIT_STABILITY_MS candidate timer        │
│  ├── COMMIT_COOLDOWN_MS cooldown                │
│  └── duplicate prevention + clearOnNoHand()    │
│       │                                         │
│       ▼                                         │
│  V2PredictionBadge + V2Overlay (debug)          │
│  transcript, TTS (Web Speech API)              │
└─────────────────────────────────────────────────┘
```

> **Note:** `predictionSmoother.js` exists in `src/v2/utils/` but is **NOT** part of
> the live runtime pipeline. The active commit logic is entirely in `useV2Prediction.js`.

---

## Normalisation Contract

The **same algorithm** is implemented in both:
- `training/` — `utils/normalizer.py` (`normalize_sequence_safe()`)
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
x → Conv1D(same padding, dilation) → BN → SpatialDropout1D
  → Conv1D(same padding, dilation) → BN → SpatialDropout1D
  → Add(skip_connection)
```

**Padding note:** The model uses `padding="same"` in both training (`03_train_tcn.py`)
and after TF.js export (`05_export_tfjs.py`). This was previously `"causal"` in training
with a post-export patch; they are now aligned. If `05_export_tfjs.py` detects any
`"causal"` layers (from a stale model checkpoint), it will warn and auto-patch, but the
recommended fix is to **retrain** with the updated `03_train_tcn.py`.

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

V2 is loaded lazily via `React.lazy` when `?v=2` is in the URL. V1 is unaffected.

---

## No-Hand State Reset

When `useV2HandDetection` detects that the hand has left the frame (edge-triggered — fires once on the first empty frame after a detection), it calls `onNoHand()`.

`V2Demo.jsx` passes `clearOnNoHand` from `useV2Prediction` as `onNoHand`. This:
- Clears `liveLabel` and `liveConfidence` (UI returns to placeholder)
- Clears the candidate stability state
- Resets `lastCommittedLabel` so the same sign can be committed again

---

## Steps to Build a New Model

1. **Data prep**: Set `hf_dataset.enabled: true` in `config.yaml`, run step 0 and 1.
2. **Dataset build**: Run step 2.
3. **Training**: Run step 3 on GPU machine (or Colab). Retraining is needed if you change padding or architecture.
4. **Evaluation**: Run step 4, review confusion matrix and support warnings.
5. **Export**: Run step 5 with `.venv-export`, verify `public/v2/model/` is populated.
6. **Refinement**: Adjust `config.yaml` (max_per_class toward 80, augmentation flags) and retrain.
