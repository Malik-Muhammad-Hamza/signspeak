"""
SignSpeak v2 — Step 1: Extract Landmarks
========================================
Reads MS-ASL JSON manifests, decodes each video clip with OpenCV,
runs MediaPipe Hands frame-by-frame, and saves the per-frame landmark
arrays to .npy files.

Output (per clip):
  data/landmarks/<split>/<label>/<clip_id>.npy
  shape: (num_frames, 21, 3)  — raw MediaPipe landmark values

Run:
  python 01_extract_landmarks.py
"""

import json
import os
import sys
from pathlib import Path

import cv2
import mediapipe as mp
import numpy as np
import yaml
from tqdm import tqdm


def load_config(path="config.yaml"):
    with open(path) as f:
        return yaml.safe_load(f)


def extract_clip(video_path: Path, hands_detector) -> np.ndarray | None:
    """
    Extract per-frame landmarks from a single video clip.
    Returns array of shape (T, 21, 3) or None if detection failed.
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
            # Pad with zeros so we preserve temporal alignment
            frames.append(np.zeros((21, 3), dtype=np.float32))

    cap.release()
    return np.stack(frames) if frames else None


def main():
    cfg = load_config()
    ms_asl_root = Path(cfg["data"]["ms_asl_root"])
    landmarks_dir = Path(cfg["data"]["landmarks_dir"])
    min_frames = cfg["preprocessing"]["min_clip_frames"]

    mp_hands = mp.solutions.hands
    hands = mp_hands.Hands(
        static_image_mode=False,
        max_num_hands=1,
        model_complexity=1,
        min_detection_confidence=0.5,
        min_tracking_confidence=0.5,
    )

    skipped = 0
    saved = 0

    for split in ("train", "val", "test"):
        manifest = ms_asl_root / f"MSASL_{split}.json"
        if not manifest.exists():
            print(f"[skip] {manifest} not found")
            continue

        with open(manifest) as f:
            entries = json.load(f)

        for entry in tqdm(entries, desc=split):
            label = str(entry["label"])
            clip_id = entry.get("org_text", entry.get("clean_text", "clip"))
            video_file = ms_asl_root / "videos" / entry.get("file", "")

            if not video_file.exists():
                skipped += 1
                continue

            out_dir = landmarks_dir / split / label
            out_dir.mkdir(parents=True, exist_ok=True)
            out_path = out_dir / f"{clip_id}.npy"

            if out_path.exists():
                continue  # already extracted

            lm_array = extract_clip(video_file, hands)
            if lm_array is None or len(lm_array) < min_frames:
                skipped += 1
                continue

            np.save(out_path, lm_array)
            saved += 1

    hands.close()
    print(f"\n✓ Extraction complete. Saved: {saved}, Skipped: {skipped}")


if __name__ == "__main__":
    main()
