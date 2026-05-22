"""
SignSpeak v2 — Step 4: Evaluate
================================
Loads the best checkpoint and evaluates it on the test split.
Outputs per-class accuracy, top-3 accuracy, and a confusion-matrix PNG.

HF-ASL mode  (hf_dataset.enabled: true):
  Dataset  : hf_dataset.dataset_path
  Label map: hf_dataset.label_map_out

MS-ASL mode  (hf_dataset.enabled: false):
  Dataset  : data.dataset_path
  Label map: data.label_map_out

IMPORTANT — use the training venv interpreter:
  cd C:\\Web-Dev\\Project\\signspeak
  .\\training\\.venv\\Scripts\\python.exe training\\04_evaluate.py
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
    cfg    = load_config()
    hf_cfg = cfg.get("hf_dataset", {})
    use_hf = hf_cfg.get("enabled", False)

    model_dir = Path(cfg["training"]["output_dir"])

    # ── Resolve paths ──────────────────────────────────────────────────────────
    if use_hf:
        dataset_path   = Path(hf_cfg["dataset_path"])
        label_map_path = Path(hf_cfg["label_map_out"])
        print("=" * 60)
        print("Dataset mode  : HF-ASL")
    else:
        dataset_path   = Path(cfg["data"]["dataset_path"])
        label_map_path = Path(cfg["data"]["label_map_out"])
        print("Dataset mode  : MS-ASL")

    # Try best.keras inside model_dir; fall back one level up
    model_path = model_dir / "best.keras"
    if not model_path.exists():
        alt = Path(__file__).parent / model_dir / "best.keras"
        if alt.exists():
            model_path = alt

    eval_dir = model_dir / "evaluation"
    eval_dir.mkdir(parents=True, exist_ok=True)

    print(f"Dataset path  : {dataset_path}")
    print(f"Label map     : {label_map_path}")
    print(f"Model         : {model_path}")
    print(f"Output dir    : {eval_dir}")
    print("=" * 60)

    # ── Validate paths ─────────────────────────────────────────────────────────
    if not dataset_path.exists():
        print(f"\nERROR: Dataset not found: {dataset_path}")
        print("Run 02_build_dataset.py first.")
        sys.exit(1)

    if not label_map_path.exists():
        print(f"\nERROR: Label map not found: {label_map_path}")
        sys.exit(1)

    if not model_path.exists():
        print(f"\nERROR: Model not found: {model_path}")
        print("Run 03_train_tcn.py first.")
        sys.exit(1)

    # ── Load label map ─────────────────────────────────────────────────────────
    with open(label_map_path, encoding="utf-8") as f:
        idx2label = json.load(f)
    labels = [idx2label[str(i)] for i in range(len(idx2label))]
    print(f"\nClasses ({len(labels)}): {labels}")

    # ── Load test data ─────────────────────────────────────────────────────────
    with h5py.File(dataset_path, "r") as hf:
        X_test = hf["X_test"][:]
        y_test = hf["y_test"][:]

    print(f"X_test : {X_test.shape}")
    print(f"y_test : {y_test.shape}")

    if len(X_test) == 0:
        print(f"\nERROR: X_test is empty in: {dataset_path}")
        print("Re-run 02_build_dataset.py to rebuild the dataset.")
        sys.exit(1)

    # ── Load model & predict ───────────────────────────────────────────────────
    print(f"\nLoading model from: {model_path}")
    model = tf.keras.models.load_model(str(model_path))

    print("Running inference …")
    y_pred_probs = model.predict(X_test, verbose=1)
    y_pred = np.argmax(y_pred_probs, axis=1)

    # ── Metrics ────────────────────────────────────────────────────────────────
    top1 = float(np.mean(y_pred == y_test))
    k    = min(3, len(labels))
    top3 = float(top_k_accuracy(y_test, y_pred_probs, k=k))

    print(f"\nTop-1 accuracy : {top1:.4f}")
    print(f"Top-{k} accuracy : {top3:.4f}")
    print("\nPer-class report:")
    print(classification_report(y_test, y_pred, target_names=labels))

    # ── Confusion matrix ───────────────────────────────────────────────────────
    cm = confusion_matrix(y_test, y_pred)
    fig, ax = plt.subplots(figsize=(max(8, len(labels)), max(6, len(labels) * 0.8)))
    sns.heatmap(
        cm, annot=True, fmt="d",
        xticklabels=labels, yticklabels=labels,
        cmap="Blues", ax=ax,
    )
    ax.set_xlabel("Predicted")
    ax.set_ylabel("True")
    ax.set_title("SignSpeak v2 — Confusion Matrix")
    plt.tight_layout()
    fig_path = eval_dir / "confusion_matrix.png"
    fig.savefig(fig_path, dpi=150)
    plt.close(fig)
    print(f"\n✓ Confusion matrix saved: {fig_path}")

    # ── Save summary JSON ──────────────────────────────────────────────────────
    summary = {
        "dataset_mode":      "HF-ASL" if use_hf else "MS-ASL",
        "dataset_path":      str(dataset_path),
        "model_path":        str(model_path),
        "num_test_samples":  int(len(X_test)),
        "top1_accuracy":     top1,
        f"top{k}_accuracy":  top3,
        "classes":           labels,
    }
    summary_path = eval_dir / "eval_summary.json"
    with open(summary_path, "w", encoding="utf-8") as f:
        json.dump(summary, f, indent=2)
    print(f"✓ Eval summary saved : {summary_path}")


if __name__ == "__main__":
    main()

