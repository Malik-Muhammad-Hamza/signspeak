import { useState, useEffect, useRef } from "react";
import "@tensorflow/tfjs";
import * as handpose from "@tensorflow-models/handpose";
import { drawHand } from "../utils/drawHand";
import { detectGesture } from "../utils/gestureDetector";

export const useHandDetection = (webcamRef, canvasRef) => {
  const [isModelLoading, setIsModelLoading] = useState(true);
  const [handDetected, setHandDetected] = useState(false);
  const [detectedLetter, setDetectedLetter] = useState(null);
  const [error, setError] = useState(null);
  
  const modelRef = useRef(null);

  useEffect(() => {
    let intervalId;

    const loadModelAndDetect = async () => {
      try {
        modelRef.current = await handpose.load();
        setIsModelLoading(false);

        intervalId = setInterval(async () => {
          if (
            typeof webcamRef.current !== "undefined" &&
            webcamRef.current !== null &&
            webcamRef.current.video.readyState === 4
          ) {
            const video = webcamRef.current.video;
            const videoWidth = webcamRef.current.video.videoWidth;
            const videoHeight = webcamRef.current.video.videoHeight;

            webcamRef.current.video.width = videoWidth;
            webcamRef.current.video.height = videoHeight;

            if (canvasRef.current) {
              canvasRef.current.width = videoWidth;
              canvasRef.current.height = videoHeight;

              const predictions = await modelRef.current.estimateHands(video);
              const ctx = canvasRef.current.getContext("2d");
              
              ctx.clearRect(0, 0, videoWidth, videoHeight);

              if (predictions && predictions.length > 0) {
                setHandDetected(true);
                drawHand(predictions, ctx);
                
                const letter = detectGesture(predictions);
                setDetectedLetter(letter);
              } else {
                setHandDetected(false);
                setDetectedLetter(null);
              }
            }
          }
        }, 150);
      } catch (err) {
        console.error("Model loading error:", err);
        setError("The hand detection model could not be loaded.");
        setIsModelLoading(false);
      }
    };

    loadModelAndDetect();

    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [webcamRef, canvasRef]);

  return { isModelLoading, handDetected, detectedLetter, error };
};
