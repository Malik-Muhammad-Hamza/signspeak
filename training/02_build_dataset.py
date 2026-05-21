"""
SignSpeak v2 — Step 2: Build Dataset
=====================================
Reads extracted .npy landmark files and their .label sidecars (written by
01_extract_landmarks.py), applies:
  - Uniform temporal sampling → exactly `frame_count` frames per clip
  - Wrist-relative, scale-invariant normalisation (mirrors JS landmarkNormalizer)
  - Compact integer label encoding from config.yaml classes (NOT original MS-ASL IDs)

Writes a single HDF5 dataset and label_map.json for use in training.

Output:
  processed/dataset.h5       — keys: X_train, y_train, X_val, y_val, X_test, y_test
  processed/label_map.json   — { "0": "hello", "1": "yes", … }

Run:
  python 02_build_dataset.py
"""
# NOTE: normalize_sequence and uniform_sample live in utils/ so changes
# stay consistent with the JS counterpart (landmarkNormalizer.js).

import json
import sys
sys.stdout.reconfigure(encoding="utf-8")
from pathlib import Path

import h5py
import numpy as np
import yaml
from tqdm import tqdm

from utils.normalizer import normalize_sequence
from utils.frame_sampler import uniform_sample


def load_config(path: str = "config.yaml") -> dict:
    resolved = Path(__file__).parent / path
    with open(resolved) as f:
        return yaml.safe_load(f)


def build_compact_label_map(classes: list[str]) -> tuple[dict[str, int], dict[str, str]]:
    """
    Build deterministic compact label maps from config classes list.
    Order in the YAML list defines the integer ID — never changed by alphabetical sort.

    Returns
    -------
    label2idx : { "hello": 0, "yes": 1, … }
    idx2label : { "0": "hello", "1": "yes", … }   ← JSON-serialisable
    """
    label2idx = {cls.lower().strip(): i for i, cls in enumerate(classes)}
    idx2label = {str(i): cls for cls, i in label2idx.items()}
    return label2idx, idx2label


def load_split(
    landmarks_dir: Path,
    split: str,
    label2idx: dict[str, int],
    frame_count: int,
) -> tuple[np.ndarray, np.ndarray]:
    split_dir = landmarks_dir / split
    if not split_dir.exists():
        return (
            np.empty((0, frame_count, 63), dtype=np.float32),
            np.empty(0, dtype=np.int32),
        )

    X, y = [], []
    for label_dir in sorted(split_dir.iterdir()):
        label_name = label_dir.name.lower().strip()
        if label_name not in label2idx:
            continue

        for npy_file in tqdm(
            sorted(label_dir.glob("*.npy")),
            desc=f"{split}/{label_name}",
            leave=False,
        ):
            # Prefer compact_label_id from .label sidecar (set by 01_extract_landmarks.py)
            sidecar = npy_file.with_suffix(".label")
            if sidecar.exists():
                try:
                    compact_id = int(sidecar.read_text().strip())
                except ValueError:
                    compact_id = label2idx[label_name]
            else:
                compact_id = label2idx[label_name]

            raw     = np.load(npy_file)          # (T, 21, 3)
            sampled = uniform_sample(raw, frame_count)
            normed  = normalize_sequence(sampled)
            if normed is None:
                continue
            X.append(normed)
            y.append(compact_id)

    if not X:
        return (
            np.empty((0, frame_count, 63), dtype=np.float32),
            np.empty(0, dtype=np.int32),
        )
    return np.stack(X), np.array(y, dtype=np.int32)


def main():
    cfg = load_config()

    landmarks_dir  = Path(cfg["data"]["landmarks_dir"])
    dataset_path   = Path(cfg["data"]["dataset_path"])
    label_map_out  = Path(cfg["data"]["label_map_out"])
    frame_count    = cfg["preprocessing"]["frame_count"]
    classes        = cfg.get("classes", [])

    if not classes:
        raise ValueError("No 'classes' list found in config.yaml. Add one before building the dataset.")

    label2idx, idx2label = build_compact_label_map(classes)
    print(f"Label map ({len(label2idx)} classes): {label2idx}")

    # Save label_map.json
    label_map_out.parent.mkdir(parents=True, exist_ok=True)
    with open(label_map_out, "w") as f:
        json.dump(idx2label, f, indent=2)
    print(f"✓ Label map saved: {label_map_out}")

    # Build HDF5
    dataset_path.parent.mkdir(parents=True, exist_ok=True)
    with h5py.File(dataset_path, "w") as hf:
        for split in ("train", "val", "test"):
            X, y = load_split(landmarks_dir, split, label2idx, frame_count)
            hf.create_dataset(f"X_{split}", data=X, compression="gzip")
            hf.create_dataset(f"y_{split}", data=y, compression="gzip")
            print(f"  {split}: {len(X)} samples")

    print(f"\n✓ Dataset saved: {dataset_path}")


if __name__ == "__main__":
    main()
