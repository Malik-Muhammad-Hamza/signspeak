import { useState, useEffect, useRef } from "react";

const validKeys = ["a", "b", "c", "d", "l", "v", "y", "i", "o", "w", "m", "z", "h", "e", "f", "g"];

export const useKeyboardDemo = () => {
  const [keyboardLetter, setKeyboardLetter] = useState(null);
  const [keyboardDemoActive, setKeyboardDemoActive] = useState(false);
  const timerRef = useRef(null);

  useEffect(() => {
    const handleKeyDown = (e) => {
      const key = e.key.toLowerCase();
      if (validKeys.includes(key)) {
        setKeyboardLetter(key.toUpperCase());
        setKeyboardDemoActive(true);

        if (timerRef.current) {
          clearTimeout(timerRef.current);
        }

        timerRef.current = setTimeout(() => {
          setKeyboardDemoActive(false);
          setKeyboardLetter(null);
        }, 3000);
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  return { keyboardLetter, keyboardDemoActive };
};
