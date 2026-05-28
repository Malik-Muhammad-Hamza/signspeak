import { useEffect } from 'react';

const SUPPORTED_LETTERS = ['A', 'B', 'C', 'D', 'L', 'V', 'Y', 'I', 'O', 'W', 'M', 'Z', 'H', 'E', 'F', 'G'];

const GESTURE_GUIDE = [
  { letter: 'A', description: 'Make a fist with all fingers curled. Keep the thumb along the side of the fist, slightly exposed.' },
  { letter: 'B', description: 'Keep all four fingers straight and together. Fold the thumb across the palm.' },
  { letter: 'C', description: 'Curve all fingers and thumb to form a C-like shape.' },
  { letter: 'D', description: 'Point the index finger upward. Curl the middle, ring, and pinky fingers. Touch the thumb near the curled fingers.' },
  { letter: 'L', description: 'Extend the thumb and index finger to form an L shape. Curl the remaining fingers.' },
  { letter: 'V', description: 'Extend the index and middle fingers apart like a V. Curl the ring and pinky fingers.' },
  { letter: 'Y', description: 'Extend the thumb and pinky finger. Curl the index, middle, and ring fingers.' },
  { letter: 'I', description: 'Extend only the pinky finger. Curl the thumb, index, middle, and ring fingers.' },
  { letter: 'O', description: 'Curve all fingers and thumb together to form an O shape.' },
  { letter: 'W', description: 'Extend the index, middle, and ring fingers. Curl the pinky and thumb.' },
  { letter: 'M', description: 'Make a closed fist with the thumb tucked under/behind the index, middle, and ring fingers. Unlike A, the thumb should not be exposed or sticking out.' },
  { letter: 'Z', description: 'Extend the index finger while keeping all other fingers curled. In real ASL, Z is drawn as a motion gesture in the air. This prototype uses a simplified static index-finger pose.' },
  { letter: 'H', description: 'Extend the index and middle fingers together sideways (horizontally). Curl the thumb, ring, and pinky. Unlike V, the two extended fingers point horizontally, not upward.' },
  { letter: 'E', description: 'Bend all four fingers downward/hooked and tuck the thumb closed against the fingers. Keep the hand compact. Unlike A, the thumb should not stick out.' },
  { letter: 'F', description: 'Touch the thumb and index finger together to form a small loop, like an OK shape. Keep the middle, ring, and pinky fingers extended upward.' },
  { letter: 'G', description: 'Point the index finger sideways/forward. Keep the thumb visible below or near the index finger (slightly bent or open). Curl the middle, ring, and pinky fingers. Unlike L, the index points sideways instead of upward.' }
];

export default function HowToUseModal({ isOpen, onClose }) {
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 bg-black/80 z-[100] flex items-center justify-center p-4 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
    >
      <div 
        className="bg-gray-900 w-full max-w-3xl max-h-[90vh] rounded-2xl border border-gray-700 shadow-2xl flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-800 shrink-0">
          <h2 id="modal-title" className="text-xl font-bold text-white">How to Use SignSpeak</h2>
          <button 
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors p-1 rounded-md hover:bg-gray-800"
            aria-label="Close modal"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto space-y-8 flex-1 text-gray-300">
          <p className="text-base leading-relaxed">
            SignSpeak is a browser-based prototype that recognizes selected ASL alphabet hand gestures through your webcam and converts stable signs into text and speech.
          </p>

          <section>
            <h3 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
              <span className="text-indigo-400">1.</span> Getting Started
            </h3>
            <ol className="list-decimal list-inside space-y-2 ml-2">
              <li>Open the app in Chrome.</li>
              <li>Allow camera permission when asked.</li>
              <li>Keep your hand clearly visible inside the webcam frame.</li>
              <li>Use good lighting and a plain background for better detection.</li>
              <li>Hold each sign steady until the progress bar completes.</li>
            </ol>
          </section>

          <section>
            <h3 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
              <span className="text-indigo-400">2.</span> Supported Gesture Letters
            </h3>
            <div className="flex flex-wrap gap-2 mb-3">
              {SUPPORTED_LETTERS.map(letter => (
                <span key={letter} className="w-10 h-10 flex items-center justify-center bg-indigo-900/40 border border-indigo-500/50 rounded-lg text-lg font-bold text-indigo-200 shadow-sm">
                  {letter}
                </span>
              ))}
            </div>
            <p className="text-sm bg-gray-800/50 p-3 rounded-lg border border-gray-700/50">
              <strong className="text-gray-200">Note:</strong> This prototype currently supports selected ASL alphabet gestures only. Unsupported signs may not be detected correctly.
            </p>
          </section>

          <section>
            <h3 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
              <span className="text-indigo-400">3.</span> Gesture Guide
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {GESTURE_GUIDE.map(({ letter, description }) => (
                <div key={letter} className="flex gap-3 bg-gray-800/30 p-3 rounded-lg border border-gray-700/30">
                  <span className="shrink-0 w-8 h-8 flex items-center justify-center bg-gray-800 rounded text-indigo-400 font-bold border border-gray-700">
                    {letter}
                  </span>
                  <p className="text-sm text-gray-400">{description}</p>
                </div>
              ))}
            </div>
          </section>

          <section>
            <h3 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
              <span className="text-indigo-400">4.</span> Timing and Word Formation
            </h3>
            <ul className="list-disc list-outside space-y-2 ml-5">
              <li>The app does not add a letter immediately.</li>
              <li>A sign must stay stable for about 1.2 seconds before it is added.</li>
              <li>The progress bar shows how close the current sign is to being accepted.</li>
              <li>This delay prevents repeated letters from being added accidentally.</li>
              <li>After a letter is accepted, change your hand sign or briefly reset your hand before adding the next letter.</li>
            </ul>
          </section>

          <section>
            <h3 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
              <span className="text-indigo-400">5.</span> Sentence Formation
            </h3>
            <ul className="list-disc list-outside space-y-2 ml-5">
              <li>Letters are added into the current word.</li>
              <li>When no hand/sign is detected for about 2 seconds, the current word is completed.</li>
              <li>Completed words are moved into the full sentence.</li>
              <li>The app then speaks the completed word or sentence depending on the current implementation.</li>
              <li>Use the <strong className="text-white">Delete</strong> button to remove the last letter.</li>
              <li>Use the <strong className="text-white">Clear</strong> button to reset the current word and full sentence.</li>
              <li>Use <strong className="text-white">Speak Again</strong> to repeat the generated text.</li>
            </ul>
          </section>

          <section>
            <h3 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
              <span className="text-indigo-400">6.</span> Best Results
            </h3>
            <ul className="list-disc list-outside space-y-2 ml-5">
              <li>Use a front-facing camera.</li>
              <li>Keep your hand inside the frame.</li>
              <li>Avoid fast movement.</li>
              <li>Avoid very dark lighting.</li>
              <li>Keep the palm angle consistent.</li>
              <li>Test the supported signs first before forming words.</li>
            </ul>
          </section>

          <section>
            <h3 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
              <span className="text-indigo-400">7.</span> Limitations
            </h3>
            <ul className="list-disc list-outside space-y-2 ml-5">
              <li>This is a prototype, not a complete sign language translator.</li>
              <li>It recognizes selected static ASL alphabet signs only.</li>
              <li>Accuracy depends on lighting, camera quality, hand position, and gesture similarity.</li>
              <li>Some similar signs may require careful hand positioning.</li>
              <li><strong className="text-gray-200">Z</strong> is normally a dynamic ASL sign (drawn as a Z in the air). This prototype uses a simplified static index-finger pose, which may conflict with similar signs like D.</li>
              <li><strong className="text-gray-200">M</strong> requires careful thumb tucking to distinguish it from A. Keep the thumb fully inside the fist.</li>
              <li><strong className="text-gray-200">H</strong> may be confused with V if the fingers point upward instead of sideways. Rotate the hand so the fingers point horizontally.</li>
              <li><strong className="text-gray-200">E</strong> may resemble A or M; ensure the thumb is tucked against the bent fingertips, not sticking out.</li>
              <li><strong className="text-gray-200">F</strong> may be confused with O if the middle, ring, and pinky fingers are not clearly extended upward.</li>
              <li><strong className="text-gray-200">G</strong> may be confused with L or H; ensure the index finger points sideways rather than upward.</li>
            </ul>
          </section>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-800 bg-gray-900 shrink-0 flex justify-end">
          <button 
            onClick={onClose}
            className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-medium transition-colors shadow-lg shadow-indigo-500/20"
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  );
}
