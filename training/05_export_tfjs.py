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
# tensorflowjs 4.10 imports tensorflow_decision_forests and tensorflow_hub
# unconditionally, and uses jax.experimental.jax2tf.shape_poly.
# None of these are available/functional on Windows — stub them all out.

for _pkg in ["tensorflow_decision_forests", "tensorflow_hub"]:
    if _pkg not in sys.modules:
        sys.modules[_pkg] = types.ModuleType(_pkg)

# shape_poly stub: jax2tf imports it at module level in tensorflowjs 4.10
try:
    import jax.experimental.jax2tf as _j2tf
    if not hasattr(_j2tf, "shape_poly"):
        _j2tf.shape_poly = types.ModuleType("shape_poly")
except Exception:
    pass

# Now safe to import tensorflowjs
import tensorflowjs as tfjs          # noqa: E402
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

    # ── Clear old model files before export ────────────────────────────────────
    # Stale model.json / *.bin from a previous (possibly mis-shaped) export
    # must be removed so TF.js doesn't load an incompatible cached version.
    print("\nClearing old TF.js model files …")
    cleared = 0
    for old in list(tfjs_out.glob("model.json")) + list(tfjs_out.glob("*.bin")):
        old.unlink()
        print(f"  removed: {old.name}")
        cleared += 1
    if cleared == 0:
        print("  (none found — output directory was clean)")

    # ── Convert to TF.js LayersModel ──────────────────────────────────────────
    # IMPORTANT: use save_keras_model() (LayersModel format — weightsManifest).
    # Do NOT use tf.saved_model / graph conversion — residual Add shapes differ.
    print("\nConverting to TF.js LayersModel …")
    quantize = cfg["export"].get("quantize", False)
    if quantize:
        tfjs.converters.save_keras_model(
            model, str(tfjs_out),
            quantization_dtype_map={"float32": "uint8"},
        )
    else:
        tfjs.converters.save_keras_model(model, str(tfjs_out))

    print(f"✓ TF.js model saved : {tfjs_out}")

    # ── Copy label map (always last — overwrite anything tfjs may have written) ─
    label_map_dst = tfjs_out / "label_map.json"
    shutil.copy(label_map_src, label_map_dst)
    print(f"✓ Label map copied  : {label_map_dst}")

    # ── Patch model.json: causal → same (TF.js 4.x workaround) ───────────────
    # TF.js ≥ 4.x has a bug where padding="causal" in dilated Conv1D computes
    # the output length using valid-padding math:
    #   32 frames, kernel=3, 2 conv layers → 28 frames
    # This breaks the residual Add([28,64], [32,64]) at inference time.
    # At fixed-length inference "same" and "causal" produce identical results,
    # so we safely replace the serialised string in model.json.
    model_json_path = tfjs_out / "model.json"
    with open(model_json_path, encoding="utf-8") as fj:
        model_json_text = fj.read()
    causal_count = model_json_text.count('"causal"')
    if causal_count:
        model_json_text = model_json_text.replace('"causal"', '"same"')
        with open(model_json_path, "w", encoding="utf-8") as fj:
            fj.write(model_json_text)
        print(f"✓ Patched {causal_count} causal→same in model.json (TF.js compat fix)")
    else:
        print("  model.json: no causal padding found (already patched or not needed)")

    # ── Verify format ──────────────────────────────────────────────────────────
    import json as _json
    with open(model_json_path, encoding="utf-8") as fj:
        meta = _json.load(fj)
    print(f"\nmodel.json verification:")
    print(f"  format     : {meta.get('format', '?')}")
    print(f"  generatedBy: {meta.get('generatedBy', '?')}")
    print(f"  convertedBy: {meta.get('convertedBy', '?')}")
    assert meta.get("format") == "layers-model", "ERROR: model.json is not a LayersModel!"

    # ── Summary ────────────────────────────────────────────────────────────────
    files = list(tfjs_out.iterdir())
    total_mb = sum(f.stat().st_size for f in files if f.is_file()) / 1e6
    print(f"\nExported files ({total_mb:.1f} MB total):")
    for f in sorted(files):
        if f.is_file():
            print(f"  {f.name}  ({f.stat().st_size / 1e3:.1f} kB)")


if __name__ == "__main__":
    main()

