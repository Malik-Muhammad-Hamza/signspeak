"""
SignSpeak v2 - Training Utility: Normalizer
===========================================
Python implementation of the landmark normalization algorithm.

MUST stay equivalent to:
  src/v2/utils/landmarkNormalizer.js

Two-hand algorithm
------------------
1. Keep frame order as [left hand, right hand].
2. Normalize each visible 21-landmark hand independently:
   wrist-relative -> flatten -> max-abs scale.
3. Missing hands remain 63 zeros.
4. Reject NaN/Inf values.
"""

import numpy as np


NUM_LANDMARKS = 21
COORDS_PER_LANDMARK = 3
HAND_FEATURE_SIZE = NUM_LANDMARKS * COORDS_PER_LANDMARK
TWO_HAND_FEATURE_SIZE = HAND_FEATURE_SIZE * 2


def _is_missing_hand(frame: np.ndarray) -> bool:
    return bool(np.abs(frame).max() < 1e-6)


def normalize_frame(frame: np.ndarray) -> np.ndarray | None:
    """
    Normalize one visible hand.

    Parameters
    ----------
    frame : np.ndarray shape (21, 3)

    Returns
    -------
    np.ndarray shape (63,) float32, or None for missing/degenerate/invalid hands.
    """
    if frame.shape != (NUM_LANDMARKS, COORDS_PER_LANDMARK):
        raise ValueError(f"Expected (21, 3), got {frame.shape}")

    if not np.all(np.isfinite(frame)):
        return None

    if _is_missing_hand(frame):
        return None

    wrist = frame[0]
    shifted = frame - wrist
    flat = shifted.flatten().astype(np.float32)

    max_abs = np.abs(flat).max()
    if max_abs < 1e-6:
        return None

    normed = flat / max_abs
    if not np.all(np.isfinite(normed)):
        return None

    return normed.astype(np.float32, copy=False)


def normalize_two_hand_frame(frame: np.ndarray) -> np.ndarray | None:
    """
    Normalize a two-hand frame into [left_hand_63, right_hand_63].

    Accepts either raw paired landmarks with shape (2, 21, 3), or an already
    normalized/flattened frame with shape (126,). Missing hands remain zeros.
    Returns None only when the whole frame is invalid or both hands are missing.
    """
    if frame.shape == (TWO_HAND_FEATURE_SIZE,):
        out = frame.astype(np.float32, copy=False)
        if not np.all(np.isfinite(out)):
            return None
        return out if np.abs(out).max() >= 1e-6 else None

    if frame.shape != (2, NUM_LANDMARKS, COORDS_PER_LANDMARK):
        raise ValueError(f"Expected (2, 21, 3) or (126,), got {frame.shape}")

    if not np.all(np.isfinite(frame)):
        return None

    out = np.zeros(TWO_HAND_FEATURE_SIZE, dtype=np.float32)
    any_valid = False

    for hand_idx in range(2):
        normed = normalize_frame(frame[hand_idx])
        if normed is None:
            continue
        start = hand_idx * HAND_FEATURE_SIZE
        out[start:start + HAND_FEATURE_SIZE] = normed
        any_valid = True

    return out if any_valid else None


def normalize_sequence(frames: np.ndarray) -> np.ndarray | None:
    """
    Strict normalization.

    Supports:
      - (T, 21, 3) legacy one-hand raw input -> (T, 63)
      - (T, 2, 21, 3) two-hand raw input -> (T, 126)
      - (T, 126) already-normalized two-hand vectors -> (T, 126)

    Returns None if any frame is degenerate or invalid.
    """
    result = []

    if frames.ndim == 2 and frames.shape[1] == TWO_HAND_FEATURE_SIZE:
        if not np.all(np.isfinite(frames)):
            return None
        return frames.astype(np.float32, copy=False)

    for frame in frames:
        if frames.ndim == 3 and frames.shape[1:] == (NUM_LANDMARKS, COORDS_PER_LANDMARK):
            normed = normalize_frame(frame)
        else:
            normed = normalize_two_hand_frame(frame)
        if normed is None:
            return None
        result.append(normed)

    return np.stack(result, axis=0).astype(np.float32, copy=False)


def normalize_sequence_safe(frames: np.ndarray, feature_size: int = TWO_HAND_FEATURE_SIZE) -> np.ndarray | None:
    """
    Lenient normalization for dataset build.

    Degenerate/missing frames become zeros. Completely empty clips return None.
    Old [T, 63] vectors are intentionally not accepted when feature_size=126.
    """
    if not np.all(np.isfinite(frames)):
        return None

    if frames.ndim == 2 and frames.shape[1] == feature_size:
        out = frames.astype(np.float32, copy=False)
        return out if np.abs(out).max() >= 1e-6 else None

    result = []
    any_valid = False

    for frame in frames:
        try:
            if feature_size == HAND_FEATURE_SIZE:
                normed = normalize_frame(frame)
            else:
                normed = normalize_two_hand_frame(frame)
        except ValueError:
            return None

        if normed is None:
            result.append(np.zeros(feature_size, dtype=np.float32))
        else:
            result.append(normed)
            any_valid = True

    return np.stack(result, axis=0).astype(np.float32, copy=False) if any_valid else None
