// Toast.jsx — show a brief status message. No redundant `visible` state;
// the component simply renders when message is non-empty.
export default function Toast({ message }) {
  if (!message) return null;

  return (
    <div
      className="fixed bottom-6 right-6 z-[200] flex items-center gap-2 px-5 py-3 rounded-xl bg-indigo-600 border border-indigo-400 text-white text-sm font-semibold shadow-[0_0_20px_rgba(79,70,229,0.5)] animate-fade-in-up"
      role="status"
      aria-live="polite"
    >
      <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
      </svg>
      {message}
    </div>
  );
}
