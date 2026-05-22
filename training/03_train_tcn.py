"""
SignSpeak v2 — Step 3: Train TCN
=================================
Trains a Temporal Convolutional Network (TCN) on the HDF5 dataset
produced by 02_build_dataset.py.

Architecture: stacked dilated causal Conv1D blocks with residual connections.

Outputs:
  models/tcn_v2/          — Keras SavedModel
  models/tcn_v2/best.keras  — best checkpoint (val_accuracy)
  models/tcn_v2/history.json

Run:
  python 03_train_tcn.py
"""

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


# ─── Model definition ────────────────────────────────────────────────────────

def residual_tcn_block(x, filters, kernel_size, dilation_rate, dropout):
    """One dilated causal conv residual block."""
    skip = x
    x = layers.Conv1D(
        filters, kernel_size,
        dilation_rate=dilation_rate,
        padding="causal",
        activation="relu",
        kernel_initializer="he_normal",
    )(x)
    x = layers.BatchNormalization()(x)
    x = layers.Dropout(dropout)(x)
    x = layers.Conv1D(
        filters, kernel_size,
        dilation_rate=dilation_rate,
        padding="causal",
        activation="relu",
        kernel_initializer="he_normal",
    )(x)
    x = layers.BatchNormalization()(x)
    x = layers.Dropout(dropout)(x)

    # Match channels if needed
    if skip.shape[-1] != filters:
        skip = layers.Conv1D(filters, 1, padding="same")(skip)

    return layers.Add()([x, skip])


def build_tcn(frame_count, feature_size, num_classes, filters_list, kernel_size, dropout):
    inp = keras.Input(shape=(frame_count, feature_size), name="landmarks")
    x = inp

    dilation = 1
    for filters in filters_list:
        x = residual_tcn_block(x, filters, kernel_size, dilation, dropout)
        dilation *= 2  # exponential dilation

    x = layers.GlobalAveragePooling1D()(x)
    x = layers.Dense(128, activation="relu")(x)
    x = layers.Dropout(dropout)(x)
    out = layers.Dense(num_classes, activation="softmax", name="predictions")(x)

    return keras.Model(inp, out, name="SignSpeak_TCN_v2")


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

    # ── Resolve dataset & label-map paths ─────────────────────────────────────
    if use_hf:
        dataset_path   = Path(hf_cfg["dataset_path"])
        label_map_path = Path(hf_cfg["label_map_out"])
        print("=" * 60)
        print("Dataset mode  : HF-ASL")
        print(f"Dataset path  : {dataset_path}")
        print(f"Label map     : {label_map_path}")
        print("=" * 60)
    else:
        dataset_path   = Path(cfg["data"]["dataset_path"])
        label_map_path = None          # MS-ASL uses config.model.num_classes directly
        print("Dataset mode  : MS-ASL")
        print(f"Dataset path  : {dataset_path}")

    # ── Load data ─────────────────────────────────────────────────────────────
    if not dataset_path.exists():
        print(f"\nERROR: Dataset not found: {dataset_path}")
        if use_hf:
            print("Run 02_build_dataset.py first (hf_dataset.enabled=true).")
        else:
            print("Run 02_build_dataset.py first.")
        sys.exit(1)

    with h5py.File(dataset_path, "r") as hf:
        X_train = hf["X_train"][:]
        y_train = hf["y_train"][:]
        X_val   = hf["X_val"][:]
        y_val   = hf["y_val"][:]

    print(f"\nTrain: {X_train.shape},  Val: {X_val.shape}")

    # ── Guard: abort if splits are empty ─────────────────────────────────────
    if len(X_train) == 0:
        print(f"\nERROR: X_train is empty in: {dataset_path}")
        print("Re-run 02_build_dataset.py to rebuild the dataset.")
        sys.exit(1)
    if len(X_val) == 0:
        print(f"\nERROR: X_val is empty in: {dataset_path}")
        print("Re-run 02_build_dataset.py to rebuild the dataset.")
        sys.exit(1)

    # ── Resolve num_classes ───────────────────────────────────────────────────
    if use_hf and label_map_path and label_map_path.exists():
        with open(label_map_path, encoding="utf-8") as f:
            label_map = json.load(f)
        num_classes_from_map = len(label_map)
        cfg_num_classes      = cfg["model"].get("num_classes", num_classes_from_map)
        if cfg_num_classes != num_classes_from_map:
            print(
                f"\n[WARNING] config model.num_classes={cfg_num_classes} "
                f"does not match label_map length={num_classes_from_map}. "
                "Using label_map length."
            )
        num_classes = num_classes_from_map
        print(f"Classes       : {num_classes}  {list(label_map.values())}")
    else:
        num_classes = cfg["model"]["num_classes"]

    print()

    # ── Build model ───────────────────────────────────────────────────────────
    model = build_tcn(
        frame_count=frame_count,
        feature_size=feature_size,
        num_classes=num_classes,
        filters_list=cfg["model"]["tcn_filters"],
        kernel_size=cfg["model"]["tcn_kernel_size"],
        dropout=cfg["model"]["dropout"],
    )
    model.summary()

    model.compile(
        optimizer=keras.optimizers.Adam(t_cfg["learning_rate"]),
        loss="sparse_categorical_crossentropy",
        metrics=["accuracy"],
    )

    callbacks = [
        keras.callbacks.ModelCheckpoint(
            str(output_dir / "best.keras"),
            save_best_only=True,
            monitor="val_accuracy",
            verbose=1,
        ),
        keras.callbacks.ReduceLROnPlateau(
            monitor="val_loss",
            patience=t_cfg["lr_patience"],
            factor=0.5,
            verbose=1,
        ),
        keras.callbacks.EarlyStopping(
            monitor="val_accuracy",
            patience=t_cfg["early_stop_patience"],
            restore_best_weights=True,
            verbose=1,
        ),
    ]

    history = model.fit(
        X_train, y_train,
        validation_data=(X_val, y_val),
        epochs=t_cfg["epochs"],
        batch_size=t_cfg["batch_size"],
        callbacks=callbacks,
    )

    # Save full model and history
    model.save(str(output_dir))
    with open(output_dir / "history.json", "w") as f:
        json.dump(
            {k: [float(v) for v in vals] for k, vals in history.history.items()},
            f, indent=2,
        )

    print(f"\n✓ Model saved: {output_dir}")


if __name__ == "__main__":
    _cfg = load_config()
    tf.random.set_seed(_cfg["training"]["seed"])
    np.random.seed(_cfg["training"]["seed"])
    main()

