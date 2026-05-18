import * as fp from "fingerpose";
import { gestureDescriptions } from "./gestureDescriptions";

// Create one GestureEstimator instance
const estimator = new fp.GestureEstimator(gestureDescriptions);

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
      // Sort gestures by confidence score (descending)
      const sortedGestures = estimatedGestures.gestures.sort((a, b) => b.score - a.score);
      const highestConfidence = sortedGestures[0];
      
      return highestConfidence.name.toUpperCase();
    }
    
    return null;
  } catch (error) {
    console.error("Error detecting gesture:", error);
    return null;
  }
};
