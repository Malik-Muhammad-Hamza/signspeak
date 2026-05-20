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

import json
from pathlib import Path

import h5py
import numpy as np
import yaml
from tqdm import tqdm


def load_config(path="config.yaml"):
    with open(path) as f:
        return yaml.safe_load(f)


def uniform_sample(frames: np.ndarray, target: int) -> np.ndarray:
    """Sample or interpolate `frames` to exactly `target` frames."""
    T = len(frames)
    if T == target:
        return frames
    indices = np.linspace(0, T - 1, target).astype(int)
    return frames[indices]


def normalize(frames: np.ndarray) -> np.ndarray | None:
    """
    Wrist-relative, scale-invariant normalisation.
    Input:  (32, 21, 3)
    Output: (32, 63)  float32
    """
    wrist = frames[:, 0:1, :]          # (32, 1, 3)
    shifted = frames - wrist            # translate to wrist origin
    flat = shifted.reshape(len(frames), -1)  # (32, 63)

    max_abs = np.abs(flat).max(axis=1, keepdims=True)  # (32, 1)
    max_abs = np.where(max_abs == 0, 1.0, max_abs)     # avoid /0
    return (flat / max_abs).astype(np.float32)


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
            normed = normalize(sampled)
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
    train_dir = landmarks_dir / "train"
    label_names = sorted([d.name for d in train_dir.iterdir() if d.is_dir()])[:num_classes]
    label2idx = {name: i for i, name in enumerate(label_names)}
    idx2label = {str(i): name for name, i in label2idx.items()}

    # Save label map
    label_map_out.parent.mkdir(parents=True, exist_ok=True)
    with open(label_map_out, "w") as f:
        json.dump(idx2label, f, indent=2)
    print(f"✓ Label map saved: {label_map_out}  ({len(idx2label)} classes)")

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
