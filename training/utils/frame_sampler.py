"""
SignSpeak v2 — Training Utility: Frame Sampler
===============================================
Uniform temporal re-sampling of variable-length landmark sequences
to a fixed `target` number of frames.

Mirrors the JS frameBuffer sliding window: the Python version produces
the *training* sequences (fixed-length clips); the JS version accumulates
*live* webcam frames. Both produce the same shape and ordering.

Called from 02_build_dataset.py; not run standalone.
"""

import numpy as np


def uniform_sample(frames: np.ndarray, target: int) -> np.ndarray:
    """
    Re-sample `frames` to exactly `target` frames using linear index mapping.

    Parameters
    ----------
    frames : np.ndarray  shape (T, 21, 3)
    target : int         desired number of output frames (e.g. 32)

    Returns
    -------
    np.ndarray  shape (target, 21, 3)
    """
    T = len(frames)
    if T == 0:
        raise ValueError("Cannot sample from empty sequence")
    if T == target:
        return frames.copy()

    # linspace: `target` evenly-spaced indices in [0, T-1]
    indices = np.round(np.linspace(0, T - 1, target)).astype(int)
    indices = np.clip(indices, 0, T - 1)
    return frames[indices]


def pad_or_sample(frames: np.ndarray, target: int) -> np.ndarray:
    """
    Like `uniform_sample`, but if the clip is shorter than `target`
    it repeats the last frame (edge-padding) instead of up-sampling.

    Use this when you want to preserve motion tempo for very short clips.
    """
    T = len(frames)
    if T >= target:
        return uniform_sample(frames, target)

    pad_count = target - T
    padding = np.tile(frames[-1:], (pad_count, 1, 1))   # repeat last frame
    return np.concatenate([frames, padding], axis=0)
