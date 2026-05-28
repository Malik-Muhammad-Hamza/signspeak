import { useState, useEffect, useRef } from "react";
import "@tensorflow/tfjs";
import * as handpose from "@tensorflow-models/handpose";
import { drawHand } from "../utils/drawHand";
import { detectGesture } from "../utils/gestureDetector";

/**
 * useHandDetection — v1 hand detection hook.
 *
 * Uses a self-scheduling RAF/timeout loop instead of setInterval so that
 * async estimateHands() calls never overlap. If inference takes longer than
 * the target interval it simply runs back-to-back without skipping frames.
 *
 * State is only updated when values actually change, reducing re-renders.
 */
export const useHandDetection = (webcamRef, canvasRef) => {
  const [isModelLoading, setIsModelLoading] = useState(true);
  const [handDetected, setHandDetected] = useState(false);
  const [detectedLetter, setDetectedLetter] = useState(null);
  const [error, setError] = useState(null);

  const modelRef   = useRef(null);
  const activeRef  = useRef(false); // true while the loop should keep running
  const rafRef     = useRef(null);  // requestAnimationFrame id for cleanup
  const handDetectedRef = useRef(false);

  const setHandDetectedIfChanged = (nextValue) => {
    if (handDetectedRef.current === nextValue) return;
    handDetectedRef.current = nextValue;
    setHandDetected(nextValue);
  };

  // Min ms between inference calls — keeps CPU/GPU load reasonable.
  const INTERVAL_MS = 150;

  useEffect(() => {
    activeRef.current = true;
    let lastRun = 0;

    const runLoop = async (timestamp) => {
      if (!activeRef.current) return;

      // Throttle: skip frame if not enough time has elapsed
      if (timestamp - lastRun >= INTERVAL_MS) {
        lastRun = timestamp;

        const cam = webcamRef.current;
        if (
          cam != null &&
          cam.video != null &&
          cam.video.readyState === 4 &&
          canvasRef.current != null
        ) {
          const video       = cam.video;
          const videoWidth  = video.videoWidth;
          const videoHeight = video.videoHeight;

          // Keep canvas sized to the actual video stream
          video.width  = videoWidth;
          video.height = videoHeight;
          canvasRef.current.width  = videoWidth;
          canvasRef.current.height = videoHeight;

          try {
            const predictions = await modelRef.current.estimateHands(video);
            if (!activeRef.current) return; // unmounted during await

            const ctx = canvasRef.current?.getContext("2d");
            if (ctx) ctx.clearRect(0, 0, videoWidth, videoHeight);

            if (ctx && predictions && predictions.length > 0) {
              setHandDetectedIfChanged(true);
              drawHand(predictions, ctx);
              const letter = detectGesture(predictions);
              // Only update state when value changes
              setDetectedLetter((prev) => (prev === letter ? prev : letter));
            } else {
              setHandDetectedIfChanged(false);
              setDetectedLetter((prev) => (prev === null ? prev : null));
            }
          } catch (err) {
            if (activeRef.current) {
              console.warn("[useHandDetection] estimateHands error:", err);
            }
          }
        }
      }

      if (activeRef.current) {
        rafRef.current = requestAnimationFrame(runLoop);
      }
    };

    const loadModelAndStart = async () => {
      try {
        modelRef.current = await handpose.load();
        if (!activeRef.current) return; // unmounted while loading
        setIsModelLoading(false);
        rafRef.current = requestAnimationFrame(runLoop);
      } catch (err) {
        console.error("Model loading error:", err);
        setError("The hand detection model could not be loaded.");
        setIsModelLoading(false);
      }
    };

    loadModelAndStart();

    return () => {
      activeRef.current = false;
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    };
  // webcamRef and canvasRef are stable React refs — safe to omit
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { isModelLoading, handDetected, detectedLetter, error };
};
