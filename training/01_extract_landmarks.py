"""
SignSpeak v2 — Step 1: Extract Landmarks
=========================================
Reads processed/clips_manifest.csv (written by 00_download_clips.py),
processes only rows with status 'downloaded' or 'existing', runs MediaPipe
Hands on each video file, and saves per-frame landmark arrays to .npy files.

Output (per clip):
  landmarks/{split}/{label}/{clip_stem}.npy
  shape: (num_frames, 21, 3)  — raw MediaPipe landmark values

Run:
  cd C:\\Web-Dev\\Project\\signspeak\\training
  python 01_extract_landmarks.py
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
    cfg = load_config()

    processed_dir  = Path(cfg["data"]["processed_dir"])
    landmarks_dir  = Path(cfg["data"]["landmarks_dir"])
    min_frames     = cfg["preprocessing"]["min_clip_frames"]
    manifest_path  = processed_dir / "clips_manifest.csv"

    if not manifest_path.exists():
        print(
            f"ERROR: Manifest not found: {manifest_path}\n"
            "Run 00_download_clips.py first to download clips and generate the manifest."
        )
        sys.exit(1)

    # Load manifest rows eligible for extraction
    with open(manifest_path, newline="", encoding="utf-8") as f:
        rows = list(csv.DictReader(f))

    eligible = [r for r in rows if r["status"] in ("downloaded", "existing")]
    print(f"Manifest: {len(rows)} rows total, {len(eligible)} eligible for extraction.")

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

    def skip(reason: str):
        nonlocal skipped
        skipped += 1
        skip_reasons[reason] = skip_reasons.get(reason, 0) + 1

    for row in tqdm(eligible, desc="Extracting"):
        split           = row["split"]
        label           = row["label"]
        compact_id      = int(row["compact_label_id"])
        video_path      = Path(row["video_path"])

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

        # Save landmarks alongside a sidecar .label file so 02_build_dataset.py
        # can reconstruct compact_label_id without scanning directory names.
        np.save(out_path, lm_array)
        label_sidecar = out_dir / f"{clip_stem}.label"
        label_sidecar.write_text(str(compact_id))
        saved += 1

    hands.close()

    print(f"\n✓ Extraction complete.  Saved: {saved},  Skipped: {skipped}")
    if skip_reasons:
        print("  Skip breakdown:")
        for reason, n in sorted(skip_reasons.items(), key=lambda x: -x[1]):
            print(f"    {reason}: {n}")


if __name__ == "__main__":
    main()
