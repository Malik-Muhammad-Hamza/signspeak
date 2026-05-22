"""
SignSpeak v2 — Step 1: Extract Landmarks
=========================================
Reads the active dataset manifest (selected by hf_dataset.enabled in config.yaml),
runs MediaPipe Hands on each video, and saves per-frame landmark arrays as .npy files.

HF-ASL mode  (hf_dataset.enabled: true):
  Reads  : C:/Web-Dev/Datasets/HF-ASL/hf_manifest.csv
  Saves  : C:/Web-Dev/Datasets/HF-ASL/landmarks/<CLASS_NAME>/<stem>.npy

MS-ASL mode  (hf_dataset.enabled: false):
  Reads  : C:/Web-Dev/Datasets/MS-ASL/processed/clips_manifest.csv
  Saves  : C:/Web-Dev/Datasets/MS-ASL/landmarks/<split>/<label>/<stem>.npy

IMPORTANT — always use the training venv interpreter:
  cd C:\\Web-Dev\\Project\\signspeak
  .\\training\\.venv\\Scripts\\python.exe training\\01_extract_landmarks.py

Do NOT use plain `python` — it resolves to the system Python which
does not have MediaPipe, OpenCV, or the project packages installed.
"""

import csv
import os
import sys
sys.stdout.reconfigure(encoding="utf-8")
from pathlib import Path

import cv2
import mediapipe as mp
import numpy as np
import yaml
from tqdm import tqdm


def load_config(path: str = "config.yaml") -> dict:
    # Resolve relative to the script's own directory so the script works
    # regardless of which working directory it is invoked from.
    resolved = Path(__file__).parent / path
    with open(resolved) as f:
        return yaml.safe_load(f)


def extract_clip(video_path: Path, hands_detector) -> np.ndarray | None:
    """
    Extract per-frame landmarks from a single video clip.
    Returns array of shape (T, 21, 3) or None if detection failed / file unreadable.
    """
    cap = cv2.VideoCapture(str(video_path))
    if not cap.isOpened():
        return None

    frames = []
    while True:
        ok, frame = cap.read()
        if not ok:
            break
        rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        results = hands_detector.process(rgb)
        if results.multi_hand_landmarks:
            lm = results.multi_hand_landmarks[0].landmark
            coords = np.array([[l.x, l.y, l.z] for l in lm], dtype=np.float32)
            frames.append(coords)
        else:
            # Pad with zeros to preserve temporal alignment
            frames.append(np.zeros((21, 3), dtype=np.float32))

    cap.release()
    return np.stack(frames) if frames else None


def main():
    cfg        = load_config()
    min_frames = cfg["preprocessing"]["min_clip_frames"]
    hf         = cfg.get("hf_dataset", {})
    use_hf     = hf.get("enabled", False)

    # ── Resolve manifest path & landmarks dir ─────────────────────────────────
    if use_hf:
        # HF manifest: use manifest_path if set, else root_dir/hf_manifest.csv
        if "manifest_path" in hf:
            manifest_path = Path(hf["manifest_path"])
        else:
            manifest_path = Path(hf["root_dir"]) / "hf_manifest.csv"
        landmarks_dir = Path(hf["landmarks_dir"])
        print("Mode           : Hugging Face ASL dataset")
    else:
        processed_dir = Path(cfg["data"]["processed_dir"])
        manifest_path = processed_dir / "clips_manifest.csv"
        landmarks_dir = Path(cfg["data"]["landmarks_dir"])
        print("Mode           : MS-ASL dataset")

    print(f"Manifest       : {manifest_path}")
    print(f"Landmarks dir  : {landmarks_dir}")
    print()

    if not manifest_path.exists():
        if use_hf:
            print(
                f"ERROR: HF manifest not found: {manifest_path}\n"
                "Run 00_download_hf_clips.py first to download clips."
            )
        else:
            print(
                f"ERROR: Manifest not found: {manifest_path}\n"
                "Run 00_download_clips.py first to download clips and generate the manifest."
            )
        sys.exit(1)

    # ── Load & filter manifest rows ───────────────────────────────────────────
    with open(manifest_path, newline="", encoding="utf-8") as f:
        rows = list(csv.DictReader(f))

    if use_hf:
        # HF manifest columns: class_name, label_id, source_video_path,
        #                      local_video_path, status
        has_status = "status" in (rows[0].keys() if rows else {})
        if has_status:
            eligible = [
                r for r in rows
                if r.get("status", "") in ("downloaded", "existing", "exists")
                and r.get("local_video_path", "").strip()
            ]
        else:
            # Fallback: all rows with a non-empty local_video_path
            eligible = [r for r in rows if r.get("local_video_path", "").strip()]
    else:
        eligible = [r for r in rows if r["status"] in ("downloaded", "existing")]

    print(f"Manifest rows  : {len(rows)} total,  {len(eligible)} eligible for extraction.")
    print()

    # ── MediaPipe setup ───────────────────────────────────────────────────────
    mp_hands = mp.solutions.hands
    hands = mp_hands.Hands(
        static_image_mode=False,
        max_num_hands=1,
        model_complexity=1,
        min_detection_confidence=0.5,
        min_tracking_confidence=0.5,
    )

    saved   = 0
    skipped = 0
    skip_reasons: dict[str, int] = {}
    per_class_saved:   dict[str, int] = {}
    per_class_skipped: dict[str, int] = {}

    def skip(reason: str, cls: str = ""):
        nonlocal skipped
        skipped += 1
        skip_reasons[reason] = skip_reasons.get(reason, 0) + 1
        if cls:
            per_class_skipped[cls] = per_class_skipped.get(cls, 0) + 1

    # ── Extraction loop ───────────────────────────────────────────────────────
    for row in tqdm(eligible, desc="Extracting"):
        if use_hf:
            class_name = row["class_name"].strip()
            label_id   = int(row["label_id"])
            video_path = Path(row["local_video_path"].strip())

            if not video_path.exists():
                skip("video_file_missing", class_name)
                continue

            clip_stem = video_path.stem
            out_dir   = landmarks_dir / class_name
            out_dir.mkdir(parents=True, exist_ok=True)
            out_path  = out_dir / f"{clip_stem}.npy"

            if out_path.exists():
                skip("already_extracted", class_name)
                per_class_skipped[class_name] = per_class_skipped.get(class_name, 0) + 1
                continue

            lm_array = extract_clip(video_path, hands)

            if lm_array is None:
                skip("unreadable_video", class_name)
                continue

            if len(lm_array) < min_frames:
                skip(f"too_short (<{min_frames} frames)", class_name)
                continue

            np.save(out_path, lm_array)
            # Sidecar .label stores the compact integer id for 02_build_dataset.py
            (out_dir / f"{clip_stem}.label").write_text(str(label_id))
            saved += 1
            per_class_saved[class_name] = per_class_saved.get(class_name, 0) + 1

        else:
            # ── MS-ASL path (unchanged behaviour) ────────────────────────────
            split      = row["split"]
            label      = row["label"]
            compact_id = int(row["compact_label_id"])
            video_path = Path(row["video_path"])

            if not video_path.exists():
                skip("video_file_missing")
                continue

            clip_stem = video_path.stem
            out_dir   = landmarks_dir / split / label
            out_dir.mkdir(parents=True, exist_ok=True)
            out_path  = out_dir / f"{clip_stem}.npy"

            if out_path.exists():
                skip("already_extracted")
                continue

            lm_array = extract_clip(video_path, hands)

            if lm_array is None:
                skip("unreadable_video")
                continue

            if len(lm_array) < min_frames:
                skip(f"too_short (<{min_frames} frames)")
                continue

            np.save(out_path, lm_array)
            (out_dir / f"{clip_stem}.label").write_text(str(compact_id))
            saved += 1

    hands.close()

    print(f"\n✓ Extraction complete.  Saved: {saved},  Skipped: {skipped}")

    if use_hf and (per_class_saved or per_class_skipped):
        all_classes = sorted(set(per_class_saved) | set(per_class_skipped))
        print("  Per-class breakdown:")
        for cls in all_classes:
            s = per_class_saved.get(cls, 0)
            k = per_class_skipped.get(cls, 0)
            print(f"    {cls:<20} saved={s}  skipped={k}")

    if skip_reasons:
        print("  Skip reasons:")
        for reason, n in sorted(skip_reasons.items(), key=lambda x: -x[1]):
            print(f"    {reason}: {n}")


if __name__ == "__main__":
    main()

