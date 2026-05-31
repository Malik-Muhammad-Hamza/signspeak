"""
SignSpeak v2 — Step 0: Download MS-ASL Clips
=============================================
Reads MSASL_train/val/test.json, filters to the selected classes defined
in config.yaml, downloads each YouTube clip with yt-dlp (trimmed to the
annotated start/end window), and writes a manifest CSV.

Requirements (install separately – NOT part of training/requirements.txt):
  pip install yt-dlp

ffmpeg must also be on PATH (used by yt-dlp for post-processing trim).

Output:
  videos/{split}/{label}/{label}_{split}_{N:05d}.mp4
  processed/clips_manifest.csv

Manifest columns:
  split, label, compact_label_id, original_label_id,
  url, start_time, end_time, video_path, source_file, status

Run:
  cd C:\\Web-Dev\\Project\\signspeak\\training
  python 00_download_clips.py

Flags:
  --config PATH    Override config.yaml location (default: config.yaml)
  --dry-run        Print what would be downloaded without actually downloading
  --splits         Comma-separated list of splits to process (default: train,val,test)
"""

import argparse
import csv
import json
import os
import re
import subprocess
import sys
sys.stdout.reconfigure(encoding="utf-8")
from collections import defaultdict
from pathlib import Path

import yaml


# ─── Config ──────────────────────────────────────────────────────────────────

def load_config(path: str = "config.yaml") -> dict:
    resolved = Path(__file__).parent / path
    with open(resolved) as f:
        return yaml.safe_load(f)


# ─── Helpers ─────────────────────────────────────────────────────────────────

def safe_url(url: str) -> str:
    """Ensure the URL has a scheme."""
    url = url.strip()
    if url and not url.startswith("http"):
        url = "https://" + url
    return url


def safe_filename(text: str) -> str:
    """Strip characters unsafe for filenames."""
    return re.sub(r"[^A-Za-z0-9_\-]", "_", text).lower()


def build_compact_label_map(classes: list[str]) -> dict[str, int]:
    """Return {label_text: compact_id} from the ordered config classes list."""
    return {str(cls).lower().strip(): i for i, cls in enumerate(classes)}


def normalise_label(text: str) -> str:
    return text.lower().strip()


def extract_video_id(url: str) -> str | None:
    """Extract the YouTube video ID from a URL."""
    m = re.search(r"(?:v=|youtu\.be/)([A-Za-z0-9_\-]{11})", url)
    return m.group(1) if m else None


def check_ytdlp() -> bool:
    try:
        subprocess.run(
            ["yt-dlp", "--version"],
            capture_output=True,
            check=True,
        )
        return True
    except (FileNotFoundError, subprocess.CalledProcessError):
        return False


def load_failures(failures_path: Path) -> set[str]:
    """Load previously-recorded dead video IDs from JSON."""
    if failures_path.exists():
        try:
            with open(failures_path, encoding="utf-8") as f:
                data = json.load(f)
            return set(data.get("dead_video_ids", []))
        except Exception:
            pass
    return set()


def save_failures(failures_path: Path, dead_ids: set[str]) -> None:
    """Persist dead video IDs to JSON so future runs skip them immediately."""
    failures_path.parent.mkdir(parents=True, exist_ok=True)
    with open(failures_path, "w", encoding="utf-8") as f:
        json.dump({"dead_video_ids": sorted(dead_ids)}, f, indent=2)


# ─── Download ─────────────────────────────────────────────────────────────────

#: Hard cap per download attempt (seconds). Keeps the run moving.
DOWNLOAD_TIMEOUT = 25

#: Error substrings that indicate the video is permanently dead.
_DEAD_VIDEO_PATTERNS = (
    "video unavailable",
    "this video is not available",
    "private video",
    "has been removed",
    "not available in your country",
    "account associated with this video has been terminated",
)


def _is_dead_video_error(stderr: str) -> bool:
    low = stderr.lower()
    return any(p in low for p in _DEAD_VIDEO_PATTERNS)


def download_clip(
    url: str,
    start_time: float,
    end_time: float,
    out_path: Path,
    dry_run: bool = False,
) -> tuple[bool, bool]:
    """
    Download a YouTube clip trimmed to [start_time, end_time] using yt-dlp.

    Returns:
        (success: bool, is_dead_video: bool)
        is_dead_video is True when the error indicates the video is permanently
        unavailable (private, removed, etc.) — callers should blacklist the ID.
    """
    if dry_run:
        print(f"  [DRY-RUN] Would download: {url} [{start_time:.2f}s – {end_time:.2f}s] → {out_path}")
        return True, False

    out_path.parent.mkdir(parents=True, exist_ok=True)

    cmd = [
        "yt-dlp",
        "--quiet",
        "--no-warnings",
        "--format", "bestvideo[ext=mp4]+bestaudio[ext=m4a]/mp4",
        "--download-sections", f"*{start_time:.3f}-{end_time:.3f}",
        "--force-keyframes-at-cuts",
        "--merge-output-format", "mp4",
        "--output", str(out_path),
        url,
    ]

    try:
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=DOWNLOAD_TIMEOUT,
        )
        if result.returncode != 0:
            dead = _is_dead_video_error(result.stderr)
            tag = "[DEAD]" if dead else "[FAIL]"
            print(f"  {tag} yt-dlp exit {result.returncode}: {result.stderr[:200]}")
            return False, dead
        if not out_path.exists() or out_path.stat().st_size == 0:
            print(f"  [FAIL] output file missing or empty: {out_path}")
            return False, False
        return True, False
    except subprocess.TimeoutExpired:
        print(f"  [TIMEOUT] {DOWNLOAD_TIMEOUT}s exceeded for {url}  — skipping")
        return False, False
    except Exception as exc:
        print(f"  [FAIL] {exc}")
        return False, False


# ─── Progress summary ─────────────────────────────────────────────────────────

def print_summary(
    split: str,
    attempts: int,
    successes: dict[str, int],
    failures: dict[str, int],
    skipped_dead: int,
    max_per: int | None,
) -> None:
    """Print a concise progress snapshot."""
    total_ok   = sum(successes.values())
    total_fail = sum(failures.values())
    print(
        f"\n  ── Progress [{split.upper()}]  attempts={attempts}  "
        f"ok={total_ok}  fail={total_fail}  dead_skipped={skipped_dead} ──"
    )
    all_labels = sorted(set(successes) | set(failures))
    for lbl in all_labels:
        ok_n   = successes.get(lbl, 0)
        fail_n = failures.get(lbl, 0)
        cap    = f"/{max_per}" if max_per else ""
        print(f"    {lbl:<14} ✓{ok_n}{cap}  ✗{fail_n}")
    print()


# ─── Main ────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="Download MS-ASL clips for selected classes")
    parser.add_argument("--config", default="config.yaml")
    parser.add_argument("--dry-run", action="store_true", help="Print plan without downloading")
    parser.add_argument("--splits", default="train,val,test", help="Comma-separated splits to process")
    args = parser.parse_args()

    cfg = load_config(args.config)

    ms_asl_root   = Path(cfg["data"]["ms_asl_root"])
    videos_dir    = Path(cfg["data"]["videos_dir"])
    processed_dir = Path(cfg["data"]["processed_dir"])
    classes       = cfg.get("classes", [])
    max_per       = cfg.get("download", {}).get("max_per_class_per_split", None)
    splits        = [s.strip() for s in args.splits.split(",")]

    # Path for persisting dead video IDs across runs
    failures_path = Path(cfg["data"].get("data_dir", str(processed_dir.parent))) / "download_failures.json"

    if not classes:
        print("ERROR: No classes defined in config.yaml under 'classes:'")
        sys.exit(1)

    compact_map = build_compact_label_map(classes)  # {word: id}
    print(f"Selected classes: {compact_map}")
    print(f"max_per_class_per_split: {max_per}")
    print(f"Per-download timeout: {DOWNLOAD_TIMEOUT}s")
    print()

    if not args.dry_run and not check_ytdlp():
        print(
            "ERROR: yt-dlp not found. Install it with:\n"
            "  pip install yt-dlp\n"
            "and ensure ffmpeg is on PATH."
        )
        sys.exit(1)

    processed_dir.mkdir(parents=True, exist_ok=True)
    manifest_path = processed_dir / "clips_manifest.csv"

    # ── Dead-video-ID cache (persisted across runs) ───────────────────────────
    dead_video_ids: set[str] = load_failures(failures_path)
    if dead_video_ids:
        print(f"Loaded {len(dead_video_ids)} dead video IDs from {failures_path} — those will be skipped.")

    # ── Load existing manifest ────────────────────────────────────────────────
    existing_paths: set[str] = set()
    existing_rows: list[dict] = []
    if manifest_path.exists():
        with open(manifest_path, newline="", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            for row in reader:
                existing_rows.append(row)
                if row.get("status") in ("downloaded", "existing"):
                    existing_paths.add(row["video_path"])
        print(f"Loaded {len(existing_rows)} existing manifest rows.")

    manifest_rows: list[dict] = list(existing_rows)

    # ── Grand totals (across all splits) ──────────────────────────────────────
    grand_downloaded = 0
    grand_skipped    = 0
    grand_failed     = 0
    grand_dead_skip  = 0

    # ── Final per-split/class summary storage ─────────────────────────────────
    final_counts: dict[str, dict[str, int]] = {sp: defaultdict(int) for sp in splits}

    try:
        for split in splits:
            json_path = ms_asl_root / f"MSASL_{split}.json"
            if not json_path.exists():
                print(f"[skip] {json_path} not found")
                continue

            with open(json_path, encoding="utf-8") as f:
                entries = json.load(f)

            print(f"\n── {split.upper()} ──  ({len(entries)} total entries in JSON)")

            # Per-split counters
            successes: dict[str, int] = defaultdict(int)   # label → ok count
            failures:  dict[str, int] = defaultdict(int)   # label → fail count
            class_counters: dict[str, int] = defaultdict(int)  # label → total downloaded
            attempts  = 0
            dead_skip = 0  # dead-ID skips this split

            for entry in entries:
                # ── Check if all classes have hit the cap ──────────────────
                if max_per is not None:
                    saturated = all(
                        class_counters[lbl] >= max_per for lbl in compact_map
                    )
                    if saturated:
                        print(
                            f"\n  [INFO] All classes reached max_per_class_per_split={max_per}"
                            f" in split '{split}'. Moving on."
                        )
                        break

                raw_label   = str(entry.get("text", entry.get("clean_text", ""))).lower().strip()
                clean_label = str(entry.get("clean_text", raw_label)).lower().strip()

                matched_label = None
                for candidate in (raw_label, clean_label):
                    if candidate in compact_map:
                        matched_label = candidate
                        break

                if matched_label is None:
                    continue

                # ── Per-class cap ─────────────────────────────────────────
                if max_per is not None and class_counters[matched_label] >= max_per:
                    continue

                compact_id  = compact_map[matched_label]
                original_id = entry.get("label", -1)
                url         = safe_url(str(entry.get("url", "")))
                start_time  = float(entry.get("start_time", entry.get("start", 0)))
                end_time    = float(entry.get("end_time",   entry.get("end",   0)))
                source_file = f"MSASL_{split}.json"

                if not url or end_time <= start_time:
                    manifest_rows.append({
                        "split": split, "label": matched_label,
                        "compact_label_id": compact_id,
                        "original_label_id": original_id,
                        "url": url, "start_time": start_time, "end_time": end_time,
                        "video_path": "", "source_file": source_file,
                        "status": "skipped_bad_timing",
                    })
                    grand_skipped += 1
                    continue

                # ── Dead-video-ID fast-skip ───────────────────────────────
                vid_id = extract_video_id(url)
                if vid_id and vid_id in dead_video_ids:
                    dead_skip  += 1
                    grand_dead_skip += 1
                    manifest_rows.append({
                        "split": split, "label": matched_label,
                        "compact_label_id": compact_id,
                        "original_label_id": original_id,
                        "url": url, "start_time": start_time, "end_time": end_time,
                        "video_path": "", "source_file": source_file,
                        "status": "skipped_dead_video",
                    })
                    continue

                # ── Output path ───────────────────────────────────────────
                n = class_counters[matched_label]
                vid_name     = f"{safe_filename(matched_label)}_{split}_{n:05d}.mp4"
                vid_path     = videos_dir / split / matched_label / vid_name
                vid_path_str = str(vid_path)

                # Already downloaded?
                if vid_path.exists() and vid_path_str in existing_paths:
                    class_counters[matched_label] += 1
                    successes[matched_label]      += 1
                    final_counts[split][matched_label] += 1
                    grand_skipped += 1
                    manifest_rows.append({
                        "split": split, "label": matched_label,
                        "compact_label_id": compact_id,
                        "original_label_id": original_id,
                        "url": url, "start_time": start_time, "end_time": end_time,
                        "video_path": vid_path_str, "source_file": source_file,
                        "status": "existing",
                    })
                    continue

                # ── Download ──────────────────────────────────────────────
                attempts += 1
                print(f"  [{split}] {matched_label} #{n:05d}  {url}  [{start_time:.2f}–{end_time:.2f}s]")
                ok, is_dead = download_clip(url, start_time, end_time, vid_path, dry_run=args.dry_run)
                status = "downloaded" if ok else "failed"

                # Blacklist permanently dead video IDs
                if is_dead and vid_id:
                    dead_video_ids.add(vid_id)
                    save_failures(failures_path, dead_video_ids)

                manifest_rows.append({
                    "split": split, "label": matched_label,
                    "compact_label_id": compact_id,
                    "original_label_id": original_id,
                    "url": url, "start_time": start_time, "end_time": end_time,
                    "video_path": vid_path_str, "source_file": source_file,
                    "status": status,
                })

                if ok:
                    class_counters[matched_label]      += 1
                    successes[matched_label]           += 1
                    final_counts[split][matched_label] += 1
                    grand_downloaded += 1
                else:
                    failures[matched_label] += 1
                    grand_failed += 1

                # ── Periodic summary every 20 attempts ────────────────────
                if attempts % 20 == 0:
                    print_summary(split, attempts, successes, failures, dead_skip, max_per)

            # ── End of split: print final summary ────────────────────────────
            print_summary(split, attempts, successes, failures, dead_skip, max_per)
            grand_dead_skip += dead_skip  # already accumulated above per-iteration but guard

            # Report classes that could not reach the target
            if max_per is not None:
                for lbl in compact_map:
                    got = class_counters[lbl]
                    if got < max_per:
                        print(
                            f"  [WARNING] '{lbl}' reached only {got}/{max_per} clips in split '{split}'."
                            " Continuing with other classes."
                        )

    except KeyboardInterrupt:
        print("\n\n[Interrupted by user — saving progress …]")

    # ── Write manifest ────────────────────────────────────────────────────────
    fieldnames = [
        "split", "label", "compact_label_id", "original_label_id",
        "url", "start_time", "end_time", "video_path", "source_file", "status",
    ]
    with open(manifest_path, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(manifest_rows)

    save_failures(failures_path, dead_video_ids)

    print(f"\n✓ Manifest written : {manifest_path}  ({len(manifest_rows)} rows)")
    print(f"✓ Failures saved   : {failures_path}  ({len(dead_video_ids)} dead IDs)")

    # ── Final summary ──────────────────────────────────────────────────────────
    print("\n── Download Summary ──────────────────────────────────────")
    for split in splits:
        if final_counts[split]:
            print(f"  {split}:")
            for label, n in sorted(final_counts[split].items()):
                cap = f"/{max_per}" if max_per else ""
                print(f"    {label:<14} {n}{cap} clips")
    print(f"\n  Downloaded      : {grand_downloaded}")
    print(f"  Already existed : {grand_skipped}")
    print(f"  Failed          : {grand_failed}")
    print(f"  Dead-ID skipped : {grand_dead_skip}")
    print("──────────────────────────────────────────────────────────")


if __name__ == "__main__":
    main()
