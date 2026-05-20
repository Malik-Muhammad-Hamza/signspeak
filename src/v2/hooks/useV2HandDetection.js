/**
 * SignSpeak v2 — useV2HandDetection
 *
 * React hook that drives MediaPipe Hands and accumulates normalised landmark
 * frames into the sliding-window buffer.  Calls `onSequenceReady` each time
 * the buffer is full so the caller can run TCN inference.
 *
 * MediaPipe Hands is loaded on-demand via dynamic <script> injection so that
 * v1 users are never affected (the CDN scripts are NOT in index.html).
 *
 * Props / options
 * ---------------
 * webcamRef       React ref from react-webcam (access via .current.video)
 * canvasRef       React ref to an optional debug <canvas>
 * onSequenceReady (sequenceFloat32Array) => void
 * frameCount      32 (default) — must match model training config
 * enabled         boolean — pause detection without unmounting
 */

import { useEffect, useRef, useCallback } from 'react';
import { normalizeLandmarks } from '../utils/landmarkNormalizer';
import { createFrameBuffer } from '../utils/frameBuffer';

const DEFAULT_FRAME_COUNT = 32;
const FEATURE_SIZE = 63;

// MediaPipe CDN — pinned version for reproducibility
const MP_VERSION = '0.4.1646424915';
const MP_BASE    = `https://cdn.jsdelivr.net/npm/@mediapipe/hands@${MP_VERSION}`;

/** Injects a <script> tag once and resolves when it loads. */
function loadScript(src) {
  if (document.querySelector(`script[src="${src}"]`)) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = src;
    s.crossOrigin = 'anonymous';
    s.onload  = resolve;
    s.onerror = () => reject(new Error(`Failed to load: ${src}`));
    document.head.appendChild(s);
  });
}

/** Load MediaPipe Hands from CDN — idempotent. */
async function loadMediaPipeHands() {
  if (window.Hands) return window.Hands;

  await loadScript(`${MP_BASE}/hands.js`);

  if (!window.Hands) throw new Error('[useV2HandDetection] window.Hands not found after script load');
  return window.Hands;
}

/**
 * @param {object} opts
 * @param {React.RefObject} opts.webcamRef     react-webcam ref (exposes .video)
 * @param {React.RefObject} [opts.canvasRef]   optional debug canvas
 * @param {function}        opts.onSequenceReady
 * @param {number}          [opts.frameCount=32]
 * @param {boolean}         [opts.enabled=true]
 */
export function useV2HandDetection({
  webcamRef,
  canvasRef,
  onSequenceReady,
  frameCount = DEFAULT_FRAME_COUNT,
  enabled = true,
}) {
  const handsRef     = useRef(null);
  const bufferRef    = useRef(createFrameBuffer(frameCount, FEATURE_SIZE));
  const animFrameRef = useRef(null);
  const runningRef   = useRef(false);

  // Stable callback reference — avoids restarting the detection loop
  const callbackRef = useRef(onSequenceReady);
  useEffect(() => { callbackRef.current = onSequenceReady; }, [onSequenceReady]);

  // ── Result handler ──────────────────────────────────────────────────────────
  const handleResults = useCallback((results) => {
    if (!runningRef.current) return;

    const landmarks = results?.multiHandLandmarks?.[0] ?? null;

    if (!landmarks) {
      bufferRef.current.reset();
      return;
    }

    const vector = normalizeLandmarks(landmarks);
    if (!vector) return;

    bufferRef.current.push(vector);

    if (bufferRef.current.isFull()) {
      callbackRef.current?.(bufferRef.current.getSequence());
    }

    // Optional landmark skeleton on debug canvas
    if (canvasRef?.current) {
      drawDebugCanvas(canvasRef.current, results);
    }
  }, [canvasRef]);

  // ── Detection loop ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!enabled) return;

    let cancelled = false;
    runningRef.current = false;

    loadMediaPipeHands()
      .then((Hands) => {
        if (cancelled) return;

        const hands = new Hands({
          locateFile: (file) => `${MP_BASE}/${file}`,
        });
        hands.setOptions({
          maxNumHands: 1,
          modelComplexity: 1,
          minDetectionConfidence: 0.7,
          minTrackingConfidence: 0.6,
        });
        hands.onResults(handleResults);
        handsRef.current = hands;
        runningRef.current = true;

        // rAF loop — reads directly from react-webcam's .video element
        async function detect() {
          if (!runningRef.current) return;

          const video = webcamRef?.current?.video;
          if (video && video.readyState >= 2) {
            try {
              await handsRef.current.send({ image: video });
            } catch (e) {
              if (runningRef.current) console.warn('[useV2HandDetection]', e);
            }
          }
          animFrameRef.current = requestAnimationFrame(detect);
        }

        detect();
      })
      .catch((err) => {
        console.error('[useV2HandDetection] MediaPipe load failed:', err);
      });

    return () => {
      cancelled = true;
      runningRef.current = false;
      cancelAnimationFrame(animFrameRef.current);
      handsRef.current?.close?.();
      bufferRef.current.reset();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);   // handleResults is stable; webcamRef ref-object is stable
}

// ── Minimal debug canvas renderer ─────────────────────────────────────────────
function drawDebugCanvas(canvas, results) {
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const landmarks = results?.multiHandLandmarks?.[0];
  if (!landmarks) return;

  const connections = window.HAND_CONNECTIONS;

  if (connections) {
    ctx.strokeStyle = 'rgba(0,200,255,0.5)';
    ctx.lineWidth = 2;
    for (const [s, e] of connections) {
      const a = landmarks[s], b = landmarks[e];
      ctx.beginPath();
      ctx.moveTo(a.x * canvas.width, a.y * canvas.height);
      ctx.lineTo(b.x * canvas.width, b.y * canvas.height);
      ctx.stroke();
    }
  }

  ctx.fillStyle = '#00c8ff';
  for (const lm of landmarks) {
    ctx.beginPath();
    ctx.arc(lm.x * canvas.width, lm.y * canvas.height, 3.5, 0, Math.PI * 2);
    ctx.fill();
  }
}
