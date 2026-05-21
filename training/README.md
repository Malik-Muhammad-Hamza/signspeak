# SignSpeak v2 — Training Pipeline

This directory contains the **offline Python pipeline** for training the TCN model on MS-ASL data.

> **Important:** The MS-ASL zip contains only metadata (JSON) + YouTube links — no video files.
> You must run `00_download_clips.py` first to fetch the actual clips before extracting landmarks.

---

## Directory layout

```
training/
├── README.md                    # This file
├── ENVIRONMENT_SETUP.md         # Python 3.11 venv setup guide
├── requirements.txt             # Pinned Python dependencies (Python 3.11)
├── config.yaml                  # Central training configuration
├── 00_download_clips.py         # YouTube → trimmed mp4 clips + manifest CSV  ← NEW
├── 01_extract_landmarks.py      # mp4 clips → MediaPipe landmarks (.npy)
├── 02_build_dataset.py          # Landmarks → normalised 32-frame sequences (HDF5)
├── 03_train_tcn.py              # Train TCN model
├── 04_evaluate.py               # Per-class accuracy / confusion matrix
├── 05_export_tfjs.py            # Keras → TF.js SavedModel
└── utils/
    ├── normalizer.py            # Python version of landmarkNormalizer.js
    ├── frame_sampler.py         # Uniform 32-frame sampling from variable-length clips
    └── label_map.py             # Build & save label_map.json
```

---

## Pipeline steps

| Step | Script | Input | Output |
|------|--------|-------|--------|
| 0 | `00_download_clips.py` | `MSASL_*.json` + YouTube | `videos/{split}/{label}/*.mp4` + `processed/clips_manifest.csv` |
| 1 | `01_extract_landmarks.py` | `processed/clips_manifest.csv` | `landmarks/{split}/{label}/*.npy` |
| 2 | `02_build_dataset.py` | `landmarks/` | `processed/dataset.h5` + `processed/label_map.json` |
| 3 | `03_train_tcn.py` | `processed/dataset.h5` | `models/tcn_v2/` |
| 4 | `04_evaluate.py` | `models/tcn_v2/` | `reports/` |
| 5 | `05_export_tfjs.py` | `models/tcn_v2/` | `public/v2/model/` |

All paths are controlled by `config.yaml`. Default dataset root: `C:/Web-Dev/Datasets/MS-ASL/`.

---

## Python Environment

**Python 3.11 (64-bit) is required.** Do not use Python 3.12 or 3.14.

The extraction script (`01_extract_landmarks.py`) depends on the **legacy MediaPipe
Solutions API** (`mp.solutions.hands`). The pinned versions in `requirements.txt`
ensure this API is available and that TensorFlow / Protobuf conflicts are avoided.

For full setup instructions — including venv creation, activation, verification, and
the deferred TensorFlow.js export environment — see:

👉 **[ENVIRONMENT_SETUP.md](./ENVIRONMENT_SETUP.md)**

---

## MS-ASL dataset

Download from: https://www.microsoft.com/en-us/research/project/ms-asl/

Place the metadata files **directly** inside `C:/Web-Dev/Datasets/MS-ASL/`:

```
C:/Web-Dev/Datasets/MS-ASL/
├── MSASL_train.json
├── MSASL_val.json
├── MSASL_test.json
├── MSASL_classes.json
├── MSASL_synonym.json
├── videos/          ← populated by 00_download_clips.py
├── landmarks/       ← populated by 01_extract_landmarks.py
└── processed/       ← populated by 02_build_dataset.py
```

The JSON files contain YouTube URLs, not video files. The download step handles fetching.

---

## Selected classes

Only a subset of MS-ASL classes are used. Edit `config.yaml → classes:` to change them.
Current selection (5 classes):

```
hello (0), yes (1), no (2), help (3), good (4)
```

Label IDs are **compact** (0–4) and defined by list order in `config.yaml`, not by original
MS-ASL numeric IDs.

---

## Quick start

> Complete [ENVIRONMENT_SETUP.md](./ENVIRONMENT_SETUP.md) first, then:

```powershell
cd C:\Web-Dev\Project\signspeak\training
.\training\.venv\Scripts\Activate.ps1

# Install yt-dlp (download-only tool, not in main requirements.txt)
pip install yt-dlp
# Ensure ffmpeg is on PATH: https://ffmpeg.org/download.html

# Step 0 — smoke test: download up to 10 clips per class per split
# (max_per_class_per_split: 10 is already set in config.yaml)
python 00_download_clips.py

# Step 1 — extract MediaPipe landmarks from downloaded clips
python 01_extract_landmarks.py

# Step 2 — build HDF5 dataset
python 02_build_dataset.py

# Step 3 — train TCN model
python 03_train_tcn.py

# Step 4 — evaluate
python 04_evaluate.py

# Step 5 — export TF.js (use separate export venv — see ENVIRONMENT_SETUP.md §9)
```

---

## Label ID guarantee

`label_map.json` always reflects config order:

```json
{ "0": "hello", "1": "yes", "2": "no", "3": "help", "4": "good" }
```

The original MS-ASL numeric label IDs (field `label` in the JSONs) are **never** used
as model class indices.
