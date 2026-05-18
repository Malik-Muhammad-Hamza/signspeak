import { useState, useEffect, useRef } from "react";
import { speakWord } from "../utils/speechOutput";

export const useWordBuilder = (detectedLetter) => {
  const [currentLetter, setCurrentLetter] = useState(null);
  const [currentWord, setCurrentWord] = useState("");
  const [fullSentence, setFullSentence] = useState("");
  const [progress, setProgress] = useState(0);
  const [gestureHistory, setGestureHistory] = useState([]);

  const lockRef = useRef(null);
  const holdTimerRef = useRef(null);
  const progressIntervalRef = useRef(null);
  const spaceTimerRef = useRef(null);
  const progressValueRef = useRef(0);

  useEffect(() => {
    if (detectedLetter !== currentLetter) {
      setCurrentLetter(detectedLetter);
      setProgress(0);
      progressValueRef.current = 0;
      
      if (holdTimerRef.current) clearTimeout(holdTimerRef.current);
      if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
      
      if (detectedLetter === null) {
        // Start 2000ms timer to append word to sentence and speak
        spaceTimerRef.current = setTimeout(() => {
          setCurrentWord((prevWord) => {
            if (prevWord.length > 0) {
              setFullSentence((prevSentence) => {
                const newSentence = prevSentence ? prevSentence + " " + prevWord : prevWord;
                return newSentence;
              });
              speakWord(prevWord);
              return "";
            }
            return prevWord;
          });
        }, 2000);
        
        lockRef.current = null;
      } else {
        if (spaceTimerRef.current) clearTimeout(spaceTimerRef.current);
        
        if (detectedLetter !== lockRef.current) {
          // Track progress over 1200ms
          progressIntervalRef.current = setInterval(() => {
            progressValueRef.current += (100 / 10);
            if (progressValueRef.current >= 100) {
              progressValueRef.current = 100;
              clearInterval(progressIntervalRef.current);
            }
            setProgress(progressValueRef.current);
          }, 120);
          
          holdTimerRef.current = setTimeout(() => {
            setCurrentWord((prev) => prev + detectedLetter);
            setGestureHistory((prev) => [...prev, detectedLetter].slice(-10));
            lockRef.current = detectedLetter;
            setProgress(0);
            progressValueRef.current = 0;
            if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
          }, 1200);
        }
      }
    }
  }, [detectedLetter, currentLetter]);

  const deleteLetter = () => {
    if (currentWord.length > 0) {
      setCurrentWord((prev) => prev.slice(0, -1));
      setGestureHistory((hist) => hist.slice(0, -1));
    }
  };

  const clearAll = () => {
    setCurrentWord("");
    setFullSentence("");
    setGestureHistory([]);
    lockRef.current = null;
    setProgress(0);
    progressValueRef.current = 0;
  };

  const speakAgain = () => {
    if (fullSentence) {
      speakWord(fullSentence);
    } else if (currentWord) {
      speakWord(currentWord);
    }
  };

  return { currentLetter, currentWord, fullSentence, progress, gestureHistory, deleteLetter, clearAll, speakAgain };
};
