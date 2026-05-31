# SignSpeak v2 - TCN Inference Module

This directory contains all v2-specific React source files.
V1 files in `src/` outside this directory are untouched.

## Directory Layout

```text
src/v2/
├── hooks/
│   ├── useV2HandDetection.js
│   └── useV2Prediction.js
├── components/
│   ├── V2Overlay.jsx
│   └── V2PredictionBadge.jsx
├── utils/
│   ├── landmarkNormalizer.js
│   ├── frameBuffer.js
│   └── modelLoader.js
└── README.md
```

## Data Flow

```text
Webcam
  -> MediaPipe Hands (up to 2 hands, 21 landmarks x 3 each)
  -> landmarkNormalizer (126 floats per frame: left hand + right hand)
  -> frameBuffer (accumulate -> [32, 126] tensor)
  -> TF.js TCN model
  -> commit-stability logic in useV2Prediction.js
  -> UI output (V2PredictionBadge, transcript, TTS)
```

The commit-stability logic lives entirely in `useV2Prediction.js`.

## No-Hand Reset

`useV2HandDetection` fires `onNoHand()` when all hands disappear.
`V2Demo.jsx` passes `clearOnNoHand` from `useV2Prediction` as this callback.
This resets live prediction state and allows the same sign to be committed
again after the hands leave and re-enter frame.

## Model Contract

| Property | Value |
|---|---|
| Input shape | `[1, 32, 126]` |
| Output shape | `[1, N]`, where `N` is the label map size |
| Features | `[left_hand_63, right_hand_63]` |
| Missing hand | 63 zeros |
| Label map | loaded from `public/v2/model/label_map.json` |

## Model Assets

Exported TF.js model files live at:

```text
public/v2/model/
├── model.json
├── label_map.json
└── group1-shard*.bin
```
