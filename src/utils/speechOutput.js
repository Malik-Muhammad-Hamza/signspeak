const pronunciationMap = {
  hi: "high", // prevents spelling H-I
  hey: "hey",
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
  
  window.speechSynthesis.cancel();
  
  // Clean text: trim, remove extra spaces, and convert to lowercase to prevent spelling out acronyms
  let cleanText = text.trim().replace(/\s+/g, ' ').toLowerCase();
  
  // Check pronunciation map
  if (pronunciationMap[cleanText]) {
    cleanText = pronunciationMap[cleanText];
  }
  
  const msg = new SpeechSynthesisUtterance(cleanText);
  msg.lang = "en-US";
  msg.rate = 0.85;
  msg.pitch = 1;
  msg.volume = 1;
  
  // Try to find the best available English voice
  const voices = window.speechSynthesis.getVoices();
  const englishVoice = 
    voices.find(v => v.lang === "en-US" && v.name.includes("Google")) || 
    voices.find(v => v.lang === "en-US") || 
    voices.find(v => v.lang.startsWith("en"));
    
  if (englishVoice) {
    msg.voice = englishVoice;
  }
  
  window.speechSynthesis.speak(msg);
};
