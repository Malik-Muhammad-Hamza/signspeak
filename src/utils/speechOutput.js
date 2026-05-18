export const speakWord = (text) => {
  if (!text) return;
  
  if (!("speechSynthesis" in window)) {
    console.warn("Speech synthesis is not supported by this browser.");
    return;
  }
  
  window.speechSynthesis.cancel();
  
  const msg = new SpeechSynthesisUtterance(text);
  msg.rate = 0.9;
  msg.pitch = 1;
  msg.volume = 1;
  
  window.speechSynthesis.speak(msg);
};
