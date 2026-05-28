"""
SignSpeak v2 — Training Utility: Normalizer
===========================================
Python implementation of the landmark normalisation algorithm.

MUST stay bit-for-bit identical to:
  src/v2/utils/landmarkNormalizer.js

Algorithm
---------
1. Translate all 21 landmarks so wrist (landmark 0) is at origin.
   — Left/right hand: we always subtract landmark[0] (wrist) regardless of handedness.
2. Flatten to (63,) float32.
3. Divide every coordinate by max(|value|) across all 63 values.
   — Uses 1e-6 threshold (same as JS: if maxAbs < 1e-6 → degenerate frame).
4. Result: wrist-relative, max-abs scaled, in [-1, 1].

Called from 02_build_dataset.py; not run standalone.
"""

import numpy as np


def normalize_frame(frame: np.ndarray) -> np.ndarray | None:
    """
    Normalise a single frame of 21 landmarks.

    Parameters
    ----------
    frame : np.ndarray  shape (21, 3)

    Returns
    -------
    np.ndarray  shape (63,)  float32  — wrist-relative, max-abs scaled.
    None if degenerate (all zeros / near-zero scale — mirrors JS guard: maxAbs < 1e-6).
    """
    if frame.shape != (21, 3):
        raise ValueError(f"Expected (21, 3), got {frame.shape}")

    # Step 1 — wrist-relative translation (landmark 0 = wrist)
    wrist   = frame[0]
    shifted = frame - wrist
    flat    = shifted.flatten().astype(np.float32)

    # Step 2 — max-abs scale normalisation (mirrors JS: if (maxAbs < 1e-6) return null)
    max_abs = np.abs(flat).max()
    if max_abs < 1e-6:
        return None   # degenerate frame — skip

    normed = flat / max_abs

    # Step 3 — NaN/Inf guard (should not happen after scale check, but defensive)
    if not np.all(np.isfinite(normed)):
        return None

    return normed


def normalize_sequence(frames: np.ndarray) -> np.ndarray | None:
    """
    Normalise an entire (T, 21, 3) sequence frame-by-frame.

    Returns (T, 63) float32, or None if any frame is degenerate.
    Strict mode: ANY bad frame rejects the whole clip.
    """
    result = []
    for frame in frames:
        normed = normalize_frame(frame)
        if normed is None:
            return None
        result.append(normed)
    return np.stack(result, axis=0)


def normalize_sequence_safe(frames: np.ndarray) -> np.ndarray | None:
    """
    Lenient version: replace degenerate frames with zeros instead of rejecting clip.
    Returns (T, 63) float32, or None if ALL frames are degenerate.
    """
    result = []
    any_valid = False
    for frame in frames:
        normed = normalize_frame(frame)
        if normed is None:
            result.append(np.zeros(63, dtype=np.float32))
        else:
            result.append(normed)
            any_valid = True
    return np.stack(result, axis=0) if any_valid else None
