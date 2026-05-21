"""
SignSpeak v2 — Training Utility: Label Map
==========================================
Builds the integer ↔ class-name mapping from the landmarks directory
and serialises it to label_map.json (consumed by both the training
pipeline and the TF.js React app at runtime).

Called from 02_build_dataset.py; can also be run standalone to
inspect or regenerate the label map without rebuilding the dataset.

Standalone usage:
  python -m utils.label_map           # reads config.yaml
  python -m utils.label_map --list    # print class table only
"""

import json
import sys
sys.stdout.reconfigure(encoding="utf-8")
from pathlib import Path

import yaml


def load_config(path="config.yaml"):
    resolved = Path(__file__).parent.parent / path  # utils/ is one level below training/
    with open(resolved) as f:
        return yaml.safe_load(f)


def build_label_map(
    landmarks_dir: Path,
    num_classes: int,
    split: str = "train",
) -> tuple[dict[str, int], dict[str, str]]:
    """
    Scan the given split sub-directory and build deterministic
    label ↔ integer mappings.

    Parameters
    ----------
    landmarks_dir : Path   Root of extracted landmarks
    num_classes   : int    Maximum classes to include (sorted alphabetically)
    split         : str    Which sub-directory to scan ('train')

    Returns
    -------
    label2idx : dict[str, int]   { "HELLO": 0, … }
    idx2label : dict[str, str]   { "0": "HELLO", … }  ← JSON-serialisable
    """
    split_dir = landmarks_dir / split
    if not split_dir.exists():
        raise FileNotFoundError(f"Split directory not found: {split_dir}")

    label_names = sorted(
        d.name for d in split_dir.iterdir() if d.is_dir()
    )[:num_classes]

    label2idx = {name: i for i, name in enumerate(label_names)}
    idx2label = {str(i): name for name, i in label2idx.items()}

    return label2idx, idx2label


def save_label_map(idx2label: dict[str, str], out_path: Path) -> None:
    out_path.parent.mkdir(parents=True, exist_ok=True)
    with open(out_path, "w") as f:
        json.dump(idx2label, f, indent=2)
    print(f"✓ Label map saved: {out_path}  ({len(idx2label)} classes)")


def load_label_map(path: Path) -> dict[str, str]:
    """Load idx2label dict from a saved JSON file."""
    with open(path) as f:
        return json.load(f)


# ─── Standalone entry ─────────────────────────────────────────────────────────

if __name__ == "__main__":
    import argparse
    import sys

    parser = argparse.ArgumentParser(description="Build or inspect the SignSpeak v2 label map")
    parser.add_argument("--list", action="store_true", help="Print class table and exit")
    parser.add_argument("--config", default="config.yaml")
    args = parser.parse_args()

    cfg = load_config(args.config)
    landmarks_dir = Path(cfg["data"]["landmarks_dir"])
    num_classes = cfg["model"]["num_classes"]
    label_map_out = Path(cfg["data"]["label_map_out"])

    label2idx, idx2label = build_label_map(landmarks_dir, num_classes)

    if args.list:
        print(f"\n{'Idx':>4}  Class")
        print("-" * 30)
        for idx_str, name in sorted(idx2label.items(), key=lambda x: int(x[0])):
            print(f"{idx_str:>4}  {name}")
        sys.exit(0)

    save_label_map(idx2label, label_map_out)
