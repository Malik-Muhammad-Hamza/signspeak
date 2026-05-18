import React, { useRef, useState } from "react";
import "./index.css";
import WebcamFeed from "./components/WebcamFeed";
import { useHandDetection } from "./hooks/useHandDetection";
import { useWordBuilder } from "./hooks/useWordBuilder";
import { useKeyboardDemo } from "./hooks/useKeyboardDemo";

function App() {
  const webcamRef = useRef(null);
  const canvasRef = useRef(null);
  const [cameraError, setCameraError] = useState(null);

  const { isModelLoading, handDetected, detectedLetter, error: modelError } = useHandDetection(webcamRef, canvasRef);
  const { keyboardLetter, keyboardDemoActive } = useKeyboardDemo();
  
  const activeDetectedLetter = keyboardDemoActive ? keyboardLetter : detectedLetter;
  
  const { currentWord, fullSentence, progress, gestureHistory, deleteLetter, clearAll, speakAgain } = useWordBuilder(activeDetectedLetter);

  const handleCopyText = () => {
    if (fullSentence) {
      navigator.clipboard.writeText(fullSentence).catch(err => console.error("Failed to copy text: ", err));
    }
  };

  const handleDownloadTranscript = () => {
    if (fullSentence) {
      const blob = new Blob([fullSentence], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'signspeak-transcript.txt';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
  };

  return (
    <main className="min-h-screen bg-gray-950 text-gray-200 font-sans selection:bg-indigo-500/30">
      {/* Top Navigation / Header */}
      <header className="bg-gray-900 border-b border-gray-800 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4 flex flex-col sm:flex-row justify-between items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
              <span className="text-indigo-500">Sign</span>Speak
            </h1>
            <p className="text-sm text-gray-400 mt-1">Real-Time Sign Language Interpreter</p>
          </div>
          
          <div className="flex items-center gap-3 bg-gray-950 px-4 py-2 rounded-full border border-gray-800 shadow-inner">
            <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">Model Status</span>
            {isModelLoading ? (
              <div className="flex items-center gap-2">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-yellow-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-yellow-500"></span>
                </span>
                <span className="text-sm text-yellow-400 font-medium">Loading...</span>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]"></span>
                <span className="text-sm text-green-400 font-medium">Ready</span>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        
        {(modelError || cameraError) && (
          <div className="mb-6 p-4 bg-red-900/40 border border-red-500/50 rounded-xl text-red-200 text-sm flex flex-col gap-2">
            {cameraError && (
              <div className="flex items-start gap-3">
                <svg className="w-5 h-5 text-red-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
                <p>{cameraError}</p>
              </div>
            )}
            {modelError && (
              <div className="flex items-start gap-3">
                <svg className="w-5 h-5 text-red-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
                <p>{modelError}</p>
              </div>
            )}
          </div>
        )}

        <div className="flex flex-col lg:flex-row gap-8">
          
          {/* Left Column: Webcam Card */}
          <section className="w-full lg:w-[680px] flex flex-col gap-4">
            <div className="bg-gray-900 rounded-2xl border border-gray-800 p-4 shadow-xl flex flex-col items-center">
              <div className="w-full max-w-[640px] rounded-xl overflow-hidden bg-black border border-gray-800 shadow-inner">
                <WebcamFeed 
                  webcamRef={webcamRef} 
                  canvasRef={canvasRef} 
                  onMediaError={(err) => {
                    console.error("Webcam error:", err);
                    setCameraError("Camera access is required for real-time sign detection. Please allow webcam permission and reload the page.");
                  }} 
                />
              </div>
              
              {/* Hand Detection Status */}
              <div className="w-full mt-4 flex items-center justify-between px-2">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-400">Hand Tracking:</span>
                  {handDetected ? (
                    <span className="text-sm text-indigo-400 font-semibold bg-indigo-500/10 px-2 py-0.5 rounded border border-indigo-500/20">Active</span>
                  ) : (
                    <span className="text-sm text-gray-500 font-semibold bg-gray-800 px-2 py-0.5 rounded border border-gray-700">Waiting for hand...</span>
                  )}
                </div>
                
                {keyboardDemoActive && (
                  <span className="text-xs font-semibold text-blue-300 bg-blue-900/40 border border-blue-700/50 px-2 py-1 rounded-md animate-pulse">
                    Keyboard Demo Active
                  </span>
                )}
              </div>
            </div>
            
            {/* Prototype Limitations Note */}
            <div className="bg-gray-900/50 rounded-xl border border-gray-800/60 p-5">
              <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Prototype Limitations</h3>
              <p className="text-sm text-gray-400">
                This is a prototype. Some words or letters might not work properly due to the complex nature of translating 3D hand shapes into 2D webcam coordinates, finger occlusion (fingers blocking each other from the camera's view), and varying lighting conditions.
              </p>
            </div>
          </section>

          {/* Right Column: Recognition Card */}
          <section className="flex-1 flex flex-col gap-6">
            <div className="bg-gray-900 rounded-2xl border border-gray-800 p-6 flex flex-col h-full shadow-xl relative overflow-hidden">
              
              {/* Decorative background glow */}
              <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/5 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none"></div>

              <h2 className="text-lg font-semibold text-white mb-6 flex items-center gap-2">
                <svg className="w-5 h-5 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path></svg>
                Active Recognition
              </h2>

              {/* Huge Letter Display */}
              <div className="relative mb-8">
                <div className="flex items-center justify-center h-48 bg-gray-950 rounded-xl border border-gray-800 shadow-inner relative overflow-hidden group">
                  <span className={`text-9xl font-bold transition-all duration-200 z-10 ${activeDetectedLetter ? "text-white scale-110 drop-shadow-[0_0_20px_rgba(99,102,241,0.4)]" : "text-gray-800 scale-100"}`}>
                    {activeDetectedLetter || "-"}
                  </span>
                  
                  {/* Progress Bar inside letter display */}
                  <div className="absolute bottom-0 left-0 w-full h-1.5 bg-gray-900">
                    <div 
                      className="h-full bg-indigo-500 transition-all duration-100 ease-linear shadow-[0_0_10px_rgba(99,102,241,0.5)]"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* Gesture History */}
              <div className="flex justify-center mb-4 min-h-[32px]">
                {gestureHistory.length > 0 && (
                  <div className="flex gap-2 flex-wrap justify-center">
                    {gestureHistory.map((letter, index) => (
                      <span key={index} className="w-8 h-8 flex items-center justify-center bg-indigo-900/40 border border-indigo-500/50 rounded-md text-sm font-bold text-indigo-200 shadow-sm">
                        {letter}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Word & Sentence Terminals */}
              <div className="flex-1 flex flex-col gap-4">
                <div className="bg-black/50 p-4 rounded-xl border border-gray-800/80">
                  <div className="flex justify-between items-end mb-2">
                    <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-widest">Current Word</h3>
                  </div>
                  <p className="text-3xl font-mono text-white min-h-[40px] tracking-widest break-all">
                    {currentWord || <span className="text-gray-700 animate-pulse">_</span>}
                  </p>
                </div>

                <div className="bg-black/50 p-4 rounded-xl border border-gray-800/80 flex-1">
                  <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-2">Full Sentence</h3>
                  <p className="text-2xl font-mono text-indigo-300 min-h-[80px] leading-relaxed break-all">
                    {fullSentence || <span className="text-gray-700 italic">Start signing to build a sentence...</span>}
                  </p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-3 mt-6 pt-6 border-t border-gray-800">
                <button 
                  onClick={deleteLetter} 
                  className="px-4 py-3 bg-gray-800 hover:bg-gray-700 border border-gray-700 hover:border-gray-600 rounded-xl text-gray-200 transition-all font-medium text-sm flex items-center justify-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2M3 12l6.414 6.414a2 2 0 001.414.586H19a2 2 0 002-2V7a2 2 0 00-2-2h-8.172a2 2 0 00-1.414.586L3 12z"></path></svg>
                  Delete
                </button>
                <button 
                  onClick={clearAll} 
                  className="px-4 py-3 bg-red-950/30 hover:bg-red-900/50 border border-red-900/50 hover:border-red-700/50 rounded-xl text-red-300 transition-all font-medium text-sm flex items-center justify-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                  Clear
                </button>
                <button 
                  onClick={handleCopyText} 
                  disabled={!fullSentence}
                  className="px-4 py-3 bg-gray-800 hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed border border-gray-700 hover:border-gray-600 rounded-xl text-gray-200 transition-all font-medium text-sm flex items-center justify-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"></path></svg>
                  Copy Text
                </button>
                <button 
                  onClick={handleDownloadTranscript} 
                  disabled={!fullSentence}
                  className="px-4 py-3 bg-gray-800 hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed border border-gray-700 hover:border-gray-600 rounded-xl text-gray-200 transition-all font-medium text-sm flex items-center justify-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path></svg>
                  Download Transcript
                </button>
                <button 
                  onClick={speakAgain} 
                  className="col-span-2 sm:ml-auto px-6 py-3 bg-indigo-600 hover:bg-indigo-500 border border-indigo-500 hover:border-indigo-400 rounded-xl text-white transition-all font-medium text-sm flex items-center justify-center gap-2 shadow-[0_0_15px_rgba(79,70,229,0.3)] hover:shadow-[0_0_20px_rgba(79,70,229,0.5)]"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5 10v4a2 2 0 002 2h2.586a1 1 0 01.707.293l3.414 3.414a1 1 0 001.707-.707V5.414a1 1 0 00-1.707-.707L10.293 8.121A1 1 0 019.586 8.414H7a2 2 0 00-2 2z"></path></svg>
                  Speak Again
                </button>
              </div>
              
            </div>
          </section>
          
        </div>

        {/* How It Works Section */}
        <div className="mt-12 bg-gray-900/40 rounded-2xl border border-gray-800 p-8 shadow-inner">
          <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
            <svg className="w-5 h-5 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
            How It Works
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <div className="bg-gray-900 border border-gray-800 p-4 rounded-xl flex flex-col gap-2 shadow-sm">
              <span className="text-indigo-500 font-black text-2xl">1</span>
              <p className="text-sm text-gray-300 leading-relaxed">Webcam captures the user's hand.</p>
            </div>
            <div className="bg-gray-900 border border-gray-800 p-4 rounded-xl flex flex-col gap-2 shadow-sm">
              <span className="text-indigo-500 font-black text-2xl">2</span>
              <p className="text-sm text-gray-300 leading-relaxed">TensorFlow.js Handpose detects 21 hand landmarks.</p>
            </div>
            <div className="bg-gray-900 border border-gray-800 p-4 rounded-xl flex flex-col gap-2 shadow-sm">
              <span className="text-indigo-500 font-black text-2xl">3</span>
              <p className="text-sm text-gray-300 leading-relaxed">Fingerpose compares landmarks with selected ASL gesture rules.</p>
            </div>
            <div className="bg-gray-900 border border-gray-800 p-4 rounded-xl flex flex-col gap-2 shadow-sm">
              <span className="text-indigo-500 font-black text-2xl">4</span>
              <p className="text-sm text-gray-300 leading-relaxed">Stable letters are added to the current word.</p>
            </div>
            <div className="bg-gray-900 border border-gray-800 p-4 rounded-xl flex flex-col gap-2 shadow-sm">
              <span className="text-indigo-500 font-black text-2xl">5</span>
              <p className="text-sm text-gray-300 leading-relaxed">The Web Speech API speaks completed words.</p>
            </div>
          </div>
        </div>

      </div>
    </main>
  );
}

export default App;