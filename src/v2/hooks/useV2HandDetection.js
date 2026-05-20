/**
 * SignSpeak v2 — useV2HandDetection
 *
 * React hook that drives MediaPipe Hands and accumulates normalised landmark
 * frames into the sliding-window buffer.  Calls `onSequenceReady` each time
 * the buffer is full so the caller can run TCN inference.
 *
 * This hook is intentionally decoupled from inference so it can be tested
 * and replaced independently.
 *
 * Props / options
 * ---------------
 * videoRef        React ref to the <video> element
 * canvasRef       React ref to an optional debug <canvas>
 * onSequenceReady (sequenceFloat32Array) => void
 * frameCount      32 (default) — must match model training config
 * enabled         boolean — pause detection without unmounting
 */

import { useEffect, useRef, useCallback } from 'react';
import { normalizeLandmarks } from '../utils/landmarkNormalizer';
import { createFrameBuffer } from '../utils/frameBuffer';

// MediaPipe is loaded via CDN in index.html (same pattern as v1)
const { Hands, HAND_CONNECTIONS } = window;

const DEFAULT_FRAME_COUNT = 32;
const FEATURE_SIZE = 63;

/**
 * @param {object} opts
 * @param {React.RefObject} opts.videoRef
 * @param {React.RefObject} [opts.canvasRef]
 * @param {function}        opts.onSequenceReady
 * @param {number}          [opts.frameCount=32]
 * @param {boolean}         [opts.enabled=true]
 */
export function useV2HandDetection({
  videoRef,
  canvasRef,
  onSequenceReady,
  frameCount = DEFAULT_FRAME_COUNT,
  enabled = true,
}) {
  const handsRef = useRef(null);
  const bufferRef = useRef(createFrameBuffer(frameCount, FEATURE_SIZE));
  const animFrameRef = useRef(null);

  // Stable callback reference
  const onSequenceReadyRef = useRef(onSequenceReady);
  useEffect(() => {
    onSequenceReadyRef.current = onSequenceReady;
  }, [onSequenceReady]);

  const handleResults = useCallback((results) => {
    if (!enabled) return;

    const landmarks = results?.multiHandLandmarks?.[0] ?? null;

    if (!landmarks) {
      bufferRef.current.reset();
      return;
    }

    const vector = normalizeLandmarks(landmarks);
    if (!vector) return;

    bufferRef.current.push(vector);

    if (bufferRef.current.isFull()) {
      const sequence = bufferRef.current.getSequence();
      onSequenceReadyRef.current?.(sequence);
    }

    // Optional debug canvas drawing
    if (canvasRef?.current) {
      drawDebugCanvas(canvasRef.current, results);
    }
  }, [enabled, canvasRef]);

  useEffect(() => {
    if (!enabled) return;

    const hands = new Hands({
      locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`,
    });

    hands.setOptions({
      maxNumHands: 1,
      modelComplexity: 1,
      minDetectionConfidence: 0.7,
      minTrackingConfidence: 0.6,
    });

    hands.onResults(handleResults);
    handsRef.current = hands;

    const video = videoRef?.current;
    if (!video) return;

    let running = true;

    async function detect() {
      if (!running) return;
      if (video.readyState >= 2) {
        await handsRef.current.send({ image: video });
      }
      animFrameRef.current = requestAnimationFrame(detect);
    }

    detect();

    return () => {
      running = false;
      cancelAnimationFrame(animFrameRef.current);
      handsRef.current?.close?.();
      bufferRef.current.reset();
    };
  }, [enabled, videoRef, handleResults]);
}

// ---------------------------------------------------------------------------
// Minimal debug canvas renderer (landmarks + connections)
// ---------------------------------------------------------------------------
function drawDebugCanvas(canvas, results) {
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const landmarks = results?.multiHandLandmarks?.[0];
  if (!landmarks) return;

  // Connections
  if (HAND_CONNECTIONS) {
    ctx.strokeStyle = 'rgba(0,200,255,0.6)';
    ctx.lineWidth = 2;
    for (const [start, end] of HAND_CONNECTIONS) {
      const s = landmarks[start];
      const e = landmarks[end];
      ctx.beginPath();
      ctx.moveTo(s.x * canvas.width, s.y * canvas.height);
      ctx.lineTo(e.x * canvas.width, e.y * canvas.height);
      ctx.stroke();
    }
  }

  // Landmark dots
  ctx.fillStyle = '#00c8ff';
  for (const lm of landmarks) {
    ctx.beginPath();
    ctx.arc(lm.x * canvas.width, lm.y * canvas.height, 3, 0, Math.PI * 2);
    ctx.fill();
  }
}
