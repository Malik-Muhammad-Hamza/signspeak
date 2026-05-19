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
  const wordCompletedRef = useRef(false);

  useEffect(() => {
    if (detectedLetter !== currentLetter) {
      setCurrentLetter(detectedLetter);
      setProgress(0);
      progressValueRef.current = 0;
      
      if (holdTimerRef.current) clearTimeout(holdTimerRef.current);
      if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
      
      if (detectedLetter === null) {
        if (spaceTimerRef.current) clearTimeout(spaceTimerRef.current);
        
        if (currentWord.trim() !== "" && !wordCompletedRef.current) {
          spaceTimerRef.current = setTimeout(() => {
            if (!wordCompletedRef.current) {
              wordCompletedRef.current = true;
              
              setFullSentence((prev) => {
                const trimmedWord = currentWord.trim();
                if (!trimmedWord) return prev;
                
                const words = prev.trim().split(/\s+/);
                const lastWord = words[words.length - 1];
                
                if (lastWord?.toLowerCase() === trimmedWord.toLowerCase()) {
                  return prev;
                }
                
                return prev ? `${prev} ${trimmedWord}` : trimmedWord;
              });
              
              speakWord(currentWord.trim());
              setCurrentWord("");
            }
          }, 2000);
        }
        
        lockRef.current = null;
      } else {
        if (spaceTimerRef.current) clearTimeout(spaceTimerRef.current);
        
        if (detectedLetter !== lockRef.current) {
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
            wordCompletedRef.current = false;
            setProgress(0);
            progressValueRef.current = 0;
            if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
          }, 1200);
        }
      }
    }
  }, [detectedLetter, currentLetter, currentWord]);

  useEffect(() => {
    return () => {
      if (holdTimerRef.current) clearTimeout(holdTimerRef.current);
      if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
      if (spaceTimerRef.current) clearTimeout(spaceTimerRef.current);
    };
  }, []);

  const deleteLetter = () => {
    if (currentWord.length > 0) {
      setCurrentWord((prev) => prev.slice(0, -1));
      setGestureHistory((hist) => hist.slice(0, -1));
      wordCompletedRef.current = false;
    }
  };

  const clearAll = () => {
    setCurrentWord("");
    setFullSentence("");
    setGestureHistory([]);
    lockRef.current = null;
    setProgress(0);
    progressValueRef.current = 0;
    wordCompletedRef.current = false;
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
