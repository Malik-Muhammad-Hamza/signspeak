"""
SignSpeak v2 — Step 5: Export to TF.js
=======================================
Converts the best Keras checkpoint to TF.js LayersModel format and
copies the label map into the public directory so the React app can
load both at runtime.

Output layout (ready for the React app):
  public/v2/model/model.json
  public/v2/model/label_map.json
  public/v2/model/group1-shard*.bin

Run:
  python 05_export_tfjs.py
"""

import json
import shutil
from pathlib import Path

import yaml
import tensorflowjs as tfjs
import tensorflow as tf


def load_config(path="config.yaml"):
    with open(path) as f:
        return yaml.safe_load(f)


def main():
    cfg = load_config()
    model_dir = Path(cfg["training"]["output_dir"])
    label_map_src = Path(cfg["data"]["label_map_out"])

    # Resolve output dir relative to this script
    tfjs_out = (Path(__file__).parent / cfg["export"]["tfjs_output_dir"]).resolve()
    tfjs_out.mkdir(parents=True, exist_ok=True)

    # Load best checkpoint
    best_ckpt = model_dir / "best.keras"
    if not best_ckpt.exists():
        raise FileNotFoundError(f"No checkpoint found at {best_ckpt}. Run 03_train_tcn.py first.")

    model = tf.keras.models.load_model(str(best_ckpt))
    print(f"Loaded model from {best_ckpt}")
    print(f"  Input : {model.inputs[0].shape}")
    print(f"  Output: {model.outputs[0].shape}")

    # Convert
    quantize = cfg["export"].get("quantize", False)
    if quantize:
        tfjs.converters.save_keras_model(
            model, str(tfjs_out),
            quantization_dtype_map={"float32": "uint8"},
        )
    else:
        tfjs.converters.save_keras_model(model, str(tfjs_out))

    print(f"✓ TF.js model saved: {tfjs_out}")

    # Copy label map
    label_map_dst = tfjs_out / "label_map.json"
    shutil.copy(label_map_src, label_map_dst)
    print(f"✓ Label map copied: {label_map_dst}")

    # Print verification info
    files = list(tfjs_out.iterdir())
    total_mb = sum(f.stat().st_size for f in files) / 1e6
    print(f"\nExported files ({total_mb:.1f} MB total):")
    for f in sorted(files):
        print(f"  {f.name}  ({f.stat().st_size / 1e3:.1f} kB)")


if __name__ == "__main__":
    main()
