"""
SignSpeak v2 — Step 3: Train TCN
=================================
Trains a Temporal Convolutional Network (TCN) on the HDF5 dataset
produced by 02_build_dataset.py.

Architecture: stacked dilated Conv1D blocks with residual connections.
  - padding="same" (matches TF.js export; causal ordering not needed for a
    fixed-length sliding window evaluated in full at inference time)
  - BatchNormalization after each Conv1D layer
  - SpatialDropout1D for sequence-aware regularisation
  - GlobalAveragePooling1D before dense head
  - Kept compact enough for browser inference

Outputs:
  models/tcn_v2/best.keras            — best val_accuracy checkpoint
  models/tcn_v2/final.keras           — model state at end of training
  models/tcn_v2/training_history.csv  — epoch-by-epoch metrics
  models/tcn_v2/training_summary.json — training metadata & best results
  models/tcn_v2/history.json          — raw history dict (legacy compatibility)

Run:
  cd C:\\Web-Dev\\Project\\signspeak
  .\\training\\.venv\\Scripts\\python.exe training\\03_train_tcn.py
"""

import csv
import json
import sys
sys.stdout.reconfigure(encoding="utf-8")
from pathlib import Path

import h5py
import numpy as np
import yaml
import tensorflow as tf
from tensorflow import keras
from tensorflow.keras import layers


def load_config(path="config.yaml"):
    resolved = Path(__file__).parent / path
    with open(resolved) as f:
        return yaml.safe_load(f)


# ─── Top-K metric ────────────────────────────────────────────────────────────

def top_k_accuracy_metric(k: int):
    """Return a named top-k accuracy Keras metric."""
    return tf.keras.metrics.SparseTopKCategoricalAccuracy(k=k, name=f"top_{k}_accuracy")


# ─── Model definition ────────────────────────────────────────────────────────

def residual_tcn_block(x, filters, kernel_size, dilation_rate, dropout):
    """One same-padded dilated conv residual block with SpatialDropout1D."""
    skip = x
    x = layers.Conv1D(
        filters, kernel_size,
        dilation_rate=dilation_rate,
        padding="same",
        activation="relu",
        kernel_initializer="he_normal",
    )(x)
    x = layers.BatchNormalization()(x)
    x = layers.SpatialDropout1D(dropout)(x)
    x = layers.Conv1D(
        filters, kernel_size,
        dilation_rate=dilation_rate,
        padding="same",
        activation="relu",
        kernel_initializer="he_normal",
    )(x)
    x = layers.BatchNormalization()(x)
    x = layers.SpatialDropout1D(dropout)(x)

    if skip.shape[-1] != filters:
        skip = layers.Conv1D(filters, 1, padding="same")(skip)

    return layers.Add()([x, skip])


def build_tcn(frame_count, feature_size, num_classes, filters_list, kernel_size, dropout):
    inp = keras.Input(shape=(frame_count, feature_size), name="landmarks")
    x = inp

    dilation = 1
    for filters in filters_list:
        x = residual_tcn_block(x, filters, kernel_size, dilation, dropout)
        dilation *= 2  # exponential dilation: 1, 2, 4, …

    x = layers.GlobalAveragePooling1D()(x)
    x = layers.Dense(128, activation="relu")(x)
    x = layers.Dropout(dropout)(x)
    out = layers.Dense(num_classes, activation="softmax", name="predictions")(x)

    return keras.Model(inp, out, name="SignSpeak_TCN_v2")


# ─── Class weights ────────────────────────────────────────────────────────────

def compute_class_weights(y_train: np.ndarray, num_classes: int) -> dict[int, float]:
    """
    Compute balanced class weights to compensate for dataset imbalance.
    Uses sklearn-style formula: weight = N / (num_classes * class_count)
    """
    N = len(y_train)
    weights = {}
    for cls_id in range(num_classes):
        count = int((y_train == cls_id).sum())
        if count == 0:
            weights[cls_id] = 1.0
        else:
            weights[cls_id] = N / (num_classes * count)
    return weights


def apply_class_weight_overrides(
    base_weights: dict[int, float],
    label_map: dict[str, str],
    overrides: dict | None,
) -> tuple[dict[int, float], dict[str, dict[str, float | int]], list[str]]:
    """Apply optional config multipliers by class label."""
    final_weights = dict(base_weights)
    applied: dict[str, dict[str, float | int]] = {}
    warnings: list[str] = []

    if not overrides:
        return final_weights, applied, warnings

    label_to_id = {
        str(label).strip().upper(): int(cls_id)
        for cls_id, label in label_map.items()
    }

    for raw_label, raw_multiplier in overrides.items():
        label = str(raw_label).strip().upper()
        if label not in label_to_id:
            warnings.append(f"Ignoring class_weight_overrides.{raw_label}: unknown class label")
            continue

        try:
            multiplier = float(raw_multiplier)
        except (TypeError, ValueError):
            warnings.append(f"Ignoring class_weight_overrides.{raw_label}: multiplier is not numeric")
            continue

        if multiplier <= 0:
            warnings.append(f"Ignoring class_weight_overrides.{raw_label}: multiplier must be > 0")
            continue

        cls_id = label_to_id[label]
        final_weights[cls_id] = base_weights[cls_id] * multiplier
        applied[label] = {
            "class_id": cls_id,
            "multiplier": multiplier,
            "base_weight": base_weights[cls_id],
            "final_weight": final_weights[cls_id],
        }

    return final_weights, applied, warnings


# ─── Main ────────────────────────────────────────────────────────────────────

def main():
    cfg    = load_config()
    hf_cfg = cfg.get("hf_dataset", {})
    use_hf = hf_cfg.get("enabled", False)

    t_cfg        = cfg["training"]
    output_dir   = Path(t_cfg["output_dir"])
    frame_count  = cfg["preprocessing"]["frame_count"]
    feature_size = cfg["preprocessing"]["feature_size"]
    output_dir.mkdir(parents=True, exist_ok=True)

    if use_hf:
        dataset_path   = Path(hf_cfg["dataset_path"])
        label_map_path = Path(hf_cfg["label_map_out"])
        print("=" * 60)
        print("Dataset mode  : HF-ASL")
        print(f"Dataset       : {dataset_path}")
        print("=" * 60)
    else:
        dataset_path   = Path(cfg["data"]["dataset_path"])
        label_map_path = None

    if not dataset_path.exists():
        print(f"\nERROR: Dataset not found: {dataset_path}")
        print("Run 02_build_dataset.py first.")
        sys.exit(1)

    with h5py.File(dataset_path, "r") as hf:
        X_train = hf["X_train"][:]
        y_train = hf["y_train"][:]
        X_val   = hf["X_val"][:]
        y_val   = hf["y_val"][:]

    print(f"\nTrain: {X_train.shape},  Val: {X_val.shape}")
    expected_shape = (frame_count, feature_size)

    if len(X_train) == 0:
        print("ERROR: X_train is empty. Re-run 02_build_dataset.py.")
        sys.exit(1)
    if len(X_val) == 0:
        print("ERROR: X_val is empty. Re-run 02_build_dataset.py.")
        sys.exit(1)
    if X_train.shape[1:] != expected_shape or X_val.shape[1:] != expected_shape:
        print(f"ERROR: Dataset feature shape mismatch. Expected {expected_shape}.")
        print(f"  X_train: {X_train.shape}")
        print(f"  X_val  : {X_val.shape}")
        print("Re-run 01_extract_landmarks.py and 02_build_dataset.py for the two-hand format.")
        sys.exit(1)

    # Num classes
    if use_hf and label_map_path and label_map_path.exists():
        with open(label_map_path, encoding="utf-8") as f:
            label_map = json.load(f)
        num_classes = len(label_map)
        print(f"Classes ({num_classes}): {list(label_map.values())}")
    else:
        num_classes = cfg["model"]["num_classes"]
        label_map = {str(cls_id): str(cls_id) for cls_id in range(num_classes)}

    # Class distribution
    print("\nClass distribution in train:")
    counts_str = ""
    for cls_id in range(num_classes):
        cnt = int((y_train == cls_id).sum())
        bar = "█" * max(1, cnt // 3)
        lbl = label_map.get(str(cls_id), str(cls_id))
        counts_str += f"  {lbl:<12} {cnt:>4}  {bar}\n"
    print(counts_str)

    # Class weights
    base_class_weights = compute_class_weights(y_train, num_classes)
    class_weight_overrides = t_cfg.get("class_weight_overrides", {}) or {}
    class_weights, applied_overrides, override_warnings = apply_class_weight_overrides(
        base_class_weights,
        label_map,
        class_weight_overrides,
    )
    print(f"Base class weights: { {k: round(v, 3) for k, v in base_class_weights.items()} }")
    if class_weight_overrides:
        print(f"Class weight override multipliers: {class_weight_overrides}")
    for warning in override_warnings:
        print(f"WARNING: {warning}")
    print(f"Final class weights: { {k: round(v, 3) for k, v in class_weights.items()} }")
    print()

    # Build model
    model = build_tcn(
        frame_count=frame_count,
        feature_size=feature_size,
        num_classes=num_classes,
        filters_list=cfg["model"]["tcn_filters"],
        kernel_size=cfg["model"]["tcn_kernel_size"],
        dropout=cfg["model"]["dropout"],
    )
    model.summary()

    metrics = ["accuracy"]
    if num_classes >= 2:
        metrics.append(top_k_accuracy_metric(k=2))

    model.compile(
        optimizer=keras.optimizers.Adam(t_cfg["learning_rate"]),
        loss="sparse_categorical_crossentropy",
        metrics=metrics,
    )

    # ── Callbacks ─────────────────────────────────────────────────────────────
    csv_log_path = output_dir / "training_history.csv"

    callbacks = [
        keras.callbacks.ModelCheckpoint(
            str(output_dir / "best.keras"),
            save_best_only=True,
            monitor="val_accuracy",
            mode="max",
            verbose=1,
        ),
        keras.callbacks.ReduceLROnPlateau(
            monitor="val_loss",
            patience=t_cfg["lr_patience"],
            factor=0.5,
            min_lr=1e-6,
            verbose=1,
        ),
        keras.callbacks.EarlyStopping(
            monitor="val_accuracy",
            patience=t_cfg["early_stop_patience"],
            restore_best_weights=True,
            mode="max",
            verbose=1,
        ),
        keras.callbacks.CSVLogger(
            str(csv_log_path),
            append=False,
        ),
    ]

    # ── Training ──────────────────────────────────────────────────────────────
    history = model.fit(
        X_train, y_train,
        validation_data=(X_val, y_val),
        epochs=t_cfg["epochs"],
        batch_size=t_cfg["batch_size"],
        class_weight=class_weights,
        callbacks=callbacks,
        verbose=1,
    )

    # ── Save final model ───────────────────────────────────────────────────────
    final_path = output_dir / "final.keras"
    model.save(str(final_path))
    print(f"\n✓ Final model saved: {final_path}")

    # ── Save legacy history.json ──────────────────────────────────────────────
    with open(output_dir / "history.json", "w") as f:
        json.dump(
            {k: [float(v) for v in vals] for k, vals in history.history.items()},
            f, indent=2,
        )

    # ── Training summary JSON ──────────────────────────────────────────────────
    hist = history.history
    best_epoch     = int(np.argmax(hist.get("val_accuracy", [0])))
    best_val_acc   = float(np.max(hist.get("val_accuracy",  [0])))
    best_train_acc = float(hist.get("accuracy", [0])[best_epoch])
    top2_key       = "val_top_2_accuracy"
    best_val_top2  = float(hist[top2_key][best_epoch]) if top2_key in hist else None

    summary = {
        "dataset_mode":    "HF-ASL" if use_hf else "MS-ASL",
        "input_shape":      [frame_count, feature_size],
        "num_classes":     num_classes,
        "train_samples":   int(len(X_train)),
        "val_samples":     int(len(X_val)),
        "epochs_trained":  len(hist.get("accuracy", [])),
        "best_epoch":      best_epoch + 1,
        "best_val_accuracy":       round(best_val_acc,  4),
        "best_val_top2_accuracy":  round(best_val_top2, 4) if best_val_top2 else None,
        "best_train_accuracy":     round(best_train_acc, 4),
        "base_class_weights": {str(k): round(v, 4) for k, v in base_class_weights.items()},
        "class_weight_overrides": {
            str(k): float(v) for k, v in class_weight_overrides.items()
        },
        "class_weight_override_details": {
            label: {
                "class_id": int(details["class_id"]),
                "multiplier": round(float(details["multiplier"]), 4),
                "base_weight": round(float(details["base_weight"]), 4),
                "final_weight": round(float(details["final_weight"]), 4),
            }
            for label, details in applied_overrides.items()
        },
        "class_weights":   {str(k): round(v, 4) for k, v in class_weights.items()},
    }
    with open(output_dir / "training_summary.json", "w") as f:
        json.dump(summary, f, indent=2)

    print(f"\n✓ Training summary:")
    print(f"  Best epoch       : {summary['best_epoch']}")
    print(f"  Best val acc     : {summary['best_val_accuracy']:.4f}")
    if best_val_top2:
        print(f"  Best val top-2   : {summary['best_val_top2_accuracy']:.4f}")
    print(f"  CSV log          : {csv_log_path}")
    print(f"  Model            : {output_dir / 'best.keras'}")


if __name__ == "__main__":
    _cfg = load_config()
    tf.random.set_seed(_cfg["training"]["seed"])
    np.random.seed(_cfg["training"]["seed"])
    main()
