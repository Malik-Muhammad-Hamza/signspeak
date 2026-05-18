import * as fp from "fingerpose";
import { gestureDescriptions } from "./gestureDescriptions";

// Create one GestureEstimator instance
const estimator = new fp.GestureEstimator(gestureDescriptions);

const getDistance = (pointA, pointB) => {
  return Math.sqrt(
    Math.pow(pointA[0] - pointB[0], 2) +
    Math.pow(pointA[1] - pointB[1], 2) +
    Math.pow(pointA[2] - pointB[2], 2)
  );
};

const isOLikeShape = (landmarks) => {
  const thumbTip = landmarks[4];
  const indexTip = landmarks[8];
  const wrist = landmarks[0];
  const middleMCP = landmarks[9];

  const referenceDistance = getDistance(wrist, middleMCP);
  const pinchDistance = getDistance(thumbTip, indexTip);
  
  return (pinchDistance / referenceDistance) < 0.8;
};

export const detectGesture = (predictions) => {
  try {
    if (!predictions || predictions.length === 0) {
      return null;
    }

    const landmarks = predictions[0].landmarks;

    if (!landmarks) {
      return null;
    }

    const estimatedGestures = estimator.estimate(landmarks, 8.5);

    if (estimatedGestures && estimatedGestures.gestures && estimatedGestures.gestures.length > 0) {
      const sortedGestures = estimatedGestures.gestures.sort((a, b) => b.score - a.score);
      let highestConfidence = sortedGestures[0].name.toUpperCase();
      
      const isO = isOLikeShape(landmarks);
      
      if (highestConfidence === "C" && isO) {
        highestConfidence = "O";
      } else if (highestConfidence === "A" && isO) {
        highestConfidence = "O";
      } else if (highestConfidence === "O" && !isO) {
        const secondBest = sortedGestures[1];
        if (secondBest) {
          highestConfidence = secondBest.name.toUpperCase();
        } else {
          highestConfidence = "C";
        }
      }

      return highestConfidence;
    }
    
    return null;
  } catch (error) {
    console.error("Error detecting gesture:", error);
    return null;
  }
};
