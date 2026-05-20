"""
SignSpeak v2 — Step 2: Build Dataset
=====================================
Reads extracted .npy landmark files, applies:
  - Uniform temporal sampling → exactly `frame_count` frames per clip
  - Wrist-relative, scale-invariant normalisation (mirrors JS landmarkNormalizer)
  - Integer label encoding

Writes a single HDF5 dataset and label_map.json for use in training.

Output:
  data/dataset.h5       — keys: X_train, y_train, X_val, y_val, X_test, y_test
  data/label_map.json   — { "0": "HELLO", "1": "THANK_YOU", … }

Run:
  python 02_build_dataset.py
"""
# NOTE: normalize_sequence and uniform_sample live in utils/ so changes
# stay consistent with the JS counterpart (landmarkNormalizer.js).

import json
from pathlib import Path

import h5py
import numpy as np
import yaml
from tqdm import tqdm

from utils.normalizer import normalize_sequence
from utils.frame_sampler import uniform_sample
from utils.label_map import build_label_map, save_label_map


def load_config(path="config.yaml"):
    with open(path) as f:
        return yaml.safe_load(f)


def load_split(landmarks_dir: Path, split: str, label2idx: dict, frame_count: int):
    split_dir = landmarks_dir / split
    if not split_dir.exists():
        return np.empty((0, frame_count, 63), dtype=np.float32), np.empty(0, dtype=np.int32)

    X, y = [], []
    for label_dir in sorted(split_dir.iterdir()):
        label_name = label_dir.name
        if label_name not in label2idx:
            continue
        idx = label2idx[label_name]
        for npy_file in tqdm(sorted(label_dir.glob("*.npy")), desc=f"{split}/{label_name}", leave=False):
            raw = np.load(npy_file)          # (T, 21, 3)
            sampled = uniform_sample(raw, frame_count)
            normed = normalize_sequence(sampled)   # from utils.normalizer
            if normed is None:
                continue
            X.append(normed)
            y.append(idx)

    if not X:
        return np.empty((0, frame_count, 63), dtype=np.float32), np.empty(0, dtype=np.int32)
    return np.stack(X), np.array(y, dtype=np.int32)


def main():
    cfg = load_config()
    landmarks_dir = Path(cfg["data"]["landmarks_dir"])
    dataset_path = Path(cfg["data"]["dataset_path"])
    label_map_out = Path(cfg["data"]["label_map_out"])
    frame_count = cfg["preprocessing"]["frame_count"]
    num_classes = cfg["model"]["num_classes"]

    # Build label map from train split (sorted for determinism)
    label2idx, idx2label = build_label_map(landmarks_dir, num_classes)
    save_label_map(idx2label, label_map_out)

    # Build splits
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
