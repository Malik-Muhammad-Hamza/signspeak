"""
SignSpeak v2 — Step 4: Evaluate
================================
Loads the best checkpoint and evaluates it on the test split.
Outputs per-class accuracy, top-3 accuracy, and a confusion-matrix PNG.

Run:
  python 04_evaluate.py
"""

import json
import sys
sys.stdout.reconfigure(encoding="utf-8")
from pathlib import Path

import h5py
import matplotlib.pyplot as plt
import numpy as np
import seaborn as sns
import yaml
from sklearn.metrics import classification_report, confusion_matrix
import tensorflow as tf


def load_config(path="config.yaml"):
    resolved = Path(__file__).parent / path
    with open(resolved) as f:
        return yaml.safe_load(f)


def top_k_accuracy(y_true, y_pred_probs, k=3):
    top_k = np.argsort(y_pred_probs, axis=1)[:, -k:]
    hits = [y_true[i] in top_k[i] for i in range(len(y_true))]
    return np.mean(hits)


def main():
    cfg = load_config()
    dataset_path = Path(cfg["data"]["dataset_path"])
    model_dir = Path(cfg["training"]["output_dir"])
    label_map_path = Path(cfg["data"]["label_map_out"])
    reports_dir = Path("reports")
    reports_dir.mkdir(exist_ok=True)

    # Load label map
    with open(label_map_path) as f:
        idx2label = json.load(f)
    labels = [idx2label[str(i)] for i in range(len(idx2label))]

    # Load test data
    with h5py.File(dataset_path, "r") as hf:
        X_test = hf["X_test"][:]
        y_test = hf["y_test"][:]

    print(f"Test samples: {len(X_test)}")

    # Load model
    model = tf.keras.models.load_model(str(model_dir / "best.keras"))
    y_pred_probs = model.predict(X_test, verbose=1)
    y_pred = np.argmax(y_pred_probs, axis=1)

    # Metrics
    top1 = np.mean(y_pred == y_test)
    top3 = top_k_accuracy(y_test, y_pred_probs, k=3)
    print(f"\nTop-1 accuracy : {top1:.4f}")
    print(f"Top-3 accuracy : {top3:.4f}")
    print("\nPer-class report:")
    print(classification_report(y_test, y_pred, target_names=labels))

    # Confusion matrix
    cm = confusion_matrix(y_test, y_pred)
    fig, ax = plt.subplots(figsize=(max(10, len(labels)), max(8, len(labels) * 0.8)))
    sns.heatmap(
        cm, annot=len(labels) <= 30, fmt="d",
        xticklabels=labels, yticklabels=labels,
        cmap="Blues", ax=ax,
    )
    ax.set_xlabel("Predicted")
    ax.set_ylabel("True")
    ax.set_title("SignSpeak v2 — Confusion Matrix")
    plt.tight_layout()
    fig_path = reports_dir / "confusion_matrix.png"
    fig.savefig(fig_path, dpi=150)
    print(f"\n✓ Confusion matrix saved: {fig_path}")

    # Save summary JSON
    summary = {"top1": float(top1), "top3": float(top3), "num_test_samples": int(len(X_test))}
    with open(reports_dir / "eval_summary.json", "w") as f:
        json.dump(summary, f, indent=2)


if __name__ == "__main__":
    main()
