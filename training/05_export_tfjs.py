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

HF-ASL mode  (hf_dataset.enabled: true):
  Keras model : training.output_dir/best.keras
  Label map   : hf_dataset.label_map_out

MS-ASL mode  (hf_dataset.enabled: false):
  Keras model : training.output_dir/best.keras
  Label map   : data.label_map_out

IMPORTANT — use the export venv (has tensorflowjs):
  cd C:\\Web-Dev\\Project\\signspeak
  .\\training\\.venv-export\\Scripts\\python.exe training\\05_export_tfjs.py
"""

import json
import shutil
import sys
import types

sys.stdout.reconfigure(encoding="utf-8")

# ── Windows workaround ────────────────────────────────────────────────────────
# tensorflowjs imports tensorflow_decision_forests unconditionally.
# On Windows the required inference.so binary is missing, causing a hard crash.
# Inject a dummy module so the import succeeds without the native extension.
if "tensorflow_decision_forests" not in sys.modules:
    _stub = types.ModuleType("tensorflow_decision_forests")
    # tensorflowjs only checks for the module's existence; no attributes needed.
    sys.modules["tensorflow_decision_forests"] = _stub

# Now it is safe to import tensorflowjs
import tensorflowjs as tfjs          # noqa: E402  (after sys.modules patch)
import tensorflow as tf              # noqa: E402

from pathlib import Path
import yaml


def load_config(path="config.yaml"):
    resolved = Path(__file__).parent / path
    with open(resolved) as f:
        return yaml.safe_load(f)


def main():
    cfg    = load_config()
    hf_cfg = cfg.get("hf_dataset", {})
    use_hf = hf_cfg.get("enabled", False)

    model_dir = Path(cfg["training"]["output_dir"])

    # ── Resolve label-map source ───────────────────────────────────────────────
    if use_hf:
        label_map_src = Path(hf_cfg["label_map_out"])
        print("=" * 60)
        print("Dataset mode  : HF-ASL")
    else:
        label_map_src = Path(cfg["data"]["label_map_out"])
        print("Dataset mode  : MS-ASL")

    # ── Resolve TF.js output dir ───────────────────────────────────────────────
    tfjs_out = (Path(__file__).parent / cfg["export"]["tfjs_output_dir"]).resolve()
    tfjs_out.mkdir(parents=True, exist_ok=True)

    best_ckpt = model_dir / "best.keras"

    print(f"Keras model   : {best_ckpt}")
    print(f"Label map     : {label_map_src}")
    print(f"TF.js output  : {tfjs_out}")
    print("=" * 60)

    # ── Validate ───────────────────────────────────────────────────────────────
    if not best_ckpt.exists():
        print(f"\nERROR: Model not found: {best_ckpt}")
        print("Run 03_train_tcn.py first.")
        sys.exit(1)

    if not label_map_src.exists():
        print(f"\nERROR: Label map not found: {label_map_src}")
        print("Run 02_build_dataset.py first.")
        sys.exit(1)

    # ── Load model ─────────────────────────────────────────────────────────────
    print(f"\nLoading model …")
    model = tf.keras.models.load_model(str(best_ckpt))
    print(f"  Input shape : {model.inputs[0].shape}")
    print(f"  Output shape: {model.outputs[0].shape}")

    # ── Convert to TF.js ───────────────────────────────────────────────────────
    print("\nConverting to TF.js …")
    quantize = cfg["export"].get("quantize", False)
    if quantize:
        tfjs.converters.save_keras_model(
            model, str(tfjs_out),
            quantization_dtype_map={"float32": "uint8"},
        )
    else:
        tfjs.converters.save_keras_model(model, str(tfjs_out))

    print(f"✓ TF.js model saved : {tfjs_out}")

    # ── Copy label map ─────────────────────────────────────────────────────────
    label_map_dst = tfjs_out / "label_map.json"
    shutil.copy(label_map_src, label_map_dst)
    print(f"✓ Label map copied  : {label_map_dst}")

    # ── Summary ────────────────────────────────────────────────────────────────
    files = list(tfjs_out.iterdir())
    total_mb = sum(f.stat().st_size for f in files if f.is_file()) / 1e6
    print(f"\nExported files ({total_mb:.1f} MB total):")
    for f in sorted(files):
        if f.is_file():
            print(f"  {f.name}  ({f.stat().st_size / 1e3:.1f} kB)")


if __name__ == "__main__":
    main()

