"""
SignSpeak v2 — Training Utility: Normalizer
===========================================
Python implementation of the landmark normalisation algorithm.
Must stay bit-for-bit identical to:
  src/v2/utils/landmarkNormalizer.js

Algorithm
---------
1. Translate all 21 landmarks so wrist (index 0) is at origin.
2. Divide every coordinate by max(|value|) across all coords in the frame.
3. Flatten to shape (63,).

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
    np.ndarray  shape (63,)  float32, or None if degenerate (all zeros).
    """
    if frame.shape != (21, 3):
        raise ValueError(f"Expected (21, 3), got {frame.shape}")

    wrist = frame[0]                       # (3,)
    shifted = frame - wrist                # (21, 3) — wrist at origin

    flat = shifted.flatten().astype(np.float32)   # (63,)

    max_abs = np.abs(flat).max()
    if max_abs == 0.0:
        return None                        # degenerate hand

    return flat / max_abs


def normalize_sequence(frames: np.ndarray) -> np.ndarray | None:
    """
    Normalise an entire (T, 21, 3) sequence frame-by-frame.

    Returns (T, 63) float32, or None if any frame is degenerate.
    """
    result = []
    for i, frame in enumerate(frames):
        normed = normalize_frame(frame)
        if normed is None:
            return None
        result.append(normed)
    return np.stack(result, axis=0)        # (T, 63)
