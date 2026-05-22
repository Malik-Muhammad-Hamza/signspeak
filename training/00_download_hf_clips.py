"""
SignSpeak v2 — Step 0b: Download HF-ASL Clips
===============================================
Downloads selected ASL video clips from the Hugging Face dataset:
  akasheroor/American-Sign-Language-Dataset

Strategy (v2 — uses actual repo file paths):
  1. Call list_repo_files() to enumerate all files inside the HF repo.
     This gives real paths like: part_1/0006320057552187119-THANK YOU.mp4
  2. Filter to video extensions (.mp4, .webm, .mkv).
  3. For each selected class, match repo video paths using:
       a. Hyphen-suffix  — everything after the LAST hyphen in the stem.
          e.g. "part_1/0006320057552187119-THANK YOU.mp4" → label "THANKYOU"
       b. Prefix match   — stem starts with normalised class name.
          e.g. "hello_video_7.mp4" → class "HELLO"
  4. Pick up to max_per_class repo paths per class.
  5. Download each with hf_hub_download(filename=<full_repo_path>).
  6. Copy into: <selected_videos_dir>/<CLASS_NAME>/<filename>
  7. Write hf_manifest.csv.

Normalisation used for matching:
  uppercase → strip whitespace → remove spaces and underscores
  "THANK YOU" → "THANKYOU"
  "THANKYOU"  → "THANKYOU"
  "hello"     → "HELLO"

Run:
  cd C:\\Web-Dev\\Project\\signspeak

  # Dry-run (no downloads):
  .\\training\\.venv\\Scripts\\python.exe training\\00_download_hf_clips.py --dry-run

  # Actual download:
  .\\training\\.venv\\Scripts\\python.exe training\\00_download_hf_clips.py

Flags:
  --config PATH   Config file relative to training/ dir  (default: config.yaml)
  --dry-run       Show what would be downloaded; do not download
"""

import argparse
import csv
import re
import shutil
import sys
sys.stdout.reconfigure(encoding="utf-8")
from pathlib import Path

import yaml
from huggingface_hub import hf_hub_download, list_repo_files
from tqdm import tqdm


# ─── Video extensions to consider ────────────────────────────────────────────
VIDEO_EXTS = {".mp4", ".webm", ".mkv"}


# ─── Config ───────────────────────────────────────────────────────────────────

def load_config(path: str = "config.yaml") -> dict:
    resolved = Path(__file__).parent / path
    with open(resolved, encoding="utf-8") as f:
        return yaml.safe_load(f)


# ─── Label normalisation ──────────────────────────────────────────────────────

def normalise(text: str) -> str:
    """
    Uppercase, strip, remove spaces and underscores.
    "THANK YOU" → "THANKYOU"
    "hello_video_7" is NOT fully normalised here — use stem_label() for that.
    """
    return re.sub(r"[\s_]+", "", text.upper().strip())


def stem_label(repo_path: str) -> str | None:
    """
    Extract the class label encoded in a repo file path.

    Two patterns are supported:

    Pattern A — hyphen suffix (MS-ASL style):
      part_1/0006320057552187119-THANK YOU.mp4
      stem  = "0006320057552187119-THANK YOU"
      label = everything after the LAST hyphen = "THANK YOU"
      normalised = "THANKYOU"

    Pattern B — prefix (simple naming):
      hello_video_7.mp4
      No hyphen-suffix label; caller falls back to prefix matching.
      Returns None so caller can try prefix check.
    """
    stem = Path(repo_path).stem          # e.g. "0006320057552187119-THANK YOU"
    if "-" in stem:
        after_hyphen = stem.rsplit("-", 1)[1]   # "THANK YOU"
        return normalise(after_hyphen)           # "THANKYOU"
    return None


# ─── Download helper ──────────────────────────────────────────────────────────

def download_one(
    repo_id: str,
    repo_type: str,
    repo_path: str,
    local_path: Path,
    dry_run: bool,
) -> bool:
    """
    Download a single file from HF using its full repo-relative path.
    Returns True on success, False on failure.
    """
    if dry_run:
        print(f"    [DRY-RUN] {repo_path}  →  {local_path}")
        return True

    local_path.parent.mkdir(parents=True, exist_ok=True)
    try:
        cached = hf_hub_download(
            repo_id=repo_id,
            filename=repo_path,        # full path including part_N/ prefix
            repo_type=repo_type,
            local_files_only=False,
        )
        shutil.copy2(cached, local_path)
        return True
    except Exception as exc:
        # Trim very long 404 messages to one line
        msg = str(exc).split("\n")[0][:120]
        print(f"    [FAIL] {repo_path}: {msg}")
        return False


# ─── Main ────────────────────────────────────────────────────────────────────

def main() -> None:
    parser = argparse.ArgumentParser(
        description="Download selected HF-ASL clips via list_repo_files()"
    )
    parser.add_argument(
        "--config", default="config.yaml",
        help="Config file relative to training/ directory (default: config.yaml)"
    )
    parser.add_argument(
        "--dry-run", action="store_true",
        help="Show what would be downloaded; do not actually download"
    )
    args = parser.parse_args()

    cfg = load_config(args.config)
    hf = cfg.get("hf_dataset", {})

    if not hf.get("enabled", False):
        print("hf_dataset.enabled is false in config.yaml — nothing to do.")
        return

    repo_id      = hf["repo_id"]
    repo_type    = hf.get("repo_type", "dataset")
    root_dir     = Path(hf["root_dir"])
    videos_dir   = Path(hf["selected_videos_dir"])
    manifest_out = root_dir / "hf_manifest.csv"

    # Normalise selected classes once: "THANK YOU" → "THANKYOU"
    raw_classes: list[str]  = hf.get("selected_classes", [])
    selected_norm: list[str] = [normalise(c) for c in raw_classes]
    # Keep a display name (original uppercase-stripped, no underscore removal)
    selected_display: list[str] = [c.upper().strip() for c in raw_classes]
    max_per_class: int = int(hf.get("max_per_class", 30))

    if not selected_norm:
        print("ERROR: hf_dataset.selected_classes is empty. Edit config.yaml.")
        sys.exit(1)

    print("=" * 65)
    print("SignSpeak v2 — HF-ASL Downloader  (list_repo_files strategy)")
    print("=" * 65)
    print(f"  Repo         : {repo_id}")
    print(f"  Classes      : {selected_display}")
    print(f"  Normalised   : {selected_norm}")
    print(f"  Max/class    : {max_per_class}")
    print(f"  Output dir   : {videos_dir}")
    print(f"  Dry-run      : {args.dry_run}")
    print()

    # ── Step 1: List all repo files ───────────────────────────────────────────
    print("[1/3] Listing all files in HF repo (this may take a moment) …")
    all_files = list(list_repo_files(repo_id, repo_type=repo_type))
    print(f"  Total repo files : {len(all_files)}")

    # Filter to video files only
    video_files = [f for f in all_files if Path(f).suffix.lower() in VIDEO_EXTS]
    print(f"  Video files      : {len(video_files)}")
    print()

    # Sample of first 20 paths for debug
    print("  Sample repo paths (first 20):")
    for p in video_files[:20]:
        print(f"    {p}")
    print()

    # ── Step 2: Build per-class index from repo paths ─────────────────────────
    # class_files[norm_class] = [repo_path, ...]
    class_files: dict[str, list[str]] = {nc: [] for nc in selected_norm}

    for repo_path in video_files:
        # Try Pattern A (hyphen suffix)
        label_norm = stem_label(repo_path)

        if label_norm is not None:
            # Direct label match
            if label_norm in class_files:
                class_files[label_norm].append(repo_path)
        else:
            # Pattern B: check whether the stem starts with any selected class
            stem = normalise(Path(repo_path).stem)   # e.g. "HELLOVIDEO7"
            for nc in selected_norm:
                if stem.startswith(nc):
                    class_files[nc].append(repo_path)
                    break   # only assign to first matching class

    print("[2/3] Matched repo files per class:")
    for nc, display in zip(selected_norm, selected_display):
        n_total    = len(class_files[nc])
        n_selected = min(n_total, max_per_class)
        print(f"  {display:<20} {n_total} matched  →  {n_selected} will be downloaded")
        if n_total == 0:
            print(f"  [WARNING] No repo files matched for class '{display}'. "
                  "Check normalisation or class name in config.")
    print()

    # ── Step 3: Download ──────────────────────────────────────────────────────
    print("[3/3] Downloading …")
    print()

    manifest_rows: list[dict] = []
    grand_downloaded     = 0
    grand_dry_run_selected = 0
    grand_skipped        = 0
    grand_failed         = 0

    for label_id, (nc, display) in enumerate(zip(selected_norm, selected_display)):
        selected_paths = class_files[nc][:max_per_class]
        downloaded     = 0
        dry_selected   = 0
        skipped        = 0
        failed         = 0

        print(f"  ── {display} ({len(selected_paths)} selected) ──")

        for repo_path in tqdm(selected_paths, desc=f"  {display}", leave=False):
            video_name = Path(repo_path).name
            local_path = videos_dir / display / video_name

            if local_path.exists() and local_path.stat().st_size > 0:
                skipped += 1
                manifest_rows.append({
                    "class_name":        display,
                    "label_id":          label_id,
                    "source_video_path": repo_path,
                    "local_video_path":  str(local_path),
                    "status":            "existing",
                })
                continue

            ok = download_one(
                repo_id=repo_id,
                repo_type=repo_type,
                repo_path=repo_path,
                local_path=local_path,
                dry_run=args.dry_run,
            )

            status = "downloaded" if ok else "failed"
            manifest_rows.append({
                "class_name":        display,
                "label_id":          label_id,
                "source_video_path": repo_path,
                "local_video_path":  str(local_path),
                "status":            status,
            })

            if ok:
                if args.dry_run:
                    dry_selected += 1
                else:
                    downloaded += 1
            else:
                failed += 1

        grand_downloaded       += downloaded
        grand_dry_run_selected += dry_selected
        grand_skipped          += skipped
        grand_failed           += failed

        if args.dry_run:
            print(
                f"    {display:<20}  "
                f"[dry-run] selected={dry_selected}  ↷ skipped={skipped}"
            )
        else:
            print(
                f"    {display:<20}  "
                f"✓ downloaded={downloaded}  ↷ skipped={skipped}  ✗ failed={failed}"
            )

    # ── Write manifest ────────────────────────────────────────────────────────
    manifest_out.parent.mkdir(parents=True, exist_ok=True)
    fieldnames = ["class_name", "label_id", "source_video_path", "local_video_path", "status"]
    with open(manifest_out, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(manifest_rows)

    print()
    print("=" * 65)
    print(f"✓ Manifest written : {manifest_out}  ({len(manifest_rows)} rows)")
    print()
    print("── Download Summary ───────────────────────────────────────────")
    if args.dry_run:
        print(f"  Dry-run selected: {grand_dry_run_selected}")
    print(f"  Downloaded      : {grand_downloaded}")
    print(f"  Already existed : {grand_skipped}")
    print(f"  Failed          : {grand_failed}")
    print("───────────────────────────────────────────────────────────────")


if __name__ == "__main__":
    main()
