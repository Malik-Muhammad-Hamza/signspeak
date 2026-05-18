import * as fp from "fingerpose";
import { gestureDescriptions } from "./gestureDescriptions";

// Create one GestureEstimator instance
const estimator = new fp.GestureEstimator(gestureDescriptions);

const getDistance = (pointA, pointB) => {
  if (!pointA || !pointB) return Infinity;
  // 2D Euclidean distance using x and y
  return Math.sqrt(
    Math.pow(pointA[0] - pointB[0], 2) +
    Math.pow(pointA[1] - pointB[1], 2)
  );
};

const getNormalizedThumbIndexGap = (landmarks) => {
  if (!landmarks || !landmarks[4] || !landmarks[8] || !landmarks[0] || !landmarks[9]) {
    return Infinity;
  }
  const thumbTip = landmarks[4];
  const indexTip = landmarks[8];
  const wrist = landmarks[0];
  const middleMCP = landmarks[9];

  const thumbIndexDistance = getDistance(thumbTip, indexTip);
  const handSize = getDistance(wrist, middleMCP);
  
  if (handSize === 0 || handSize === Infinity) return Infinity;
  
  return thumbIndexDistance / handSize;
};

const isClosedOShape = (landmarks) => {
  return getNormalizedThumbIndexGap(landmarks) <= 0.65;
};

const isOpenCShape = (landmarks) => {
  return getNormalizedThumbIndexGap(landmarks) >= 0.75;
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
      const bestMatch = sortedGestures[0];
      let highestConfidence = bestMatch.name.toUpperCase();
      const score = bestMatch.score;
      
      // console.log("C/O gap:", getNormalizedThumbIndexGap(landmarks));
      
      const isClosed = isClosedOShape(landmarks);
      const isOpen = isOpenCShape(landmarks);
      const isAmbiguous = !isClosed && !isOpen;
      
      if (highestConfidence === "C") {
        if (isClosed) {
          highestConfidence = "O";
        } else if (isOpen) {
          // Keep C
        } else if (isAmbiguous) {
          if (score < 9.0) return null;
        }
      } else if (highestConfidence === "O") {
        if (isOpen) {
          highestConfidence = "C";
        } else if (isClosed) {
          // Keep O
        } else if (isAmbiguous) {
          if (score < 9.0) return null;
        }
      } else if (highestConfidence === "A") {
        if (isClosed) {
          highestConfidence = "O";
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
