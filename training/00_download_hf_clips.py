"""
SignSpeak v2 — Step 0b: Download HF-ASL Clips
===============================================
Downloads selected ASL video clips from the Hugging Face dataset:
  akasheroor/American-Sign-Language-Dataset

Strategy (v2 — uses actual repo file paths):
  1. Call list_repo_files() to enumerate all files inside the HF repo.
  2. Filter to video extensions (.mp4, .webm, .mkv).
  3. For each selected class, match via class aliases and prefix matching.
  4. Apply max_per_class cap if balance_strategy == "cap".
  5. Download each with hf_hub_download(filename=<full_repo_path>).
  6. Copy into: <selected_videos_dir>/<CLASS_NAME>/<filename>
  7. Write hf_manifest.csv.

Run:
  cd C:\\Web-Dev\\Project\\signspeak
  .\\training\\.venv\\Scripts\\python.exe training\\00_download_hf_clips.py --dry-run
  .\\training\\.venv\\Scripts\\python.exe training\\00_download_hf_clips.py
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

VIDEO_EXTS = {".mp4", ".webm", ".mkv"}


def load_config(path: str = "config.yaml") -> dict:
    resolved = Path(__file__).parent / path
    with open(resolved, encoding="utf-8") as f:
        return yaml.safe_load(f)


def normalise(text: str) -> str:
    """Uppercase, strip, remove spaces and underscores."""
    return re.sub(r"[\s_]+", "", text.upper().strip())


def build_alias_map(class_aliases: dict, selected_norm: list[str]) -> dict[str, str]:
    """
    Build alias_norm → canonical_norm lookup from config class_aliases.
    Longer aliases are checked first (avoids "THANK" matching before "THANKYOU").

    Returns dict { alias_normalised: canonical_normalised }
    """
    alias_map: dict[str, str] = {}
    for canonical, aliases in (class_aliases or {}).items():
        cn = normalise(canonical)
        if cn not in selected_norm:
            continue
        for alias in aliases:
            alias_map[normalise(alias)] = cn
    # Also add identity mappings so every canonical matches itself
    for nc in selected_norm:
        alias_map.setdefault(nc, nc)
    return alias_map


def stem_label_from_hyphen(repo_path: str) -> str | None:
    """
    Extract label from hyphen-suffix pattern:
      part_1/0006320057552187119-THANK YOU.mp4  →  "THANKYOU"
    Returns None if no hyphen in stem.
    """
    stem = Path(repo_path).stem
    if "-" in stem:
        after_hyphen = stem.rsplit("-", 1)[1]
        return normalise(after_hyphen)
    return None


def download_one(repo_id, repo_type, repo_path, local_path, dry_run) -> bool:
    if dry_run:
        print(f"    [DRY-RUN] {repo_path}  →  {local_path}")
        return True
    local_path.parent.mkdir(parents=True, exist_ok=True)
    try:
        cached = hf_hub_download(
            repo_id=repo_id,
            filename=repo_path,
            repo_type=repo_type,
            local_files_only=False,
        )
        shutil.copy2(cached, local_path)
        return True
    except Exception as exc:
        msg = str(exc).split("\n")[0][:120]
        print(f"    [FAIL] {repo_path}: {msg}")
        return False


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Download selected HF-ASL clips via list_repo_files()"
    )
    parser.add_argument("--config", default="config.yaml")
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    cfg = load_config(args.config)
    hf = cfg.get("hf_dataset", {})

    if not hf.get("enabled", False):
        print("hf_dataset.enabled is false — nothing to do.")
        return

    repo_id          = hf["repo_id"]
    repo_type        = hf.get("repo_type", "dataset")
    root_dir         = Path(hf["root_dir"])
    videos_dir       = Path(hf["selected_videos_dir"])
    manifest_out     = root_dir / "hf_manifest.csv"
    raw_classes      = hf.get("selected_classes", [])
    selected_norm    = [normalise(c) for c in raw_classes]
    selected_display = [c.upper().strip() for c in raw_classes]

    raw_max = hf.get("max_per_class", None)
    max_per_class: int | None = None if (raw_max is None or raw_max == 0) else int(raw_max)
    balance_strategy = hf.get("balance_strategy", "cap")
    class_aliases    = hf.get("class_aliases", {})
    alias_map        = build_alias_map(class_aliases, selected_norm)

    if not selected_norm:
        print("ERROR: hf_dataset.selected_classes is empty.")
        sys.exit(1)

    print("=" * 65)
    print("SignSpeak v2 — HF-ASL Downloader")
    print("=" * 65)
    print(f"  Repo          : {repo_id}")
    print(f"  Classes       : {selected_display}")
    print(f"  Max/class     : {'ALL' if max_per_class is None else max_per_class}")
    print(f"  Strategy      : {balance_strategy}")
    print(f"  Aliases       : {dict(list(alias_map.items())[:6])} …")
    print(f"  Dry-run       : {args.dry_run}")
    print()

    # Step 1: list repo files
    print("[1/3] Listing all files in HF repo …")
    all_files    = list(list_repo_files(repo_id, repo_type=repo_type))
    video_files  = [f for f in all_files if Path(f).suffix.lower() in VIDEO_EXTS]
    print(f"  Total repo files : {len(all_files)}")
    print(f"  Video files      : {len(video_files)}")
    print()

    # Step 2: match per class
    class_files: dict[str, list[str]]  = {nc: [] for nc in selected_norm}
    alias_matched_counts: dict[str, int] = {nc: 0 for nc in selected_norm}

    for repo_path in video_files:
        label_norm = stem_label_from_hyphen(repo_path)
        if label_norm is not None:
            if label_norm in class_files:
                class_files[label_norm].append(repo_path)
            else:
                # Try alias map
                for alias_norm, canonical in alias_map.items():
                    if label_norm == alias_norm and canonical in class_files:
                        class_files[canonical].append(repo_path)
                        if alias_norm != canonical:
                            alias_matched_counts[canonical] += 1
                        break
        else:
            stem = normalise(Path(repo_path).stem)
            matched = False
            for alias_norm, canonical in alias_map.items():
                if stem.startswith(alias_norm) and canonical in class_files:
                    class_files[canonical].append(repo_path)
                    if alias_norm != canonical:
                        alias_matched_counts[canonical] += 1
                    matched = True
                    break
            if not matched:
                for nc in selected_norm:
                    if stem.startswith(nc):
                        class_files[nc].append(repo_path)
                        break

    print("[2/3] Matched repo files per class:")
    print(f"  {'Class':<22} {'Matched':>8}  {'Via Alias':>10}  {'Will Download':>14}")
    print(f"  {'-'*22} {'-'*8}  {'-'*10}  {'-'*14}")
    for nc, display in zip(selected_norm, selected_display):
        n_total    = len(class_files[nc])
        n_alias    = alias_matched_counts[nc]
        if max_per_class is None or balance_strategy != "cap":
            n_selected = n_total
        else:
            n_selected = min(n_total, max_per_class)
        print(f"  {display:<22} {n_total:>8}  {n_alias:>10}  {n_selected:>14}")
        if n_total == 0:
            print(f"  [WARNING] No repo files matched for class '{display}'.")
    print()

    # Step 3: Download
    print("[3/3] Downloading …")
    print()

    manifest_rows: list[dict]  = []
    grand_downloaded            = 0
    grand_dry_run_selected      = 0
    grand_skipped               = 0
    grand_failed                = 0

    for label_id, (nc, display) in enumerate(zip(selected_norm, selected_display)):
        if max_per_class is not None and balance_strategy == "cap":
            selected_paths = class_files[nc][:max_per_class]
        else:
            selected_paths = class_files[nc]

        downloaded   = 0
        dry_selected = 0
        skipped      = 0
        failed       = 0

        print(f"  ── {display} ({len(selected_paths)} selected) ──")

        for repo_path in tqdm(selected_paths, desc=f"  {display}", leave=False):
            video_name = Path(repo_path).name
            local_path = videos_dir / display / video_name

            if local_path.exists() and local_path.stat().st_size > 0:
                skipped += 1
                manifest_rows.append({
                    "class_name": display, "label_id": label_id,
                    "source_video_path": repo_path,
                    "local_video_path": str(local_path), "status": "existing",
                })
                continue

            ok = download_one(repo_id, repo_type, repo_path, local_path, args.dry_run)
            status = "downloaded" if ok else "failed"
            manifest_rows.append({
                "class_name": display, "label_id": label_id,
                "source_video_path": repo_path,
                "local_video_path": str(local_path), "status": status,
            })
            if ok:
                if args.dry_run: dry_selected += 1
                else: downloaded += 1
            else:
                failed += 1

        grand_downloaded       += downloaded
        grand_dry_run_selected += dry_selected
        grand_skipped          += skipped
        grand_failed           += failed

        if args.dry_run:
            print(f"    {display:<22}  [dry-run] selected={dry_selected}  ↷ skipped={skipped}")
        else:
            print(f"    {display:<22}  ✓ downloaded={downloaded}  ↷ skipped={skipped}  ✗ failed={failed}")

    manifest_out.parent.mkdir(parents=True, exist_ok=True)
    fieldnames = ["class_name", "label_id", "source_video_path", "local_video_path", "status"]
    with open(manifest_out, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(manifest_rows)

    print()
    print("=" * 65)
    print(f"✓ Manifest : {manifest_out}  ({len(manifest_rows)} rows)")
    print(f"  Downloaded: {grand_downloaded}  |  Skipped: {grand_skipped}  |  Failed: {grand_failed}")
    if args.dry_run:
        print(f"  Dry-run selected: {grand_dry_run_selected}")
    print("=" * 65)


if __name__ == "__main__":
    main()
