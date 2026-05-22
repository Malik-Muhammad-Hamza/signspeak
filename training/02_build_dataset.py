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


def hf_load_all(
    landmarks_dir: Path,
    classes: list[str],
    frame_count: int,
) -> tuple[np.ndarray, np.ndarray, dict[str, int], dict[str, int]]:
    """
    Load all .npy files from a flat HF landmark directory structure:
      landmarks_dir/CLASS_NAME/*.npy

    Returns
    -------
    X            : (N, frame_count, 63) float32
    y            : (N,) int32
    per_class_ok : {class_name: count}
    per_class_skip: {class_name: count}
    """
    X_all, y_all = [], []
    per_ok: dict[str, int] = {}
    per_skip: dict[str, int] = {}

    for label_id, cls in enumerate(classes):
        cls_dir = landmarks_dir / cls
        per_ok[cls]   = 0
        per_skip[cls] = 0

        if not cls_dir.exists():
            print(f"  [WARNING] Class directory not found: {cls_dir}")
            continue

        npy_files = sorted(cls_dir.glob("*.npy"))
        if not npy_files:
            print(f"  [WARNING] No .npy files in: {cls_dir}")
            continue

        # Minimum fraction of frames that must have real hand detections
        min_valid_ratio = 0.3

        for npy_file in tqdm(npy_files, desc=f"  {cls}", leave=False):
            try:
                raw = np.load(npy_file)           # expected: (T, 21, 3)
            except Exception as e:
                print(f"    [SKIP] Unreadable: {npy_file.name}  ({e})")
                per_skip[cls] += 1
                continue

            # Validate shape before sampling
            if raw.ndim != 3 or raw.shape[1:] != (21, 3):
                print(f"    [SKIP] Bad shape {raw.shape}: {npy_file.name}")
                per_skip[cls] += 1
                continue

            # Filter out zero-landmark frames (frames where no hand was detected)
            # A zero frame has max absolute value == 0 across all 63 values
            frame_sums = np.abs(raw).reshape(len(raw), -1).max(axis=1)  # (T,)
            valid_mask = frame_sums > 0
            valid_frames = raw[valid_mask]

            frac_valid = valid_mask.mean()
            if frac_valid < min_valid_ratio or len(valid_frames) == 0:
                per_skip[cls] += 1
                continue

            sampled = uniform_sample(valid_frames, frame_count)  # (frame_count, 21, 3)

            # Normalise frame-by-frame; skip any frame that is still degenerate
            normed_frames = []
            for frame in sampled:
                n = None
                wrist = frame[0]
                shifted = frame - wrist
                flat = shifted.flatten().astype(np.float32)
                max_abs = np.abs(flat).max()
                if max_abs > 0:
                    n = flat / max_abs
                if n is None:
                    n = np.zeros(63, dtype=np.float32)   # keep shape; rare edge case
                normed_frames.append(n)

            normed = np.stack(normed_frames)   # (frame_count, 63)

            if normed.shape != (frame_count, 63):
                print(f"    [SKIP] Unexpected normalised shape {normed.shape}: {npy_file.name}")
                per_skip[cls] += 1
                continue

            X_all.append(normed)
            y_all.append(label_id)
            per_ok[cls] += 1

    if not X_all:
        return (
            np.empty((0, frame_count, 63), dtype=np.float32),
            np.empty(0, dtype=np.int32),
            per_ok, per_skip,
        )
    return np.stack(X_all).astype(np.float32), np.array(y_all, dtype=np.int32), per_ok, per_skip


def main():
    cfg        = load_config()
    frame_count = cfg["preprocessing"]["frame_count"]
    hf          = cfg.get("hf_dataset", {})
    use_hf      = hf.get("enabled", False)

    if use_hf:
        # ── HF-ASL mode ───────────────────────────────────────────────────────
        landmarks_dir = Path(hf["landmarks_dir"])
        dataset_path  = Path(hf["dataset_path"])
        label_map_out = Path(hf["label_map_out"])
        classes       = [c.strip() for c in hf.get("selected_classes", [])]
        val_split     = float(cfg.get("training", {}).get("val_split", 0.1))
        test_split    = float(cfg.get("training", {}).get("test_split", 0.1))

        if not classes:
            raise ValueError("hf_dataset.selected_classes is empty in config.yaml.")

        print("=" * 60)
        print("Dataset mode     : HF-ASL")
        print(f"Landmarks dir    : {landmarks_dir}")
        print(f"Dataset output   : {dataset_path}")
        print(f"Label map output : {label_map_out}")
        print(f"Classes          : {classes}")
        print(f"Val split        : {val_split}  |  Test split: {test_split}")
        print("=" * 60)
        print()

        # Build label map preserving config order, original case
        label2idx = {cls: i for i, cls in enumerate(classes)}
        idx2label = {str(i): cls for cls, i in label2idx.items()}
        print(f"Label map ({len(label2idx)} classes): {label2idx}")

        # Load all samples
        print("\nLoading landmark files …")
        X_all, y_all, per_ok, per_skip = hf_load_all(landmarks_dir, classes, frame_count)
        N = len(X_all)

        print(f"\nSamples per class:")
        for cls in classes:
            print(f"  {cls:<20} loaded={per_ok[cls]}  skipped={per_skip[cls]}")
        print(f"\nTotal usable samples: {N}")

        if N == 0:
            print("ERROR: No usable samples found. Check landmarks directory.")
            sys.exit(1)

        # Shuffle reproducibly
        rng = np.random.default_rng(cfg.get("training", {}).get("seed", 42))
        idx = rng.permutation(N)
        X_all = X_all[idx]
        y_all = y_all[idx]

        # Train / val / test split
        n_test = max(1, int(N * test_split))
        n_val  = max(1, int(N * val_split))
        n_train = N - n_val - n_test

        X_test,  y_test  = X_all[:n_test],          y_all[:n_test]
        X_val,   y_val   = X_all[n_test:n_test+n_val], y_all[n_test:n_test+n_val]
        X_train, y_train = X_all[n_test+n_val:],    y_all[n_test+n_val:]

        print(f"\nSplit sizes:")
        print(f"  train : {len(X_train)} samples")
        print(f"  val   : {len(X_val)} samples")
        print(f"  test  : {len(X_test)} samples")

        # Save label map
        label_map_out.parent.mkdir(parents=True, exist_ok=True)
        with open(label_map_out, "w", encoding="utf-8") as f:
            json.dump(idx2label, f, indent=2)
        print(f"\n✓ Label map saved: {label_map_out}")

        # Save HDF5
        dataset_path.parent.mkdir(parents=True, exist_ok=True)
        with h5py.File(dataset_path, "w") as hf_file:
            hf_file.create_dataset("X_train", data=X_train, compression="gzip")
            hf_file.create_dataset("y_train", data=y_train, compression="gzip")
            hf_file.create_dataset("X_val",   data=X_val,   compression="gzip")
            hf_file.create_dataset("y_val",   data=y_val,   compression="gzip")
            hf_file.create_dataset("X_test",  data=X_test,  compression="gzip")
            hf_file.create_dataset("y_test",  data=y_test,  compression="gzip")

        print(f"✓ Dataset saved  : {dataset_path}")
        print()
        print(f"  X_train: {X_train.shape}  y_train: {y_train.shape}")
        print(f"  X_val  : {X_val.shape}    y_val  : {y_val.shape}")
        print(f"  X_test : {X_test.shape}   y_test : {y_test.shape}")

    else:
        # ── MS-ASL mode (original behaviour, unchanged) ───────────────────────
        landmarks_dir = Path(cfg["data"]["landmarks_dir"])
        dataset_path  = Path(cfg["data"]["dataset_path"])
        label_map_out = Path(cfg["data"]["label_map_out"])
        classes       = cfg.get("classes", [])

        if not classes:
            raise ValueError("No 'classes' list found in config.yaml.")

        label2idx, idx2label = build_compact_label_map(classes)
        print(f"Label map ({len(label2idx)} classes): {label2idx}")

        label_map_out.parent.mkdir(parents=True, exist_ok=True)
        with open(label_map_out, "w") as f:
            json.dump(idx2label, f, indent=2)
        print(f"✓ Label map saved: {label_map_out}")

        dataset_path.parent.mkdir(parents=True, exist_ok=True)
        with h5py.File(dataset_path, "w") as hf_file:
            for split in ("train", "val", "test"):
                X, y = load_split(landmarks_dir, split, label2idx, frame_count)
                hf_file.create_dataset(f"X_{split}", data=X, compression="gzip")
                hf_file.create_dataset(f"y_{split}", data=y, compression="gzip")
                print(f"  {split}: {len(X)} samples")

        print(f"\n✓ Dataset saved: {dataset_path}")


if __name__ == "__main__":
    main()

