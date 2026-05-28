# SignSpeak v2 — Training Notes

> **Disclaimer**: This prototype recognizes a limited trained vocabulary of ASL word signs.
> It is NOT a full ASL translator and should not be used for medical, legal, or safety-critical
> applications.

---

## Overview

SignSpeak v2 is a TCN (Temporal Convolutional Network) based ASL word sign recognition system
that runs directly in the browser using TensorFlow.js. It uses MediaPipe Hands for landmark
extraction and a sliding-window buffer to collect sequences of 32 frames for classification.

---

## Supported Labels (10 Classes)

| ID | Label    | Display   | Notes                                      |
|----|----------|-----------|--------------------------------------------|
| 0  | HELLO    | HELLO     |                                            |
| 1  | YES      | YES       |                                            |
| 2  | NO       | NO        |                                            |
| 3  | HELP     | HELP      |                                            |
| 4  | THANKYOU | THANK YOU | Aliases: "THANK YOU", "THANKS", "THANK"    |
| 5  | PLEASE   | PLEASE    |                                            |
| 6  | SORRY    | SORRY     | Aliases: "APOLOGIZE"                       |
| 7  | GOOD     | GOOD      | Easily confused with THANKYOU (see below)  |
| 8  | STOP     | STOP      |                                            |
| 9  | WATER    | WATER     |                                            |

### Known Confusions

- **THANKYOU ↔ GOOD**: These two signs share similar hand shape and wrist motion.
  The frontend applies a class-specific confidence threshold (0.82) and a minimum
  confidence gap guard (0.20) for this pair. When the model is uncertain between
  these two, it shows "Uncertain: Good / Thank You" instead of auto-committing.

**Mitigations applied:**
- Class-specific confidence thresholds in `useV2Prediction.js` (`CLASS_THRESHOLDS`)
- Top-1 / Top-2 confidence gap guard (`MIN_TOP2_MARGIN = 0.18`)
- Confusion-pair extra margin guard (`CONFUSION_PAIR_MARGIN = 0.22`)
- Class aliases in `config.yaml` to supplement THANKYOU training data

---

## Dataset

### Source
- **Primary**: Hugging Face dataset `akasheroor/American-Sign-Language-Dataset`
- **Mode**: `hf_dataset.enabled: true` in `config.yaml`

### Size (recommended)
- Target: **50–80 videos per class** (`max_per_class: 80`)
- Strategy: `balance_strategy: "cap"` to avoid extreme class imbalance

### Dataset Pipeline Summary
```
00_download_hf_clips.py   → downloads videos per class with alias matching
01_extract_landmarks.py   → MediaPipe Hands extracts (T, 21, 3) landmark arrays
02_build_dataset.py       → samples to 32 frames, normalises, stratified split
03_train_tcn.py           → trains TCN, saves best.keras + training_summary.json
04_evaluate.py            → confusion matrix, per-class accuracy, confusion pairs
05_export_tfjs.py         → exports best.keras → public/v2/model/ (LayersModel)
```

---

## Preprocessing Steps

### 1. Video Download (`00_download_hf_clips.py`)
- Lists all files in HF repo via `list_repo_files()`
- Matches by hyphen-suffix label (`0123-THANK YOU.mp4` → THANKYOU)
- Applies class aliases: "THANK YOU", "THANKS", "THANK" → THANKYOU
- Caps to `max_per_class` per class when `balance_strategy: "cap"`

### 2. Landmark Extraction (`01_extract_landmarks.py`)
- Runs MediaPipe Hands (model_complexity=1, 1 hand)
- Quality filters:
  - Minimum clip frames: `min_clip_frames: 8`
  - Minimum valid frame ratio: `min_valid_frame_ratio: 0.40`
  - Rejects NaN/Inf values
  - Rejects invalid landmark shapes
- Saves `.npy` (T, 21, 3) per clip + `.label` sidecar

### 3. Dataset Building (`02_build_dataset.py`)
- Uniform temporal resampling to exactly 32 frames
- Wrist-relative normalisation (landmark 0 subtracted)
- Max-abs scale normalisation (all values in [-1, 1])
- **Stratified** train/val/test split (every class in every split)
- Default split: 80% train / 10% val / 10% test

### 4. Normalisation Algorithm
**Both Python and JavaScript must use identical normalisation:**

```python
# Python: training/utils/normalizer.py → normalize_frame()
wrist   = frame[0]
shifted = frame - wrist
flat    = shifted.flatten()
max_abs = np.abs(flat).max()
normed  = flat / max_abs   # if max_abs > 1e-6
```

```javascript
// JS: src/v2/utils/landmarkNormalizer.js → normalizeLandmarks()
// Step 1: wrist-relative
raw[i*3+0] = landmarks[i].x - wrist.x;
// Step 2: max-abs scale
raw[i] /= maxAbs;   // if maxAbs > 1e-6
```

> ⚠️ Any change to normalisation **must** be applied to **both** files.

---

## Model Input Shape

| Parameter   | Value |
|-------------|-------|
| Frame count | 32    |
| Landmarks   | 21    |
| Coords/lm   | 3 (x, y, z) |
| Feature size | 63 (21 × 3) |
| Input shape | [32, 63] |

This is a **one-hand** model. Two-hand input [32, 126] is a planned future upgrade.

---

## Model Architecture (TCN)

```
Input [batch, 32, 63]
  │
  ├── TCN Block 1 (filters=64,  dilation=1)
  │     Conv1D → BatchNorm → SpatialDropout1D  ×2  + Residual
  ├── TCN Block 2 (filters=128, dilation=2)
  │     Conv1D → BatchNorm → SpatialDropout1D  ×2  + Residual
  └── TCN Block 3 (filters=256, dilation=4)
        Conv1D → BatchNorm → SpatialDropout1D  ×2  + Residual
  │
  ├── GlobalAveragePooling1D
  ├── Dense(128, relu)
  ├── Dropout(0.3)
  └── Dense(10, softmax)  →  [batch, 10]
```

**Design choices for browser performance:**
- `GlobalAveragePooling1D` instead of `Flatten` (fewer parameters)
- `SpatialDropout1D` for better sequence regularisation
- `BatchNormalization` for stable training
- No LSTM / attention (too slow in browser)
- Target model size: < 5 MB unquantised

---

## Training Settings

| Setting               | Value                 |
|-----------------------|-----------------------|
| Epochs (max)          | 80                    |
| Batch size            | 32                    |
| Learning rate         | 1e-3                  |
| LR patience           | 8 epochs              |
| LR reduce factor      | 0.5                   |
| Early stop patience   | 20 epochs             |
| Optimizer             | Adam                  |
| Loss                  | sparse_categorical_crossentropy |
| Metrics               | accuracy, top-2 accuracy |
| Class weights         | Balanced (N / n_classes / class_count) |
| Seed                  | 42                    |

**Outputs:**
- `models/tcn_v2/best.keras` — best val_accuracy checkpoint
- `models/tcn_v2/final.keras` — model at end of training
- `models/tcn_v2/training_history.csv` — epoch-by-epoch metrics
- `models/tcn_v2/training_summary.json` — full training metadata
- `models/tcn_v2/evaluation/confusion_matrix.png`
- `models/tcn_v2/evaluation/evaluation_summary.json`
- `models/tcn_v2/evaluation/classification_report.txt`

---

## Evaluation Results

*(Fill in after running 04_evaluate.py)*

| Metric              | Value |
|---------------------|-------|
| Test top-1 accuracy | TBD   |
| Test top-2 accuracy | TBD   |
| Test samples        | TBD   |

**Per-class accuracy** (expected weak classes):
- THANKYOU vs GOOD — highest confusion rate

---

## Frontend Inference

### Prediction Throttling
Model inference is throttled to **100 ms minimum interval** (`PREDICTION_INTERVAL_MS = 100`)
in `useV2Prediction.js`. This prevents GPU overload without affecting responsiveness.

### Commit-Stability Logic (in `useV2Prediction.js`)

The live commit logic is implemented directly in `useV2Prediction.js`:

1. **Class-specific confidence threshold** (`CLASS_THRESHOLDS`):
   - THANKYOU: 0.84,  GOOD: 0.84,  HELLO: 0.82,  DEFAULT: 0.78
2. **Top-2 margin guard**: top-1 − top-2 ≥ 0.18 (`MIN_TOP2_MARGIN`)
3. **Confusion-pair extra margin**: HELLO↔THANKYOU, GOOD↔THANKYOU, PLEASE↔SORRY —
   if gap < 0.22 (`CONFUSION_PAIR_MARGIN`), show "Uncertain gesture" instead of committing
4. **Candidate stability timer**: label must stay top-1 for ≥ 400ms (`COMMIT_STABILITY_MS`)
5. **Commit cooldown**: 700ms between consecutive commits (`COMMIT_COOLDOWN_MS`)
6. **Duplicate prevention**: same label not committed twice in a row

> ⚠️ `predictionSmoother.js` exists in `src/v2/utils/` but is **NOT** imported or used
> at runtime. It is a reference implementation only. Do not rely on its behaviour.

### No-Hand Signal
When `useV2HandDetection` detects the hand leaving the frame, it fires `onNoHand()`.
`V2Demo.jsx` passes `clearOnNoHand` from `useV2Prediction` as this callback.
`clearOnNoHand()` resets: `liveLabel`, `liveConfidence`, candidate state, `uncertain` flag,
and `lastCommittedLabel` — allowing the same sign to be committed again after re-raising the hand.

---

## TF.js Export

```bash
cd C:\Web-Dev\Project\signspeak
.\\training\\.venv-export\\Scripts\\python.exe training\\05_export_tfjs.py
```

**Output format:** LayersModel (`format: "layers-model"` in model.json)  
**Source:** Always exports from `models/tcn_v2/best.keras`  
**Padding validation:** The script checks exported Conv1D layers for `padding="causal"`.  
If found (stale checkpoint trained before the padding fix), it warns and auto-patches.  
The correct fix is to **retrain** with the updated `03_train_tcn.py` (which uses `padding="same"`).  
**Label map:** Copied to `public/v2/model/label_map.json`

---

## Known Issues & Limitations

1. **THANKYOU ↔ GOOD confusion** — similar hand shape, partially mitigated by confidence gap guard
2. **One-hand only** — dominant hand assumed; no two-hand support yet
3. **Lighting sensitivity** — MediaPipe may miss hand in poor lighting
4. **Background noise** — busy backgrounds reduce detection confidence
5. **Signer variance** — trained on internet videos, may not match all signing styles
6. **10-word vocabulary** — not a general ASL translator

---

## Future Upgrades

- [ ] **Two-hand model** [32, 126] — upgrade when dataset covers two-handed signs
- [ ] **Data augmentation** — flip, jitter, time-warp for improved robustness
- [ ] **Attention mechanism** — self-attention over temporal dimension
- [ ] **Quantization** — enable `quantize: true` in config.yaml for smaller browser model
- [ ] **Expanded vocabulary** — add more classes (ILY, SORRY subset, etc.)
- [ ] **Handedness normalization** — mirror left-hand landmarks to right-hand space

---

## Environment Setup

See `training/ENVIRONMENT_SETUP.md` for Python venv setup instructions.

**Training venv**: `.venv` — Python 3.11, MediaPipe, TensorFlow, OpenCV  
**Export venv**: `.venv-export` — Python 3.11, TensorFlowJS  

Do NOT mix these environments.
