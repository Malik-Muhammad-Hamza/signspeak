"""
SignSpeak v2 - Step 0b: Download HF-ASL Clips
==============================================

Downloads selected ASL video clips from:
  akasheroor/American-Sign-Language-Dataset

The matcher is intentionally strict. A repo file is selected only when the
label extracted from its filename exactly equals a configured class alias.
Prefix matching is not allowed because it pollutes classes:
  HOME != HOMEWORK, THANK YOU != THANKSGIVING, STOP != STOPWATCH, I != ISRAEL.

Run:
  cd C:\\Web-Dev\\Project\\signspeak
  .\\training\\.venv\\Scripts\\python.exe training\\00_download_hf_clips.py --dry-run
  .\\training\\.venv\\Scripts\\python.exe training\\00_download_hf_clips.py
"""

from __future__ import annotations

import argparse
import csv
import re
import shutil
import sys
from pathlib import Path

import yaml

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

VIDEO_EXTS = {".mp4", ".webm", ".mkv"}
GENERATED_SUFFIX_RE = re.compile(
    r"(?i)(?:[_-]video[_-]?\d+|[_-]\d+)$"
)


def load_config(path: str = "config.yaml") -> dict:
    resolved = Path(__file__).parent / path
    with open(resolved, encoding="utf-8") as f:
        return yaml.safe_load(f)


def normalize_label(text: str) -> str:
    """Normalize a human label for exact alias comparison."""
    normalized = text.upper().strip().replace("_", " ")
    normalized = re.sub(r"\s+", " ", normalized)
    return normalized


def compact_label(text: str) -> str:
    """Normalize and remove spaces for approved aliases like THANK YOU."""
    return normalize_label(text).replace(" ", "")


def _strip_generated_suffixes(stem: str) -> str:
    """Remove generated suffixes such as _1, _video_0, -1, -video-0."""
    current = stem
    while True:
        updated = GENERATED_SUFFIX_RE.sub("", current)
        if updated == current:
            return updated
        current = updated


def extract_label_from_repo_path(repo_path: str) -> str:
    """
    Extract the raw source label from a repo path using only the filename stem.

    Examples:
      123456-HOME.mp4       -> HOME
      123456-THANK YOU.mp4  -> THANK YOU
      please_video_0.mp4    -> PLEASE
      water_13.mp4          -> WATER
    """
    stem = Path(repo_path).stem

    if "-" in stem:
        before, after = stem.rsplit("-", 1)
        suffix_is_generated = re.fullmatch(r"(?i)(?:video[_-]?)?\d+", after) is not None
        if re.search(r"\d", before) and not suffix_is_generated:
            return normalize_label(after)

    return normalize_label(_strip_generated_suffixes(stem))


def _alias_compare_keys(label: str) -> set[str]:
    normalized = normalize_label(label)
    return {normalized, compact_label(normalized)}


def build_alias_lookup(
    class_aliases: dict | None,
    selected_classes: list[str],
) -> tuple[dict[str, dict[str, str]], dict[str, list[str]]]:
    """
    Build an exact-match alias lookup.

    If a selected class has no class_aliases entry, the class itself is the
    only approved alias. No prefix or startswith matching is used.
    """
    config_by_class = {
        normalize_label(k): [normalize_label(v) for v in values]
        for k, values in (class_aliases or {}).items()
    }

    lookup: dict[str, dict[str, str]] = {}
    aliases_by_class: dict[str, list[str]] = {}

    for raw_class in selected_classes:
        class_name = normalize_label(raw_class)
        aliases = config_by_class.get(class_name, [class_name])
        aliases_by_class[class_name] = aliases

        for alias in aliases:
            for key in _alias_compare_keys(alias):
                existing = lookup.get(key)
                if existing and existing["class_name"] != class_name:
                    raise ValueError(
                        f"Alias collision for {alias!r}: "
                        f"{existing['class_name']} and {class_name}"
                    )
                lookup[key] = {"class_name": class_name, "matched_alias": alias}

    return lookup, aliases_by_class


def match_repo_path(
    repo_path: str,
    alias_lookup: dict[str, dict[str, str]],
) -> tuple[str, dict[str, str] | None]:
    extracted_label = extract_label_from_repo_path(repo_path)
    for key in _alias_compare_keys(extracted_label):
        match = alias_lookup.get(key)
        if match:
            return extracted_label, match
    return extracted_label, None


def _near_prefix_keys(alias: str) -> set[str]:
    normalized = normalize_label(alias)
    keys = {compact_label(normalized)}
    first_word = normalized.split(" ", 1)[0]
    if first_word:
        keys.add(compact_label(first_word))
    return {key for key in keys if key}


def collect_rejected_near_prefix(
    extracted_label: str,
    aliases_by_class: dict[str, list[str]],
) -> list[str]:
    """Return classes whose aliases are a near-prefix of a rejected label."""
    label_key = compact_label(extracted_label)
    rejected_for: list[str] = []
    for class_name, aliases in aliases_by_class.items():
        for alias in aliases:
            for prefix_key in _near_prefix_keys(alias):
                if label_key != prefix_key and label_key.startswith(prefix_key):
                    rejected_for.append(class_name)
                    break
            if class_name in rejected_for:
                break
    return rejected_for


def download_one(repo_id, repo_type, repo_path, local_path, dry_run) -> bool:
    if dry_run:
        return True

    from huggingface_hub import hf_hub_download

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


def _sample_names(paths: list[str], limit: int = 5) -> str:
    names = [Path(p).name for p in paths[:limit]]
    return ", ".join(names) if names else "-"


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Download selected HF-ASL clips with strict label matching."
    )
    parser.add_argument("--config", default="config.yaml")
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    cfg = load_config(args.config)
    hf = cfg.get("hf_dataset", {})

    if not hf.get("enabled", False):
        print("hf_dataset.enabled is false - nothing to do.")
        return

    from huggingface_hub import list_repo_files

    try:
        from tqdm import tqdm
    except ImportError:
        tqdm = lambda iterable, **_: iterable

    repo_id = hf["repo_id"]
    repo_type = hf.get("repo_type", "dataset")
    root_dir = Path(hf["root_dir"])
    videos_dir = Path(hf["selected_videos_dir"])
    manifest_out = Path(hf.get("manifest_path", root_dir / "hf_manifest.csv"))
    selected_display = [normalize_label(c) for c in hf.get("selected_classes", [])]

    raw_max = hf.get("max_per_class", None)
    max_per_class: int | None = None if (raw_max is None or raw_max == 0) else int(raw_max)
    balance_strategy = hf.get("balance_strategy", "cap")
    class_aliases = hf.get("class_aliases", {})
    alias_lookup, aliases_by_class = build_alias_lookup(class_aliases, selected_display)

    if not selected_display:
        print("ERROR: hf_dataset.selected_classes is empty.")
        sys.exit(1)

    print("=" * 72)
    print("SignSpeak v2 - HF-ASL Downloader")
    print("=" * 72)
    print(f"  Repo          : {repo_id}")
    print(f"  Classes       : {selected_display}")
    print(f"  Max/class     : {'ALL' if max_per_class is None else max_per_class}")
    print(f"  Strategy      : {balance_strategy}")
    print("  Matching      : exact extracted label or approved alias only")
    print(f"  Dry-run       : {args.dry_run}")
    print()

    print("[1/3] Listing all files in HF repo ...")
    all_files = list(list_repo_files(repo_id, repo_type=repo_type))
    video_files = [f for f in all_files if Path(f).suffix.lower() in VIDEO_EXTS]
    print(f"  Total repo files : {len(all_files)}")
    print(f"  Video files      : {len(video_files)}")
    print()

    class_matches: dict[str, list[dict[str, str]]] = {c: [] for c in selected_display}
    alias_matched_counts: dict[str, int] = {c: 0 for c in selected_display}
    rejected_near_prefix: dict[str, dict[str, dict[str, object]]] = {
        c: {} for c in selected_display
    }

    for repo_path in video_files:
        extracted_label, match = match_repo_path(repo_path, alias_lookup)
        if match:
            class_name = match["class_name"]
            matched_alias = match["matched_alias"]
            class_matches[class_name].append(
                {
                    "repo_path": repo_path,
                    "extracted_source_label": extracted_label,
                    "matched_alias": matched_alias,
                }
            )
            if compact_label(matched_alias) != compact_label(class_name):
                alias_matched_counts[class_name] += 1
            continue

        for class_name in collect_rejected_near_prefix(extracted_label, aliases_by_class):
            bucket = rejected_near_prefix[class_name].setdefault(
                extracted_label,
                {"count": 0, "examples": []},
            )
            bucket["count"] = int(bucket["count"]) + 1
            examples = bucket["examples"]
            if isinstance(examples, list) and len(examples) < 5:
                examples.append(Path(repo_path).name)

    print("[2/3] Matched repo files per class:")
    print(f"  {'Class':<12} {'Matched':>8} {'Via Alias':>10} {'Selected':>10}")
    print(f"  {'-'*12} {'-'*8} {'-'*10} {'-'*10}")
    for class_name in selected_display:
        matches = class_matches[class_name]
        n_total = len(matches)
        if max_per_class is None or balance_strategy != "cap":
            n_selected = n_total
        else:
            n_selected = min(n_total, max_per_class)
        print(
            f"  {class_name:<12} {n_total:>8} "
            f"{alias_matched_counts[class_name]:>10} {n_selected:>10}"
        )
        print(f"    aliases : {', '.join(aliases_by_class[class_name])}")
        print(f"    samples : {_sample_names([m['repo_path'] for m in matches])}")
        rejected = rejected_near_prefix[class_name]
        if rejected:
            print("    rejected near-prefix:")
            for label, details in sorted(
                rejected.items(),
                key=lambda item: (-int(item[1]["count"]), item[0]),
            )[:8]:
                examples = details["examples"]
                example_text = ", ".join(examples) if isinstance(examples, list) else "-"
                print(f"      {label}: {details['count']} ({example_text})")
    print()

    print("[3/3] Downloading ..." if not args.dry_run else "[3/3] Dry-run manifest build ...")
    print()

    manifest_rows: list[dict[str, str | int]] = []
    grand_downloaded = 0
    grand_dry_run_selected = 0
    grand_skipped = 0
    grand_failed = 0

    for label_id, class_name in enumerate(selected_display):
        matches = class_matches[class_name]
        selected_matches = (
            matches
            if max_per_class is None or balance_strategy != "cap"
            else matches[:max_per_class]
        )

        downloaded = 0
        dry_selected = 0
        skipped = 0
        failed = 0

        print(f"  -- {class_name} ({len(selected_matches)} selected) --")

        for match in tqdm(selected_matches, desc=f"  {class_name}", leave=False):
            repo_path = match["repo_path"]
            video_name = Path(repo_path).name
            local_path = videos_dir / class_name / video_name

            row = {
                "class_name": class_name,
                "label_id": label_id,
                "source_video_path": repo_path,
                "local_video_path": str(local_path),
                "extracted_source_label": match["extracted_source_label"],
                "matched_alias": match["matched_alias"],
                "status": "",
            }

            if local_path.exists() and local_path.stat().st_size > 0:
                skipped += 1
                row["status"] = "existing"
                manifest_rows.append(row)
                continue

            ok = download_one(repo_id, repo_type, repo_path, local_path, args.dry_run)
            if args.dry_run:
                row["status"] = "dry_run"
                dry_selected += 1
            else:
                row["status"] = "downloaded" if ok else "failed"
                if ok:
                    downloaded += 1
                else:
                    failed += 1
            manifest_rows.append(row)

        grand_downloaded += downloaded
        grand_dry_run_selected += dry_selected
        grand_skipped += skipped
        grand_failed += failed

        if args.dry_run:
            print(f"    {class_name:<12} dry_run={dry_selected} existing={skipped}")
        else:
            print(
                f"    {class_name:<12} downloaded={downloaded} "
                f"existing={skipped} failed={failed}"
            )

    manifest_out.parent.mkdir(parents=True, exist_ok=True)
    fieldnames = [
        "class_name",
        "label_id",
        "source_video_path",
        "local_video_path",
        "extracted_source_label",
        "matched_alias",
        "status",
    ]
    with open(manifest_out, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(manifest_rows)

    print()
    print("=" * 72)
    print(f"Manifest : {manifest_out} ({len(manifest_rows)} rows)")
    print(f"Downloaded: {grand_downloaded} | Existing: {grand_skipped} | Failed: {grand_failed}")
    if args.dry_run:
        print(f"Dry-run selected: {grand_dry_run_selected}")
    print("=" * 72)


if __name__ == "__main__":
    main()
