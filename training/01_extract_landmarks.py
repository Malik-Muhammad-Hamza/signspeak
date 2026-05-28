"""
SignSpeak v2 — Step 1: Extract Landmarks
=========================================
Reads the HF-ASL manifest, runs MediaPipe Hands on each video,
and saves per-frame landmark arrays as .npy files.

Quality filters applied:
  - min_clip_frames: clip must have >= N raw frames
  - min_valid_frame_ratio: >= fraction of frames must have a detected hand
  - NaN/Inf check on extracted landmarks
  - Shape validation: each frame must be (21, 3)

Output per clip:
  landmarks_dir/CLASS_NAME/<stem>.npy    shape (T, 21, 3)
  landmarks_dir/CLASS_NAME/<stem>.label  compact integer label_id

Run:
  cd C:\\Web-Dev\\Project\\signspeak
  .\\training\\.venv\\Scripts\\python.exe training\\01_extract_landmarks.py
"""

import csv
import sys
sys.stdout.reconfigure(encoding="utf-8")
from pathlib import Path

import cv2
import mediapipe as mp
import numpy as np
import yaml
from tqdm import tqdm


def load_config(path: str = "config.yaml") -> dict:
    resolved = Path(__file__).parent / path
    with open(resolved) as f:
        return yaml.safe_load(f)


def quality_check(
    lm_array: np.ndarray,
    min_valid_ratio: float,
) -> tuple[bool, str]:
    """
    Validate a full (T, 21, 3) landmark array before saving.

    Returns (ok, reason_if_failed).
    """
    if lm_array.ndim != 3 or lm_array.shape[1:] != (21, 3):
        return False, f"bad_shape:{lm_array.shape}"

    if not np.all(np.isfinite(lm_array)):
        return False, "contains_nan_or_inf"

    # A frame is "valid" if at least one coordinate is non-zero
    # (zero frames = no hand detected → padded by extract_clip)
    frame_maxabs = np.abs(lm_array).reshape(len(lm_array), -1).max(axis=1)
    valid_ratio  = (frame_maxabs > 0).mean()

    if valid_ratio < min_valid_ratio:
        return False, f"low_valid_ratio:{valid_ratio:.2f}<{min_valid_ratio}"

    return True, ""


def extract_clip(video_path: Path, hands_detector) -> np.ndarray | None:
    """
    Extract per-frame landmarks from a single video clip.
    Returns (T, 21, 3) or None if file unreadable.
    Frames with no hand detected are zero-padded.
    """
    cap = cv2.VideoCapture(str(video_path))
    if not cap.isOpened():
        return None

    frames = []
    while True:
        ok, frame = cap.read()
        if not ok:
            break
        rgb     = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        results = hands_detector.process(rgb)
        if results.multi_hand_landmarks:
            lm     = results.multi_hand_landmarks[0].landmark
            coords = np.array([[l.x, l.y, l.z] for l in lm], dtype=np.float32)
            frames.append(coords)
        else:
            frames.append(np.zeros((21, 3), dtype=np.float32))

    cap.release()
    return np.stack(frames) if frames else None


def main():
    cfg             = load_config()
    min_frames      = cfg["preprocessing"]["min_clip_frames"]
    min_valid_ratio = cfg["preprocessing"].get("min_valid_frame_ratio", 0.40)
    hf              = cfg.get("hf_dataset", {})
    use_hf          = hf.get("enabled", False)

    if use_hf:
        manifest_path = Path(hf.get("manifest_path", Path(hf["root_dir"]) / "hf_manifest.csv"))
        landmarks_dir = Path(hf["landmarks_dir"])
        print("Mode              : HF-ASL")
    else:
        processed_dir = Path(cfg["data"]["processed_dir"])
        manifest_path = processed_dir / "clips_manifest.csv"
        landmarks_dir = Path(cfg["data"]["landmarks_dir"])
        print("Mode              : MS-ASL")

    print(f"Manifest          : {manifest_path}")
    print(f"Landmarks dir     : {landmarks_dir}")
    print(f"min_clip_frames   : {min_frames}")
    print(f"min_valid_ratio   : {min_valid_ratio}")
    print()

    if not manifest_path.exists():
        print(f"ERROR: Manifest not found: {manifest_path}")
        print("Run 00_download_hf_clips.py first.")
        sys.exit(1)

    with open(manifest_path, newline="", encoding="utf-8") as f:
        rows = list(csv.DictReader(f))

    if use_hf:
        has_status = "status" in (rows[0].keys() if rows else {})
        if has_status:
            eligible = [
                r for r in rows
                if r.get("status", "") in ("downloaded", "existing", "exists")
                and r.get("local_video_path", "").strip()
            ]
        else:
            eligible = [r for r in rows if r.get("local_video_path", "").strip()]
    else:
        eligible = [r for r in rows if r["status"] in ("downloaded", "existing")]

    print(f"Manifest rows     : {len(rows)} total,  {len(eligible)} eligible")
    print()

    mp_hands = mp.solutions.hands
    hands    = mp_hands.Hands(
        static_image_mode=False,
        max_num_hands=1,
        model_complexity=1,
        min_detection_confidence=0.5,
        min_tracking_confidence=0.5,
    )

    saved    = 0
    skipped  = 0
    skip_reasons: dict[str, int] = {}
    per_class_saved:   dict[str, int] = {}
    per_class_skipped: dict[str, int] = {}

    def skip(reason: str, cls: str = ""):
        nonlocal skipped
        skipped += 1
        skip_reasons[reason] = skip_reasons.get(reason, 0) + 1
        if cls:
            per_class_skipped[cls] = per_class_skipped.get(cls, 0) + 1

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
                skipped += 1
                skip_reasons["already_extracted"] = skip_reasons.get("already_extracted", 0) + 1
                per_class_skipped[class_name] = per_class_skipped.get(class_name, 0) + 1
                continue

            lm_array = extract_clip(video_path, hands)

            if lm_array is None:
                skip("unreadable_video", class_name)
                continue

            if len(lm_array) < min_frames:
                skip(f"too_short(<{min_frames}frames)", class_name)
                continue

            ok, reason = quality_check(lm_array, min_valid_ratio)
            if not ok:
                skip(reason, class_name)
                continue

            np.save(out_path, lm_array)
            (out_dir / f"{clip_stem}.label").write_text(str(label_id))
            saved += 1
            per_class_saved[class_name] = per_class_saved.get(class_name, 0) + 1

        else:
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
                skip(f"too_short(<{min_frames}frames)")
                continue

            ok, reason = quality_check(lm_array, min_valid_ratio)
            if not ok:
                skip(reason)
                continue

            np.save(out_path, lm_array)
            (out_dir / f"{clip_stem}.label").write_text(str(compact_id))
            saved += 1

    hands.close()

    print(f"\n✓ Extraction complete.  Saved: {saved},  Skipped: {skipped}")

    if use_hf and (per_class_saved or per_class_skipped):
        all_classes = sorted(set(list(per_class_saved.keys()) + list(per_class_skipped.keys())))
        print("\n  Per-class extraction quality:")
        print(f"  {'Class':<22} {'Saved':>6}  {'Skipped':>8}")
        print(f"  {'-'*22} {'-'*6}  {'-'*8}")
        for cls in all_classes:
            s = per_class_saved.get(cls, 0)
            k = per_class_skipped.get(cls, 0)
            flag = "  ⚠ LOW" if s < 10 else ""
            print(f"  {cls:<22} {s:>6}  {k:>8}{flag}")

    if skip_reasons:
        print("\n  Skip reasons:")
        for reason, n in sorted(skip_reasons.items(), key=lambda x: -x[1]):
            print(f"    {reason}: {n}")


if __name__ == "__main__":
    main()
