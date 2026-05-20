/**
 * SignSpeak v2 — V2Demo Page
 *
 * Self-contained demonstration of the full v2 inference pipeline:
 *   Webcam → MediaPipe → frameBuffer → TF.js TCN → smoother → UI
 *
 * This page is completely isolated from v1 (App.jsx / gestureDetector.js).
 * It is mounted when the URL contains ?v=2 (see main.jsx routing bridge).
 *
 * Remove the ?v=2 flag to return to the v1 app at any time.
 */

import React, { useRef, useState, useCallback } from 'react';
import Webcam from 'react-webcam';
import { useV2HandDetection } from '../hooks/useV2HandDetection';
import { useV2Prediction } from '../hooks/useV2Prediction';
import V2PredictionBadge from '../components/V2PredictionBadge';
import V2Overlay from '../components/V2Overlay';

// ─── Constants ────────────────────────────────────────────────────────────────
const WEBCAM_CONSTRAINTS = { width: 640, height: 480, facingMode: 'user' };
const COMMIT_HOLD_MS = 1200; // how long a stable label must persist before commit

export default function V2Demo() {
  const webcamRef = useRef(null);
  const canvasRef = useRef(null);

  // Transcript
  const [transcript, setTranscript] = useState('');
  const [words, setWords]           = useState([]);
  const [debug, setDebug]           = useState(false);
  const [webcamReady, setWebcamReady] = useState(false);

  // Internal: track committed letter timing
  const lastCommitRef  = useRef(null);
  const lastLabelRef   = useRef(null);
  const holdStartRef   = useRef(null);

  // ─── Prediction hook ────────────────────────────────────────────────────────
  const {
    runPrediction,
    resetSmoother,
    stableLabel,
    confidence,
    modelReady,
    error: modelError,
  } = useV2Prediction({ smootherWindow: 10, smootherThreshold: 0.6 });

  // ─── Commit logic ───────────────────────────────────────────────────────────
  // A letter is committed when it remains stable for COMMIT_HOLD_MS without
  // having been the last committed letter (prevents repeat firing).
  const tryCommit = useCallback((label) => {
    if (!label) {
      holdStartRef.current = null;
      return;
    }
    if (label !== lastLabelRef.current) {
      holdStartRef.current = Date.now();
      lastLabelRef.current = label;
    }
    const held = Date.now() - (holdStartRef.current ?? Date.now());
    if (held >= COMMIT_HOLD_MS && label !== lastCommitRef.current) {
      lastCommitRef.current = label;
      setTranscript(prev => prev + label);
      resetSmoother();
    }
  }, [resetSmoother]);

  // ─── Detection hook ─────────────────────────────────────────────────────────
  useV2HandDetection({
    webcamRef,
    canvasRef,
    onSequenceReady: useCallback((seq) => {
      runPrediction(seq);
    }, [runPrediction]),
    frameCount: 32,
    enabled: modelReady && webcamReady,
  });

  // Commit side-effect whenever stableLabel changes
  React.useEffect(() => {
    tryCommit(stableLabel);
  }, [stableLabel, tryCommit]);

  // ─── Word builder ───────────────────────────────────────────────────────────
  const commitSpace = () => {
    const word = transcript.trim();
    if (word) setWords(prev => [...prev, word]);
    setTranscript('');
    lastCommitRef.current = null;
  };

  const deleteLastChar = () => {
    setTranscript(prev => prev.slice(0, -1));
    lastCommitRef.current = null;
  };

  const clearAll = () => {
    setTranscript('');
    setWords([]);
    lastCommitRef.current = null;
  };

  const speakSentence = () => {
    const sentence = [...words, transcript].join(' ').trim();
    if (!sentence) return;
    const utt = new SpeechSynthesisUtterance(sentence);
    window.speechSynthesis.speak(utt);
  };

  // ─── Webcam readiness ───────────────────────────────────────────────────────
  // Set webcamReady=true once the stream is playing so detection only starts
  // after both the model AND the video feed are confirmed active.
  const handleWebcamReady = useCallback(() => {
    setWebcamReady(true);
  }, []);

  // ─── Render ─────────────────────────────────────────────────────────────────
  return (
    <div style={styles.page}>
      {/* Header */}
      <header style={styles.header}>
        <div style={styles.logoWrap}>
          <span style={styles.logoGlyph}>🤟</span>
          <span style={styles.logoText}>SignSpeak</span>
          <span style={styles.v2Badge}>v2 TCN</span>
        </div>
        <nav style={styles.nav}>
          <button
            style={{ ...styles.navBtn, ...(debug ? styles.navBtnActive : {}) }}
            onClick={() => setDebug(d => !d)}
          >
            {debug ? '🐛 Debug ON' : '🐛 Debug'}
          </button>
          <a href="?" style={styles.navBtn}>← Back to v1</a>
        </nav>
      </header>

      <main style={styles.main}>
        {/* ── Webcam column ── */}
        <section style={styles.cameraSection}>
          <div style={styles.cameraWrap}>
            <Webcam
              ref={webcamRef}
              videoConstraints={WEBCAM_CONSTRAINTS}
              style={styles.webcam}
              mirrored
              onUserMedia={handleWebcamReady}
            />
            {/* Landmark debug canvas — overlaid on webcam */}
            <canvas
              ref={canvasRef}
              width={640}
              height={480}
              style={styles.canvas}
            />
            {/* Debug overlay (raw label, confidence, history) */}
            <V2Overlay
              debug={debug}
              stableLabel={stableLabel}
              confidence={confidence}
            />
          </div>

          {/* Prediction badge */}
          <div style={styles.badgeRow}>
            <V2PredictionBadge
              label={stableLabel}
              confidence={confidence}
              modelReady={modelReady}
              error={modelError}
            />
          </div>

          {/* Controls */}
          <div style={styles.controls}>
            <button style={styles.ctrlBtn} onClick={commitSpace} title="Add space / commit word">
              ⎵ Space
            </button>
            <button style={styles.ctrlBtn} onClick={deleteLastChar} title="Delete last letter">
              ⌫ Delete
            </button>
            <button style={{ ...styles.ctrlBtn, ...styles.ctrlBtnDanger }} onClick={clearAll}>
              ✕ Clear
            </button>
          </div>
        </section>

        {/* ── Transcript column ── */}
        <section style={styles.transcriptSection}>
          <h2 style={styles.sectionTitle}>Live Transcript</h2>

          {/* Current letter buffer */}
          <div style={styles.currentWord}>
            <span style={styles.currentWordLabel}>Spelling:</span>
            <span style={styles.currentWordText}>{transcript || <span style={styles.placeholder}>—</span>}</span>
          </div>

          {/* Word history */}
          <div style={styles.wordList}>
            {words.map((w, i) => (
              <span key={i} style={styles.wordChip}>{w}</span>
            ))}
          </div>

          {/* Sentence read-back */}
          <div style={styles.sentenceRow}>
            <p style={styles.sentence}>
              {[...words, transcript].join(' ').trim() || 'Your sentence will appear here…'}
            </p>
            <button style={styles.speakBtn} onClick={speakSentence}>
              🔊 Speak
            </button>
          </div>

          {/* Model status card */}
          {!modelReady && !modelError && (
            <div style={styles.statusCard}>
              <div style={styles.spinner} />
              <div>
                <p style={styles.statusTitle}>Loading TCN model…</p>
                <p style={styles.statusSub}>
                  Place exported TF.js files in <code>public/v2/model/</code> then refresh.
                </p>
              </div>
            </div>
          )}
          {modelError && (
            <div style={{ ...styles.statusCard, borderColor: '#ff6b6b33' }}>
              <span style={{ fontSize: 24 }}>⚠️</span>
              <div>
                <p style={styles.statusTitle}>Model not found</p>
                <p style={styles.statusSub}>
                  Run <code>python training/05_export_tfjs.py</code> to export the model,
                  then place the files in <code>public/v2/model/</code>.
                </p>
              </div>
            </div>
          )}

          {/* How-to hint */}
          <div style={styles.hintBox}>
            <p style={styles.hintTitle}>How it works</p>
            <ol style={styles.hintList}>
              <li>Show your hand clearly in the camera frame.</li>
              <li>Hold an ASL letter sign for ~1 second — it will commit automatically.</li>
              <li>Press <strong>Space</strong> to end a word, <strong>Delete</strong> to undo a letter.</li>
              <li>Press <strong>Speak</strong> to hear the full sentence.</li>
            </ol>
          </div>
        </section>
      </main>
    </div>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────────────
const styles = {
  page: {
    minHeight: '100vh',
    background: 'linear-gradient(135deg, #0f0c29 0%, #1a1040 50%, #0f0c29 100%)',
    color: '#e0e0e0',
    fontFamily: "'Inter', 'Segoe UI', sans-serif",
    display: 'flex',
    flexDirection: 'column',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '16px 28px',
    borderBottom: '1px solid rgba(255,255,255,0.07)',
    backdropFilter: 'blur(8px)',
    background: 'rgba(255,255,255,0.03)',
  },
  logoWrap: { display: 'flex', alignItems: 'center', gap: 10 },
  logoGlyph: { fontSize: 26 },
  logoText: { fontSize: 20, fontWeight: 800, letterSpacing: '-0.02em', color: '#fff' },
  v2Badge: {
    fontSize: 10, fontWeight: 700, letterSpacing: '0.1em',
    padding: '2px 8px', borderRadius: 20,
    background: 'linear-gradient(135deg, #6c63ff, #48cfad)',
    color: '#fff', textTransform: 'uppercase',
  },
  nav: { display: 'flex', gap: 10 },
  navBtn: {
    padding: '6px 14px', borderRadius: 8, fontSize: 13, cursor: 'pointer',
    background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)',
    color: '#e0e0e0', textDecoration: 'none',
    transition: 'background 0.2s',
  },
  navBtnActive: { background: 'rgba(108,99,255,0.3)', borderColor: '#6c63ff' },
  main: {
    flex: 1, display: 'flex', gap: 28, padding: '28px',
    flexWrap: 'wrap', justifyContent: 'center',
  },
  cameraSection: {
    display: 'flex', flexDirection: 'column', gap: 16,
    alignItems: 'center', minWidth: 320,
  },
  cameraWrap: { position: 'relative', borderRadius: 16, overflow: 'hidden', lineHeight: 0 },
  webcam: { width: '100%', maxWidth: 560, display: 'block', borderRadius: 16 },
  canvas: {
    position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
    pointerEvents: 'none',
  },
  badgeRow: { display: 'flex', justifyContent: 'center' },
  controls: { display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center' },
  ctrlBtn: {
    padding: '9px 20px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.12)',
    background: 'rgba(255,255,255,0.07)', color: '#fff', fontSize: 14,
    cursor: 'pointer', fontWeight: 600, transition: 'background 0.18s',
  },
  ctrlBtnDanger: { background: 'rgba(229,83,83,0.18)', borderColor: 'rgba(229,83,83,0.35)' },
  transcriptSection: {
    flex: 1, minWidth: 280, maxWidth: 480,
    display: 'flex', flexDirection: 'column', gap: 18,
  },
  sectionTitle: {
    margin: 0, fontSize: 18, fontWeight: 700, color: '#fff',
    borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: 10,
  },
  currentWord: {
    padding: '14px 18px', borderRadius: 12,
    background: 'rgba(108,99,255,0.1)', border: '1px solid rgba(108,99,255,0.3)',
    display: 'flex', alignItems: 'baseline', gap: 10,
  },
  currentWordLabel: { fontSize: 11, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.08em' },
  currentWordText: { fontSize: 32, fontWeight: 800, fontFamily: 'monospace', color: '#fff', letterSpacing: '0.12em' },
  placeholder: { color: 'rgba(255,255,255,0.2)' },
  wordList: { display: 'flex', flexWrap: 'wrap', gap: 8, minHeight: 36 },
  wordChip: {
    padding: '5px 14px', borderRadius: 20, background: 'rgba(72,207,173,0.15)',
    border: '1px solid rgba(72,207,173,0.35)', color: '#48cfad', fontWeight: 600, fontSize: 14,
  },
  sentenceRow: {
    padding: '16px 18px', borderRadius: 12,
    background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.09)',
    display: 'flex', alignItems: 'flex-start', gap: 12,
  },
  sentence: { flex: 1, margin: 0, fontSize: 16, lineHeight: 1.5, color: 'rgba(255,255,255,0.8)' },
  speakBtn: {
    padding: '8px 16px', borderRadius: 9, border: 'none', cursor: 'pointer',
    background: 'linear-gradient(135deg, #6c63ff, #48cfad)', color: '#fff',
    fontSize: 13, fontWeight: 700, whiteSpace: 'nowrap', flexShrink: 0,
  },
  statusCard: {
    display: 'flex', alignItems: 'flex-start', gap: 14, padding: '14px 18px',
    borderRadius: 12, border: '1px solid rgba(108,99,255,0.25)',
    background: 'rgba(108,99,255,0.07)',
  },
  spinner: {
    width: 24, height: 24, flexShrink: 0, marginTop: 2,
    border: '3px solid rgba(108,99,255,0.2)',
    borderTop: '3px solid #6c63ff', borderRadius: '50%',
    animation: 'spin 0.9s linear infinite',
  },
  statusTitle: { margin: '0 0 4px', fontWeight: 700, color: '#fff', fontSize: 14 },
  statusSub: { margin: 0, fontSize: 12, color: 'rgba(255,255,255,0.45)', lineHeight: 1.5 },
  hintBox: {
    padding: '14px 18px', borderRadius: 12,
    background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)',
  },
  hintTitle: { margin: '0 0 8px', fontWeight: 700, fontSize: 13, color: 'rgba(255,255,255,0.55)', textTransform: 'uppercase', letterSpacing: '0.07em' },
  hintList: { margin: 0, paddingLeft: 20, fontSize: 13, lineHeight: 1.8, color: 'rgba(255,255,255,0.5)' },
};
