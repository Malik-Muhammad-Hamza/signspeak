const PRONUNCIATION_MAP = {
  hi: "high",
  hey: "hay",
  hello: "hello",
  bye: "bye",
  yes: "yes",
  no: "no",
  help: "help",
  good: "good",
  bad: "bad"
};

export const speakWord = (text) => {
  if (!text) return;
  
  if (!("speechSynthesis" in window)) {
    console.warn("Speech synthesis is not supported by this browser.");
    return;
  }
  
  let cleanedText = text
    .replace(/[^a-zA-Z\s]/g, "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
    
  if (!cleanedText) return;

  cleanedText = cleanedText
    .split(" ")
    .map((word) => PRONUNCIATION_MAP[word] || word)
    .join(" ");
  
  window.speechSynthesis.cancel();
  
  setTimeout(() => {
    const msg = new SpeechSynthesisUtterance(cleanedText);
    
    const voices = window.speechSynthesis.getVoices();
    let bestVoice = null;
    
    const preferredVoices = [
      "Google US English",
      "Microsoft Aria",
      "Microsoft Jenny"
    ];
    
    for (const pref of preferredVoices) {
      bestVoice = voices.find((v) => v.name.includes(pref) && v.lang.startsWith("en"));
      if (bestVoice) break;
    }
    
    if (!bestVoice) {
      bestVoice = voices.find((v) => v.lang === "en-US") || voices.find((v) => v.lang.startsWith("en"));
    }
    
    if (bestVoice) {
      msg.voice = bestVoice;
    }
    
    msg.lang = "en-US";
    msg.rate = 0.82;
    msg.pitch = 1;
    msg.volume = 1;
    
    window.speechSynthesis.speak(msg);
  }, 50);
};
