# SignSpeak v2 — Training Pipeline

This directory contains the **offline Python pipeline** for training the TCN model on MS-ASL data.

## Directory layout

```
training/
├── README.md                    # This file
├── requirements.txt             # Python dependencies
├── config.yaml                  # Central training configuration
├── 01_extract_landmarks.py      # MS-ASL video → MediaPipe landmarks (.npy)
├── 02_build_dataset.py          # Landmarks → normalised 32-frame sequences (HDF5)
├── 03_train_tcn.py              # Train TCN model
├── 04_evaluate.py               # Per-class accuracy / confusion matrix
├── 05_export_tfjs.py            # Keras → TF.js SavedModel
└── utils/
    ├── normalizer.py            # Python version of landmarkNormalizer.js
    ├── frame_sampler.py         # Uniform 32-frame sampling from variable-length clips
    └── label_map.py             # Build & save label_map.json
```

## Pipeline steps

| Step | Script | Input | Output |
|------|--------|-------|--------|
| 1 | `01_extract_landmarks.py` | MS-ASL mp4 clips | `data/landmarks/*.npy` |
| 2 | `02_build_dataset.py` | `data/landmarks/` | `data/dataset.h5` |
| 3 | `03_train_tcn.py` | `data/dataset.h5` | `models/tcn_v2/` |
| 4 | `04_evaluate.py` | `models/tcn_v2/` | `reports/` |
| 5 | `05_export_tfjs.py` | `models/tcn_v2/` | `public/v2/model/` |

## Quick start

```bash
cd training
python -m venv .venv
.venv\Scripts\activate          # Windows
pip install -r requirements.txt

# Edit config.yaml — set data paths, num_classes, etc.
python 01_extract_landmarks.py
python 02_build_dataset.py
python 03_train_tcn.py
python 04_evaluate.py
python 05_export_tfjs.py
```

## MS-ASL dataset

Download from: https://www.microsoft.com/en-us/research/project/ms-asl/
Expected directory structure:
```
data/
└── ms_asl/
    ├── MSASL_train.json
    ├── MSASL_val.json
    ├── MSASL_test.json
    └── videos/
        └── <signer_id>/
            └── <clip_id>.mp4
```
