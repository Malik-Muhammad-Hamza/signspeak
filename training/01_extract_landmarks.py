"""
SignSpeak v2 - Step 1: Extract Two-Hand Landmarks
=================================================
Reads the manifest, runs MediaPipe Hands on each video, and saves normalized
two-hand frame vectors as .npy files.

Output per clip:
  landmarks_dir/CLASS_NAME/<stem>.npy    shape (T, 126)
  landmarks_dir/CLASS_NAME/<stem>.label  compact integer label_id

Each frame is ordered as:
  [left_hand_63, right_hand_63]

Missing hands are filled with 63 zeros. Old one-hand landmark files are not
reused; they are re-extracted into the two-hand format.

Run:
  cd C:\\Web-Dev\\Project\\signspeak
  .\\training\\.venv\\Scripts\\python.exe training\\01_extract_landmarks.py
"""

import csv
import sys
from pathlib import Path

sys.stdout.reconfigure(encoding="utf-8")

import cv2
import mediapipe as mp
import numpy as np
import yaml
from tqdm import tqdm

from utils.normalizer import TWO_HAND_FEATURE_SIZE, normalize_two_hand_frame


def load_config(path: str = "config.yaml") -> dict:
    resolved = Path(__file__).parent / path
    with open(resolved) as f:
        return yaml.safe_load(f)


def quality_check(lm_array: np.ndarray, min_valid_ratio: float) -> tuple[bool, str]:
    """
    Validate a full (T, 126) landmark vector array before saving.

    Returns (ok, reason_if_failed).
    """
    if lm_array.ndim != 2 or lm_array.shape[1] != TWO_HAND_FEATURE_SIZE:
        return False, f"bad_shape:{lm_array.shape}"

    if not np.all(np.isfinite(lm_array)):
        return False, "contains_nan_or_inf"

    frame_maxabs = np.abs(lm_array).max(axis=1)
    valid_ratio = (frame_maxabs > 0).mean()

    if valid_ratio < min_valid_ratio:
        return False, f"low_valid_ratio:{valid_ratio:.2f}<{min_valid_ratio}"

    return True, ""


def _coords_from_landmarks(landmarks) -> np.ndarray:
    return np.array([[lm.x, lm.y, lm.z] for lm in landmarks.landmark], dtype=np.float32)


def _handedness_label(handedness_item) -> str | None:
    classifications = getattr(handedness_item, "classification", None)
    if not classifications:
        return None
    return getattr(classifications[0], "label", None)


def _sort_by_x(hands: list[np.ndarray]) -> list[np.ndarray]:
    return sorted(hands, key=lambda hand: float(hand[0, 0]))


def assign_hands(results) -> tuple[np.ndarray | None, np.ndarray | None]:
    """
    Return (left_hand, right_hand) raw coordinate arrays.

    Prefer MediaPipe handedness labels. If labels are missing, duplicated, or
    incomplete, fill remaining slots by x-coordinate order.
    """
    hand_landmarks = list(results.multi_hand_landmarks or [])[:2]
    if not hand_landmarks:
        return None, None

    hands = [_coords_from_landmarks(lm) for lm in hand_landmarks]
    handedness = list(results.multi_handedness or [])[:len(hands)]

    left = None
    right = None
    used_indices: set[int] = set()

    for idx, handedness_item in enumerate(handedness):
        label = _handedness_label(handedness_item)
        if label == "Left" and left is None:
            left = hands[idx]
            used_indices.add(idx)
        elif label == "Right" and right is None:
            right = hands[idx]
            used_indices.add(idx)

    remaining = [hand for idx, hand in enumerate(hands) if idx not in used_indices]
    for hand in _sort_by_x(remaining):
        if left is None:
            left = hand
        elif right is None:
            right = hand

    return left, right


def make_two_hand_frame(left: np.ndarray | None, right: np.ndarray | None) -> np.ndarray:
    raw = np.zeros((2, 21, 3), dtype=np.float32)
    if left is not None:
        raw[0] = left
    if right is not None:
        raw[1] = right

    normalized = normalize_two_hand_frame(raw)
    if normalized is None:
        return np.zeros(TWO_HAND_FEATURE_SIZE, dtype=np.float32)
    return normalized


def existing_two_hand_file_ok(path: Path) -> bool:
    try:
        arr = np.load(path)
    except Exception:
        return False
    return arr.ndim == 2 and arr.shape[1] == TWO_HAND_FEATURE_SIZE and np.all(np.isfinite(arr))


def extract_clip(video_path: Path, hands_detector) -> np.ndarray | None:
    """
    Extract normalized two-hand frame vectors from a single video.

    Returns (T, 126), or None if file is unreadable.
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
        left, right = assign_hands(results)
        frames.append(make_two_hand_frame(left, right))

    cap.release()
    return np.stack(frames).astype(np.float32, copy=False) if frames else None


def main():
    cfg = load_config()
    min_frames = cfg["preprocessing"]["min_clip_frames"]
    min_valid_ratio = cfg["preprocessing"].get("min_valid_frame_ratio", 0.40)
    feature_size = int(cfg["preprocessing"].get("feature_size", TWO_HAND_FEATURE_SIZE))
    hf = cfg.get("hf_dataset", {})
    use_hf = hf.get("enabled", False)

    if feature_size != TWO_HAND_FEATURE_SIZE:
        print(f"ERROR: two-hand extraction requires feature_size={TWO_HAND_FEATURE_SIZE}, got {feature_size}")
        sys.exit(1)

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
    print(f"feature_size      : {feature_size}")
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
    hands = mp_hands.Hands(
        static_image_mode=False,
        max_num_hands=2,
        model_complexity=1,
        min_detection_confidence=0.5,
        min_tracking_confidence=0.5,
    )

    saved = 0
    skipped = 0
    reextracted = 0
    skip_reasons: dict[str, int] = {}
    per_class_saved: dict[str, int] = {}
    per_class_skipped: dict[str, int] = {}

    def skip(reason: str, cls: str = ""):
        nonlocal skipped
        skipped += 1
        skip_reasons[reason] = skip_reasons.get(reason, 0) + 1
        if cls:
            per_class_skipped[cls] = per_class_skipped.get(cls, 0) + 1

    def mark_saved(cls: str = ""):
        nonlocal saved
        saved += 1
        if cls:
            per_class_saved[cls] = per_class_saved.get(cls, 0) + 1

    for row in tqdm(eligible, desc="Extracting"):
        if use_hf:
            class_name = row["class_name"].strip()
            label_id = int(row["label_id"])
            video_path = Path(row["local_video_path"].strip())

            if not video_path.exists():
                skip("video_file_missing", class_name)
                continue

            clip_stem = video_path.stem
            out_dir = landmarks_dir / class_name
            out_dir.mkdir(parents=True, exist_ok=True)
            out_path = out_dir / f"{clip_stem}.npy"

            if out_path.exists() and existing_two_hand_file_ok(out_path):
                skip("already_extracted", class_name)
                continue
            if out_path.exists():
                reextracted += 1

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
            mark_saved(class_name)

        else:
            split = row["split"]
            label = row["label"]
            compact_id = int(row["compact_label_id"])
            video_path = Path(row["video_path"])

            if not video_path.exists():
                skip("video_file_missing")
                continue

            clip_stem = video_path.stem
            out_dir = landmarks_dir / split / label
            out_dir.mkdir(parents=True, exist_ok=True)
            out_path = out_dir / f"{clip_stem}.npy"

            if out_path.exists() and existing_two_hand_file_ok(out_path):
                skip("already_extracted")
                continue
            if out_path.exists():
                reextracted += 1

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
            mark_saved()

    hands.close()

    print(f"\n✓ Extraction complete.  Saved: {saved},  Skipped: {skipped},  Re-extracted old-shape: {reextracted}")

    if use_hf and (per_class_saved or per_class_skipped):
        all_classes = sorted(set(list(per_class_saved.keys()) + list(per_class_skipped.keys())))
        print("\n  Per-class extraction quality:")
        print(f"  {'Class':<22} {'Saved':>6}  {'Skipped':>8}")
        print(f"  {'-'*22} {'-'*6}  {'-'*8}")
        for cls in all_classes:
            s = per_class_saved.get(cls, 0)
            k = per_class_skipped.get(cls, 0)
            flag = "  LOW" if s < 10 else ""
            print(f"  {cls:<22} {s:>6}  {k:>8}{flag}")

    if skip_reasons:
        print("\n  Skip reasons:")
        for reason, n in sorted(skip_reasons.items(), key=lambda x: -x[1]):
            print(f"    {reason}: {n}")


if __name__ == "__main__":
    main()
