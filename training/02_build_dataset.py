"""
SignSpeak v2 — Step 2: Build Dataset
=====================================
Reads extracted .npy landmark files and their .label sidecars,
applies uniform temporal resampling, normalisation, and a stratified
train/val/test split.

Outputs:
  dataset.h5         — X_train, y_train, X_val, y_val, X_test, y_test
  label_map.json     — { "0": "HELLO", "1": "YES", … }

Normalisation note:
  normalize_sequence_safe() MUST stay identical to landmarkNormalizer.js.
  Both use: wrist-relative → max-abs scale → 1e-6 guard.

Run:
  cd C:\\Web-Dev\\Project\\signspeak
  .\\training\\.venv\\Scripts\\python.exe training\\02_build_dataset.py
"""

import json
import sys
sys.stdout.reconfigure(encoding="utf-8")
from pathlib import Path

import h5py
import numpy as np
import yaml
from tqdm import tqdm

from utils.normalizer import TWO_HAND_FEATURE_SIZE, normalize_sequence_safe
from utils.frame_sampler import uniform_sample


def load_config(path: str = "config.yaml") -> dict:
    resolved = Path(__file__).parent / path
    with open(resolved) as f:
        return yaml.safe_load(f)


def stratified_split(
    X: np.ndarray,
    y: np.ndarray,
    val_frac: float,
    test_frac: float,
    seed: int,
) -> tuple:
    """
    Split (X, y) into train/val/test preserving class distribution.
    Every class appears in every split if it has >= 3 samples.
    """
    rng     = np.random.default_rng(seed)
    classes = np.unique(y)

    train_idx, val_idx, test_idx = [], [], []

    for cls in classes:
        idx = np.where(y == cls)[0]
        rng.shuffle(idx)
        n       = len(idx)
        n_test  = max(1, int(np.floor(n * test_frac)))
        n_val   = max(1, int(np.floor(n * val_frac)))
        n_train = n - n_val - n_test

        if n_train < 1:
            # Not enough samples — put at least 1 in train
            n_train = 1
            n_val   = max(0, n - n_train - n_test)
            n_test  = n - n_train - n_val

        test_idx  .extend(idx[:n_test])
        val_idx   .extend(idx[n_test:n_test + n_val])
        train_idx .extend(idx[n_test + n_val:])

    train_idx = np.array(train_idx)
    val_idx   = np.array(val_idx)
    test_idx  = np.array(test_idx)

    rng.shuffle(train_idx)
    rng.shuffle(val_idx)
    rng.shuffle(test_idx)

    return (
        X[train_idx], y[train_idx],
        X[val_idx],   y[val_idx],
        X[test_idx],  y[test_idx],
    )


def _section_enabled(section: dict) -> bool:
    return bool(section and section.get("enabled", False))


def _horizontal_flip_sequence(sequence: np.ndarray, feature_size: int) -> np.ndarray:
    """Mirror x-coordinates for a normalized sequence."""
    if feature_size == TWO_HAND_FEATURE_SIZE:
        flipped = sequence.reshape(sequence.shape[0], 2, 21, 3).copy()
        flipped[:, :, :, 0] *= -1.0
        flipped = flipped[:, [1, 0], :, :]
        return flipped.reshape(sequence.shape).astype(np.float32, copy=False)

    flipped = sequence.reshape(sequence.shape[0], 21, 3).copy()
    flipped[:, :, 0] *= -1.0
    return flipped.reshape(sequence.shape).astype(np.float32, copy=False)


def _temporal_jitter_sequence(
    sequence: np.ndarray,
    rng: np.random.Generator,
    max_speed_ratio: float,
) -> np.ndarray:
    """Randomly drop/duplicate frames, then sample back to the original length."""
    frame_count = sequence.shape[0]
    max_speed_ratio = max(1.0, float(max_speed_ratio))
    ratio = rng.uniform(1.0 / max_speed_ratio, max_speed_ratio)
    jittered_len = max(2, int(round(frame_count * ratio)))
    jittered = uniform_sample(sequence, jittered_len)
    return uniform_sample(jittered, frame_count).astype(np.float32, copy=False)


def _landmark_jitter_sequence(
    sequence: np.ndarray,
    rng: np.random.Generator,
    sigma: float,
) -> np.ndarray:
    """Add small Gaussian noise to a normalized sequence."""
    noise = rng.normal(0.0, max(0.0, float(sigma)), size=sequence.shape)
    return (sequence + noise).astype(np.float32, copy=False)


def _append_if_valid(
    samples: list,
    labels: list,
    sequence: np.ndarray,
    label: int,
    feature_size: int,
) -> bool:
    if sequence.shape[-1] != feature_size or not np.all(np.isfinite(sequence)):
        return False
    samples.append(sequence.astype(np.float32, copy=False))
    labels.append(int(label))
    return True


def augment_training_set(
    X_train: np.ndarray,
    y_train: np.ndarray,
    aug_cfg: dict,
    seed: int,
) -> tuple[np.ndarray, np.ndarray, dict[str, int]]:
    """
    Apply configured augmentation to the training split only.

    This prevents augmented near-duplicates from leaking into validation/test
    splits and inflating evaluation metrics.
    """
    counts = {
        "landmark_jitter": 0,
        "temporal_jitter": 0,
        "horizontal_flip": 0,
    }

    if not _section_enabled(aug_cfg) or len(X_train) == 0:
        return X_train, y_train, counts

    rng = np.random.default_rng(seed)
    samples = [x.astype(np.float32, copy=False) for x in X_train]
    labels = [int(y) for y in y_train]

    lj_cfg = aug_cfg.get("landmark_jitter", {})
    tj_cfg = aug_cfg.get("temporal_jitter", {})
    hf_cfg = aug_cfg.get("horizontal_flip", {})

    for sequence, label in zip(X_train, y_train):
        if _section_enabled(hf_cfg):
            if _append_if_valid(samples, labels, _horizontal_flip_sequence(sequence, X_train.shape[-1]), label, X_train.shape[-1]):
                counts["horizontal_flip"] += 1

        if _section_enabled(tj_cfg):
            copies = max(0, int(tj_cfg.get("copies", 1)))
            max_speed_ratio = float(tj_cfg.get("max_speed_ratio", 1.2))
            for _ in range(copies):
                augmented = _temporal_jitter_sequence(sequence, rng, max_speed_ratio)
                if _append_if_valid(samples, labels, augmented, label, X_train.shape[-1]):
                    counts["temporal_jitter"] += 1

        if _section_enabled(lj_cfg):
            copies = max(0, int(lj_cfg.get("copies", 1)))
            sigma = float(lj_cfg.get("sigma", 0.02))
            for _ in range(copies):
                augmented = _landmark_jitter_sequence(sequence, rng, sigma)
                if _append_if_valid(samples, labels, augmented, label, X_train.shape[-1]):
                    counts["landmark_jitter"] += 1

    return (
        np.stack(samples).astype(np.float32),
        np.array(labels, dtype=np.int32),
        counts,
    )


def main():
    cfg         = load_config()
    frame_count = cfg["preprocessing"]["frame_count"]
    feature_size = int(cfg["preprocessing"].get("feature_size", TWO_HAND_FEATURE_SIZE))
    hf          = cfg.get("hf_dataset", {})
    use_hf      = hf.get("enabled", False)
    t_cfg       = cfg.get("training", {})
    seed        = t_cfg.get("seed", 42)
    val_split   = float(t_cfg.get("val_split",  0.10))
    test_split  = float(t_cfg.get("test_split", 0.10))
    aug_cfg     = cfg.get("augmentation", {})

    if use_hf:
        landmarks_dir = Path(hf["landmarks_dir"])
        dataset_path  = Path(hf["dataset_path"])
        label_map_out = Path(hf["label_map_out"])
        classes       = [c.strip() for c in hf.get("selected_classes", [])]
        if not classes:
            raise ValueError("hf_dataset.selected_classes is empty.")

        print("=" * 60)
        print("Dataset mode     : HF-ASL  (stratified split)")
        print(f"Landmarks dir    : {landmarks_dir}")
        print(f"Dataset output   : {dataset_path}")
        print(f"Expected shape   : [{frame_count}, {feature_size}]")
        print(f"Val split        : {val_split}  |  Test split: {test_split}")
        print(f"Seed             : {seed}")
        print("=" * 60)

        label2idx = {cls: i for i, cls in enumerate(classes)}
        idx2label = {str(i): cls for cls, i in label2idx.items()}
        print(f"\nLabel map: {label2idx}\n")

        # Load all samples
        X_all, y_all     = [], []
        per_ok: dict[str, int]   = {}
        per_skip: dict[str, int] = {}

        for label_id, cls in enumerate(classes):
            cls_dir = landmarks_dir / cls
            per_ok[cls]   = 0
            per_skip[cls] = 0

            if not cls_dir.exists():
                print(f"  [WARNING] Missing dir: {cls_dir}")
                continue

            npy_files = sorted(cls_dir.glob("*.npy"))
            if not npy_files:
                print(f"  [WARNING] No .npy files in: {cls_dir}")
                continue

            for npy_file in tqdm(npy_files, desc=f"  {cls}", leave=False):
                try:
                    raw = np.load(npy_file)
                except Exception as e:
                    print(f"    [SKIP] Unreadable: {npy_file.name} ({e})")
                    per_skip[cls] += 1
                    continue

                if raw.ndim != 2 or raw.shape[1] != feature_size:
                    print(f"    [SKIP] Bad shape {raw.shape}: {npy_file.name}")
                    per_skip[cls] += 1
                    continue

                sampled = uniform_sample(raw, frame_count)
                normed  = normalize_sequence_safe(sampled, feature_size=feature_size)
                if normed is None:
                    per_skip[cls] += 1
                    continue
                if normed.shape != (frame_count, feature_size):
                    print(f"    [SKIP] Bad sampled shape {normed.shape}: {npy_file.name}")
                    per_skip[cls] += 1
                    continue
                if not np.all(np.isfinite(normed)):
                    per_skip[cls] += 1
                    continue

                X_all.append(normed)
                y_all.append(label_id)
                per_ok[cls] += 1

        print("\nPer-class load summary:")
        print(f"  {'Class':<22} {'Loaded':>7}  {'Skipped':>8}")
        print(f"  {'-'*22} {'-'*7}  {'-'*8}")
        for cls in classes:
            ok   = per_ok.get(cls, 0)
            sk   = per_skip.get(cls, 0)
            flag = "  ⚠ LOW" if ok < 10 else ""
            print(f"  {cls:<22} {ok:>7}  {sk:>8}{flag}")

        N = len(X_all)
        print(f"\nTotal usable samples: {N}")
        if N == 0:
            print("ERROR: No usable samples. Check landmarks dir.")
            sys.exit(1)

        X_all = np.stack(X_all).astype(np.float32)
        if X_all.shape[1:] != (frame_count, feature_size):
            print(f"ERROR: Dataset shape mismatch: got {X_all.shape[1:]}, expected {(frame_count, feature_size)}")
            sys.exit(1)
        y_all = np.array(y_all, dtype=np.int32)

        # Stratified split
        X_train, y_train, X_val, y_val, X_test, y_test = stratified_split(
            X_all, y_all, val_split, test_split, seed
        )
        X_train, y_train, augmentation_counts = augment_training_set(
            X_train, y_train, aug_cfg, seed
        )
        total_augmented = sum(augmentation_counts.values())

        print(f"\nSplit sizes (stratified):")
        print(f"  train : {len(X_train)}")
        print(f"  val   : {len(X_val)}")
        print(f"  test  : {len(X_test)}")
        if _section_enabled(aug_cfg):
            print("\nTraining augmentation:")
            for name, count in augmentation_counts.items():
                print(f"  {name:<18}: {count}")
            print(f"  total added       : {total_augmented}")

        # Per-class distribution check
        print("\nPer-class counts in each split:")
        print(f"  {'Class':<22} {'train':>6}  {'val':>6}  {'test':>6}")
        print(f"  {'-'*22} {'-'*6}  {'-'*6}  {'-'*6}")
        for cls_id, cls in enumerate(classes):
            tr = int((y_train == cls_id).sum())
            vl = int((y_val   == cls_id).sum())
            te = int((y_test  == cls_id).sum())
            missing = " ⚠ missing in val!" if vl == 0 else (" ⚠ missing in test!" if te == 0 else "")
            print(f"  {cls:<22} {tr:>6}  {vl:>6}  {te:>6}{missing}")

        label_map_out.parent.mkdir(parents=True, exist_ok=True)
        with open(label_map_out, "w", encoding="utf-8") as f:
            json.dump(idx2label, f, indent=2)
        print(f"\n✓ Label map saved: {label_map_out}")

        dataset_path.parent.mkdir(parents=True, exist_ok=True)
        with h5py.File(dataset_path, "w") as hdf:
            hdf.create_dataset("X_train", data=X_train, compression="gzip")
            hdf.create_dataset("y_train", data=y_train, compression="gzip")
            hdf.create_dataset("X_val",   data=X_val,   compression="gzip")
            hdf.create_dataset("y_val",   data=y_val,   compression="gzip")
            hdf.create_dataset("X_test",  data=X_test,  compression="gzip")
            hdf.create_dataset("y_test",  data=y_test,  compression="gzip")
        print(f"✓ Dataset saved  : {dataset_path}")

    else:
        # MS-ASL mode (unchanged)
        landmarks_dir = Path(cfg["data"]["landmarks_dir"])
        dataset_path  = Path(cfg["data"]["dataset_path"])
        label_map_out = Path(cfg["data"]["label_map_out"])
        classes       = cfg.get("classes", [])
        label2idx     = {cls.lower().strip(): i for i, cls in enumerate(classes)}
        idx2label     = {str(i): cls for cls, i in label2idx.items()}

        label_map_out.parent.mkdir(parents=True, exist_ok=True)
        with open(label_map_out, "w") as f:
            json.dump(idx2label, f, indent=2)
        print(f"✓ Label map saved: {label_map_out}")

        dataset_path.parent.mkdir(parents=True, exist_ok=True)
        with h5py.File(dataset_path, "w") as hdf:
            for split in ("train", "val", "test"):
                split_dir = landmarks_dir / split
                X, y = [], []
                if split_dir.exists():
                    for label_dir in sorted(split_dir.iterdir()):
                        lname = label_dir.name.lower().strip()
                        if lname not in label2idx:
                            continue
                        for npy_file in tqdm(sorted(label_dir.glob("*.npy")), desc=f"{split}/{lname}", leave=False):
                            sidecar = npy_file.with_suffix(".label")
                            cid = int(sidecar.read_text().strip()) if sidecar.exists() else label2idx[lname]
                            raw = np.load(npy_file)
                            if raw.ndim != 2 or raw.shape[1] != feature_size:
                                print(f"    [SKIP] Bad shape {raw.shape}: {npy_file.name}")
                                continue
                            sampled = uniform_sample(raw, frame_count)
                            normed  = normalize_sequence_safe(sampled, feature_size=feature_size)
                            if normed is None:
                                continue
                            X.append(normed)
                            y.append(cid)
                Xa = np.stack(X).astype(np.float32) if X else np.empty((0, frame_count, feature_size), dtype=np.float32)
                ya = np.array(y, dtype=np.int32)    if y else np.empty(0, dtype=np.int32)
                hdf.create_dataset(f"X_{split}", data=Xa, compression="gzip")
                hdf.create_dataset(f"y_{split}", data=ya, compression="gzip")
                print(f"  {split}: {len(Xa)} samples")

        print(f"\n✓ Dataset saved: {dataset_path}")


if __name__ == "__main__":
    main()
