"""
SignSpeak v2 — Step 4: Evaluate
================================
Loads the best checkpoint and evaluates it on the test split.

Outputs:
  models/tcn_v2/evaluation/confusion_matrix.png    — visual confusion matrix
  models/tcn_v2/evaluation/evaluation_summary.json — full metrics JSON
  models/tcn_v2/evaluation/classification_report.txt

Also alerts if THANKYOU ↔ GOOD confusion rate is high.

Run:
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


def main():
    cfg    = load_config()
    hf_cfg = cfg.get("hf_dataset", {})
    use_hf = hf_cfg.get("enabled", False)

    model_dir = Path(cfg["training"]["output_dir"])

    if use_hf:
        dataset_path   = Path(hf_cfg["dataset_path"])
        label_map_path = Path(hf_cfg["label_map_out"])
        print("Dataset mode  : HF-ASL")
    else:
        dataset_path   = Path(cfg["data"]["dataset_path"])
        label_map_path = Path(cfg["data"]["label_map_out"])
        print("Dataset mode  : MS-ASL")

    model_path = model_dir / "best.keras"
    eval_dir   = model_dir / "evaluation"
    eval_dir.mkdir(parents=True, exist_ok=True)

    print(f"Dataset       : {dataset_path}")
    print(f"Label map     : {label_map_path}")
    print(f"Model         : {model_path}")

    for path, msg in [
        (dataset_path,   "Run 02_build_dataset.py first."),
        (label_map_path, "Run 02_build_dataset.py first."),
        (model_path,     "Run 03_train_tcn.py first."),
    ]:
        if not path.exists():
            print(f"\nERROR: Not found: {path}\n{msg}")
            sys.exit(1)

    with open(label_map_path, encoding="utf-8") as f:
        idx2label = json.load(f)
    labels = [idx2label[str(i)] for i in range(len(idx2label))]
    print(f"\nClasses ({len(labels)}): {labels}")

    with h5py.File(dataset_path, "r") as hf:
        X_test = hf["X_test"][:]
        y_test = hf["y_test"][:]

    if len(X_test) == 0:
        print(f"\nERROR: X_test is empty. Re-run 02_build_dataset.py.")
        sys.exit(1)

    frame_count = int(cfg["preprocessing"]["frame_count"])
    feature_size = int(cfg["preprocessing"]["feature_size"])
    if X_test.shape[1:] != (frame_count, feature_size):
        print(f"\nERROR: X_test shape mismatch. Expected {(frame_count, feature_size)}, got {X_test.shape[1:]}.")
        print("Re-run 01_extract_landmarks.py and 02_build_dataset.py for the two-hand format.")
        sys.exit(1)

    print(f"X_test : {X_test.shape}")
    print("\nLoading model …")
    model = tf.keras.models.load_model(str(model_path))
    model_shape = tuple(model.inputs[0].shape[1:])
    if model_shape != (frame_count, feature_size):
        print(f"\nERROR: Model input shape mismatch. Expected {(frame_count, feature_size)}, got {model_shape}.")
        print("Re-run 03_train_tcn.py with the current config.")
        sys.exit(1)

    print("Running inference …")
    y_pred_probs = model.predict(X_test, verbose=1)
    y_pred       = np.argmax(y_pred_probs, axis=1)

    # Top-1 accuracy
    acc = float(np.mean(y_pred == y_test))
    print(f"\nTest top-1 accuracy : {acc:.4f}  ({acc*100:.1f}%)")

    # Top-2 accuracy
    top2_correct = 0
    for i, true_cls in enumerate(y_test):
        top2_preds = np.argsort(y_pred_probs[i])[-2:]
        if true_cls in top2_preds:
            top2_correct += 1
    top2_acc = top2_correct / len(y_test)
    print(f"Test top-2 accuracy : {top2_acc:.4f}  ({top2_acc*100:.1f}%)")

    # Per-class accuracy
    print("\nPer-class accuracy:")
    per_class_acc     = {}
    per_class_support = {}
    low_support_classes = []
    for cls_id, cls_name in enumerate(labels):
        mask = y_test == cls_id
        support = int(mask.sum())
        per_class_support[cls_name] = support
        if support == 0:
            per_class_acc[cls_name] = None
            print(f"  {cls_name:<22}  no test samples  ⚠ ZERO SUPPORT")
            low_support_classes.append(cls_name)
            continue
        cls_acc = float(np.mean(y_pred[mask] == y_test[mask]))
        per_class_acc[cls_name] = round(cls_acc, 4)
        flag = "  ⚠ LOW" if cls_acc < 0.70 else ""
        low_warn = "  ⚠ LOW SUPPORT" if support < 5 else ""
        if support < 5:
            low_support_classes.append(cls_name)
        print(f"  {cls_name:<22}  {cls_acc:.4f}  ({support} samples){flag}{low_warn}")

    # Classification report
    report_str = classification_report(y_test, y_pred, target_names=labels)
    print("\n" + report_str)
    report_path = eval_dir / "classification_report.txt"
    report_path.write_text(report_str, encoding="utf-8")
    print(f"✓ Classification report: {report_path}")

    # Confusion matrix image
    cm = confusion_matrix(y_test, y_pred)
    fig, ax = plt.subplots(figsize=(10, 8))
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
    print(f"✓ Confusion matrix: {fig_path}")

    # Worst confused pairs
    cm_no_diag = cm.copy()
    np.fill_diagonal(cm_no_diag, 0)
    flat_idx = np.argsort(cm_no_diag.ravel())[::-1][:10]
    confused_pairs = []
    for idx in flat_idx:
        true_i, pred_j = divmod(int(idx), len(labels))
        count = int(cm_no_diag[true_i, pred_j])
        if count == 0:
            break
        confused_pairs.append({
            "true":  labels[true_i],
            "pred":  labels[pred_j],
            "count": count,
        })
    if confused_pairs:
        print("\nWorst confused pairs:")
        for p in confused_pairs[:5]:
            print(f"  {p['true']:<14} → predicted as {p['pred']:<14}  ({p['count']} times)")

    # THANKYOU ↔ GOOD specific alert
    if "THANKYOU" in labels and "GOOD" in labels:
        ty_id   = labels.index("THANKYOU")
        good_id = labels.index("GOOD")
        ty_as_good   = int(cm[ty_id,   good_id])
        good_as_ty   = int(cm[good_id, ty_id])
        ty_total     = int(cm[ty_id,   :].sum())
        good_total   = int(cm[good_id, :].sum())
        ty_conf_rate   = ty_as_good   / ty_total   if ty_total   > 0 else 0
        good_conf_rate = good_as_ty   / good_total if good_total > 0 else 0
        print(f"\n── THANKYOU ↔ GOOD confusion check ──")
        print(f"  THANKYOU → GOOD   : {ty_as_good} / {ty_total} ({ty_conf_rate:.1%})")
        print(f"  GOOD → THANKYOU   : {good_as_ty} / {good_total} ({good_conf_rate:.1%})")
        if ty_conf_rate > 0.20 or good_conf_rate > 0.20:
            print("  ⚠ ALERT: High THANKYOU↔GOOD confusion (>20%). "
                  "Consider collecting more or distinct training clips.")
        else:
            print("  ✓ Confusion within acceptable range (<20%).")

    # Low-support warning
    if low_support_classes:
        print(f"\n  ⚠ LOW SUPPORT WARNING: {low_support_classes}")
        print("  These classes have < 5 test samples. Accuracy estimates are unreliable.")
        print("  Collect more training data (target max_per_class: 80) and re-run pipeline.")

    # Summary JSON
    summary = {
        "dataset_mode":         "HF-ASL" if use_hf else "MS-ASL",
        "test_top1_accuracy":   round(acc,     4),
        "test_top2_accuracy":   round(top2_acc, 4),
        "num_test_samples":     int(len(X_test)),
        "classes":              labels,
        "per_class_accuracy":   per_class_acc,
        "per_class_support":    per_class_support,
        "low_support_classes":  low_support_classes,
        "worst_confused_pairs": confused_pairs,
        "confusion_matrix":     cm.tolist(),
    }
    summary_path = eval_dir / "evaluation_summary.json"
    with open(summary_path, "w", encoding="utf-8") as f:
        json.dump(summary, f, indent=2)
    print(f"\n✓ Evaluation summary: {summary_path}")


if __name__ == "__main__":
    main()
