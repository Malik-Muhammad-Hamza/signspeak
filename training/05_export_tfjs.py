"""
SignSpeak v2 — Step 5: Export to TF.js
=======================================
Converts the best Keras checkpoint to TF.js LayersModel format.

Run:
  cd C:\\Web-Dev\\Project\\signspeak
  .\\training\\.venv-export\\Scripts\\python.exe training\\05_export_tfjs.py
"""

import json
import shutil
import sys
import types

sys.stdout.reconfigure(encoding="utf-8")

for _pkg in ["tensorflow_decision_forests", "tensorflow_hub"]:
    if _pkg not in sys.modules:
        sys.modules[_pkg] = types.ModuleType(_pkg)

try:
    import jax.experimental.jax2tf as _j2tf
    if not hasattr(_j2tf, "shape_poly"):
        _j2tf.shape_poly = types.ModuleType("shape_poly")
except Exception:
    pass

import tensorflowjs as tfjs
import tensorflow as tf
from pathlib import Path
import yaml


def load_config(path="config.yaml"):
    resolved = Path(__file__).parent / path
    with open(resolved) as f:
        return yaml.safe_load(f)


def human_size(n_bytes: int) -> str:
    for unit in ("B", "KB", "MB", "GB"):
        if n_bytes < 1024:
            return f"{n_bytes:.1f} {unit}"
        n_bytes /= 1024
    return f"{n_bytes:.1f} TB"


def main():
    cfg    = load_config()
    hf_cfg = cfg.get("hf_dataset", {})
    use_hf = hf_cfg.get("enabled", False)

    model_dir = Path(cfg["training"]["output_dir"])
    tfjs_out  = (Path(__file__).parent / cfg["export"]["tfjs_output_dir"]).resolve()
    tfjs_out.mkdir(parents=True, exist_ok=True)

    label_map_src = Path(hf_cfg["label_map_out"] if use_hf else cfg["data"]["label_map_out"])
    best_ckpt     = model_dir / "best.keras"

    print(f"Keras model   : {best_ckpt}")
    print(f"Label map src : {label_map_src}")
    print(f"TF.js output  : {tfjs_out}")

    if not best_ckpt.exists():
        print(f"\nERROR: Model not found: {best_ckpt}"); sys.exit(1)
    if not label_map_src.exists():
        print(f"\nERROR: Label map not found: {label_map_src}"); sys.exit(1)

    print(f"\nLoading model …")
    model = tf.keras.models.load_model(str(best_ckpt))
    frame_count = int(cfg["preprocessing"]["frame_count"])
    feature_size = int(cfg["preprocessing"]["feature_size"])
    input_shape = tuple(model.inputs[0].shape[1:])
    if input_shape != (frame_count, feature_size):
        print(f"\nERROR: Model input shape mismatch. Expected {(frame_count, feature_size)}, got {input_shape}.")
        print("Re-run training/03_train_tcn.py with the current two-hand config before exporting.")
        sys.exit(1)
    model.summary(line_length=80)

    keras_causal_layers = [
        layer.name
        for layer in model.layers
        if isinstance(layer, tf.keras.layers.Conv1D)
        and getattr(layer, "padding", None) == "causal"
    ]
    if keras_causal_layers:
        print(f"\nERROR: {len(keras_causal_layers)} Conv1D layer(s) still use padding='causal': {keras_causal_layers}")
        print("This checkpoint was trained with the old architecture.")
        print("Re-run training/03_train_tcn.py so the model is trained with padding='same'.")
        print("Export stopped before replacing the current TF.js model.")
        sys.exit(1)

    print("\nClearing old TF.js model files …")
    cleared = 0
    for old in list(tfjs_out.glob("model.json")) + list(tfjs_out.glob("*.bin")):
        old.unlink()
        cleared += 1
    print(f"  cleared {cleared} file(s)")

    print("\nConverting to TF.js LayersModel …")
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
    print(f"✓ Label map copied : {label_map_dst}")

    # Validate padding after conversion.
    # The model should be trained with padding="same" (see 03_train_tcn.py).
    # If this triggers, re-train the model with the updated 03_train_tcn.py.
    model_json_path = tfjs_out / "model.json"
    with open(model_json_path, encoding="utf-8") as fv:
        model_json = json.load(fv)
    all_layers = model_json.get("modelTopology", {}).get("model_config", {}).get("config", {}).get("layers", [])
    causal_layers = [
        l.get("config", {}).get("name", "?")
        for l in all_layers
        if l.get("class_name") == "Conv1D"
        and l.get("config", {}).get("padding") == "causal"
    ]
    if causal_layers:
        print(f"\nERROR: {len(causal_layers)} Conv1D layer(s) still use padding='causal': {causal_layers}")
        print("Re-train with padding='same'; export will not patch architecture metadata.")
        sys.exit(1)
    else:
        print("  ✓ All Conv1D layers use padding='same' — no patch needed.")

    # Verify format
    with open(model_json_path, encoding="utf-8") as fj:
        meta = json.load(fj)
    print(f"\nmodel.json: format={meta.get('format','?')}  generatedBy={meta.get('generatedBy','?')}")
    if meta.get("format") != "layers-model":
        print("ERROR: format is not 'layers-model'!"); sys.exit(1)
    print("  ✓ format confirmed: layers-model")

    # Model size report
    json_size  = model_json_path.stat().st_size
    bin_size   = sum(p.stat().st_size for p in tfjs_out.glob("*.bin"))
    total_size = json_size + bin_size
    print(f"\nModel size:")
    print(f"  model.json : {human_size(json_size)}")
    print(f"  .bin shards: {human_size(bin_size)}")
    print(f"  Total      : {human_size(total_size)}")
    if total_size > 10 * 1024 * 1024:
        print(f"  ⚠ Model > 10 MB — consider quantize: true in config.yaml")

    print(f"\n✓ Export complete. Files: {tfjs_out}")


if __name__ == "__main__":
    main()
