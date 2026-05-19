import { useState, useEffect, useRef, useCallback } from "react";
import { speakWord } from "../utils/speechOutput";

const LETTER_HOLD_MS = 1000;          // how long to hold a sign before it registers
const NO_HAND_WORD_DELAY_MS = 1500;   // fallback: complete word after hand disappears
const NEXT_WORD_COOLDOWN_MS = 1200;   // prevent rapid re-firing of open-palm action

export const useWordBuilder = (detectedLetter) => {
  const [currentLetter, setCurrentLetter] = useState(null);
  const [currentWord, setCurrentWord]     = useState("");
  const [fullSentence, setFullSentence]   = useState("");
  const [progress, setProgress]           = useState(0);
  const [gestureHistory, setGestureHistory] = useState([]);
  const [toastMessage, setToastMessage]   = useState("");

  const lockRef               = useRef(null);
  const holdTimerRef          = useRef(null);
  const progressIntervalRef   = useRef(null);
  const spaceTimerRef         = useRef(null);
  const progressValueRef      = useRef(0);
  const wordCompletedRef      = useRef(false);
  const lastNextWordAtRef     = useRef(0);
  const toastTimerRef         = useRef(null);

  // ─── Toast helper ────────────────────────────────────────────────────────
  const showToast = useCallback((msg) => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToastMessage(msg);
    toastTimerRef.current = setTimeout(() => setToastMessage(""), 1800);
  }, []);

  // ─── Word finalization (shared logic) ────────────────────────────────────
  const finalizeWord = useCallback((wordSnapshot, showToastMsg = false) => {
    const trimmed = wordSnapshot.trim();
    if (!trimmed) return;

    setFullSentence((prev) => {
      const words    = prev.trim().split(/\s+/);
      const lastWord = words[words.length - 1];
      if (lastWord?.toLowerCase() === trimmed.toLowerCase()) return prev;
      return prev ? `${prev} ${trimmed}` : trimmed;
    });

    setCurrentWord("");
    wordCompletedRef.current = true;

    if (showToastMsg) showToast("Word completed ✓");
  }, [showToast]);

  // ─── Main gesture effect ──────────────────────────────────────────────────
  useEffect(() => {
    if (detectedLetter === currentLetter) return;

    setCurrentLetter(detectedLetter);
    setProgress(0);
    progressValueRef.current = 0;

    if (holdTimerRef.current)        clearTimeout(holdTimerRef.current);
    if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);

    // ── No hand ────────────────────────────────────────────────────────────
    if (detectedLetter === null) {
      if (spaceTimerRef.current) clearTimeout(spaceTimerRef.current);

      // Fallback: complete word after a short pause with no hand
      if (currentWord.trim() !== "" && !wordCompletedRef.current) {
        const snapshot = currentWord;
        spaceTimerRef.current = setTimeout(() => {
          if (!wordCompletedRef.current) finalizeWord(snapshot, false);
        }, NO_HAND_WORD_DELAY_MS);
      }

      lockRef.current = null;
      return;
    }

    // ── Cancel no-hand fallback if a gesture reappears ────────────────────
    if (spaceTimerRef.current) clearTimeout(spaceTimerRef.current);

    // ── NEXT_WORD open-palm action ─────────────────────────────────────────
    if (detectedLetter === "NEXT_WORD") {
      const now = Date.now();
      if (now - lastNextWordAtRef.current < NEXT_WORD_COOLDOWN_MS) return;
      lastNextWordAtRef.current = now;

      if (currentWord.trim() !== "" && !wordCompletedRef.current) {
        const snapshot = currentWord;
        finalizeWord(snapshot, true);
      }
      return;
    }

    // ── Normal letter ──────────────────────────────────────────────────────
    if (detectedLetter !== lockRef.current) {
      // Progress bar fills over LETTER_HOLD_MS
      const ticks    = 10;
      const interval = LETTER_HOLD_MS / ticks;

      progressIntervalRef.current = setInterval(() => {
        progressValueRef.current += 100 / ticks;
        if (progressValueRef.current >= 100) {
          progressValueRef.current = 100;
          clearInterval(progressIntervalRef.current);
        }
        setProgress(progressValueRef.current);
      }, interval);

      holdTimerRef.current = setTimeout(() => {
        setCurrentWord((prev) => prev + detectedLetter);
        setGestureHistory((prev) => [...prev, detectedLetter].slice(-10));
        lockRef.current          = detectedLetter;
        wordCompletedRef.current = false;
        setProgress(0);
        progressValueRef.current = 0;
        if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
      }, LETTER_HOLD_MS);
    }
  }, [detectedLetter, currentLetter, currentWord, finalizeWord]);

  // ─── Cleanup on unmount ──────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      if (holdTimerRef.current)        clearTimeout(holdTimerRef.current);
      if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
      if (spaceTimerRef.current)       clearTimeout(spaceTimerRef.current);
      if (toastTimerRef.current)       clearTimeout(toastTimerRef.current);
    };
  }, []);

  // ─── Manual controls ──────────────────────────────────────────────────────
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
    lockRef.current          = null;
    setProgress(0);
    progressValueRef.current = 0;
    wordCompletedRef.current = false;
    setToastMessage("");
  };

  const speakText = () => {
    const textToSpeak = `${fullSentence} ${currentWord}`.trim();
    if (textToSpeak) speakWord(textToSpeak);
  };

  return {
    currentLetter,
    currentWord,
    fullSentence,
    progress,
    gestureHistory,
    toastMessage,
    deleteLetter,
    clearAll,
    speakText,
  };
};
