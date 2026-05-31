/**
 * SignSpeak v2 — V2Demo Page
 *
 * Self-contained demonstration of the full v2 inference pipeline:
 *   Webcam → MediaPipe → frameBuffer → TF.js TCN → commit-stability logic → UI
 *
 * Isolated from v1. Mounted when URL contains ?v=2.
 *
 * Note: This is a research prototype. It recognises a limited set of
 * ASL word signs and is not a full ASL translator.
 */

import { useRef, useState, useCallback } from 'react';
import Webcam from 'react-webcam';
import { useV2HandDetection } from './hooks/useV2HandDetection';
import { useV2Prediction } from './hooks/useV2Prediction';
import V2PredictionBadge from './components/V2PredictionBadge';
import V2Overlay from './components/V2Overlay';

const WEBCAM_CONSTRAINTS = { width: 640, height: 480, facingMode: 'user' };

// Display name overrides (internal label -> display string)
const DISPLAY_LABELS = {
  THANKYOU: 'THANK YOU',
  ME: 'I / ME',
  FOOD: 'FOOD / EAT',
};
const toDisplayLabel = (label) => DISPLAY_LABELS[label] || label;

// Spoken / sentence labels — clean natural-language words for TTS output.
// Kept separate from DISPLAY_LABELS so slashes never leak into sentences.
const SPOKEN_LABELS = {
  ME: 'I',
  THANKYOU: 'thank you',
  FOOD: 'food',
  BATHROOM: 'bathroom',
};


const SUPPORTED_SIGNS = [
  'Hello', 'Yes', 'No', 'Help', 'Thank You', 'Please', 'Sorry', 'Good', 'Stop', 'Water',
  'I / Me', 'You', 'Want', 'Need', 'Food / Eat', 'More', 'Bathroom', 'Home', 'Sick', 'Where',
];

const PHRASE_MAP = {
  'ME WANT WATER': 'I want water.',
  'ME WANT FOOD': 'I want food.',
  'ME NEED HELP': 'I need help.',
  'ME NEED BATHROOM': 'I need the bathroom.',
  'ME SICK': 'I am sick.',
  'WHERE BATHROOM': 'Where is the bathroom?',
  'MORE WATER PLEASE': 'More water, please.',
};

const toFallbackWord = (label) => {
  return SPOKEN_LABELS[label] ?? label.toLowerCase();
};

const buildSentence = (labels) => {
  const key = labels.join(' ');
  if (PHRASE_MAP[key]) return PHRASE_MAP[key];
  return labels.map(toFallbackWord).join(' ');
};

export default function V2Demo() {
  const webcamRef = useRef(null);
  const canvasRef = useRef(null);

  const [committedWords, setCommittedWords] = useState([]);
  const [debug,          setDebug]          = useState(false);
  const [webcamReady,    setWebcamReady]    = useState(false);

  const commitWord = useCallback((label) => {
    setCommittedWords(prev => [...prev, label]);
  }, []);

  // ── Prediction hook ──────────────────────────────────────────────────────────
  const {
    runPrediction,
    resetPrediction,
    clearOnNoHand,
    liveLabel,
    liveConfidence,
    commitStatus,
    uncertain,
    uncertainMessage,
    correctionOptions,
    commitCorrection,
    modelReady,
    error: modelError,
  } = useV2Prediction({ onCommit: commitWord });

  // ── Hand detection hook ──────────────────────────────────────────────────────
  const { error: handError, handsDetectedCount } = useV2HandDetection({
    webcamRef,
    canvasRef,
    onSequenceReady: useCallback((seq, detectedCount) => {
      runPrediction(seq, detectedCount);
    }, [runPrediction]),
    onNoHand: clearOnNoHand,
    frameCount: 32,
    enabled: modelReady && webcamReady,
  });
  // ── Controls ─────────────────────────────────────────────────────────────────
  const deleteLastWord = () => setCommittedWords(prev => prev.slice(0, -1));

  const clearAll = () => {
    setCommittedWords([]);
    resetPrediction();
  };

  const speakSentence = () => {
    const sentence = buildSentence(committedWords).trim();
    if (!sentence || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const utt = new SpeechSynthesisUtterance(sentence);
    utt.lang = 'en-US'; utt.rate = 0.9; utt.pitch = 1;
    window.speechSynthesis.speak(utt);
  };

  const handleWebcamReady = useCallback(() => setWebcamReady(true), []);

  // ── UI text ───────────────────────────────────────────────────────────────────
  const detectingText = liveLabel ? toDisplayLabel(liveLabel) : null;

  // Status pill style
  const isStabilizing = commitStatus === 'Stabilizing…';
  const isCommitted   = commitStatus.startsWith('Committed:');
  const isUncertain   = uncertain;
  const pipelineError = modelError || handError;
  const showCorrections = correctionOptions.length > 0;

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <div style={styles.page}>
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
        {/* ── Camera column ── */}
        <section style={styles.cameraSection}>
          <div style={styles.cameraWrap}>
            <Webcam
              ref={webcamRef}
              videoConstraints={WEBCAM_CONSTRAINTS}
              style={styles.webcam}
              mirrored
              onUserMedia={handleWebcamReady}
            />
            <canvas ref={canvasRef} width={640} height={480} style={styles.canvas} />
            <V2Overlay
              debug={debug}
              stableLabel={liveLabel}
              confidence={liveConfidence}
            />
          </div>

          <div style={styles.badgeRow}>
            <V2PredictionBadge
              label={detectingText}
              confidence={liveConfidence}
              modelReady={modelReady}
              error={pipelineError}
              uncertain={uncertain}
              uncertainMessage={uncertainMessage}
            />
          </div>

          <div style={styles.handCount}>
            Hands detected: {handsDetectedCount}
          </div>

          <div style={styles.controls}>
            <button style={styles.ctrlBtn} onClick={deleteLastWord}>⌫ Delete</button>
            <button style={{ ...styles.ctrlBtn, ...styles.ctrlBtnDanger }} onClick={clearAll}>✕ Clear</button>
          </div>
        </section>

        {/* ── Transcript column ── */}
        <section style={styles.transcriptSection}>
          <h2 style={styles.sectionTitle}>Live Transcript</h2>

          {/* Detection row: live label + status pill */}
          <div style={styles.currentWord}>
            <span style={styles.currentWordLabel}>Detecting:</span>
            <span style={{
              ...styles.currentWordText,
              ...(uncertain ? styles.currentWordUncertain : {}),
              ...(isCommitted ? styles.currentWordCommitted : {}),
            }}>
              {uncertain
                ? <span style={{ fontSize: 15, letterSpacing: 'normal' }}>⚖️ {uncertainMessage ?? 'Uncertain gesture'}</span>
                : detectingText
                ? detectingText
                : <span style={styles.placeholder}>—</span>
              }
            </span>
            {/* Commit status pill */}
            {liveLabel && (
              <span style={{
                ...styles.statusPill,
                ...(isStabilizing ? styles.pillStabilizing : {}),
                ...(isCommitted   ? styles.pillCommitted   : {}),
                ...(isUncertain   ? styles.pillUncertain   : {}),
              }}>
                {isStabilizing ? '⏱ Stabilizing' : isCommitted ? '✓ Added' : isUncertain ? '⚖ Hold sign' : '● Detecting'}
              </span>
            )}
          </div>

          {showCorrections && (
            <div style={styles.correctionPanel}>
              <span style={styles.correctionLabel}>Choose correction:</span>
              <div style={styles.correctionButtons}>
                {correctionOptions.map(option => (
                  <button
                    key={option.label}
                    type="button"
                    style={styles.correctionBtn}
                    onClick={() => commitCorrection(option.label)}
                  >
                    {toDisplayLabel(option.label)}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Detected words */}
          <div>
            <p style={styles.fieldLabel}>Detected words:</p>
            <div style={styles.wordList}>
              {committedWords.length > 0
                ? committedWords.map((w, i) => <span key={i} style={styles.wordChip}>{toDisplayLabel(w)}</span>)
                : <span style={styles.placeholder}>Signs detected will appear here.</span>
              }
            </div>
          </div>

          {/* Sentence + speak */}
          <div style={styles.sentenceRow}>
            <p style={styles.sentence}>
              {committedWords.length > 0 ? buildSentence(committedWords) : 'Your sentence will appear here…'}
            </p>
            <button style={styles.speakBtn} onClick={speakSentence}>🔊 Speak</button>
          </div>

          {/* Model loading / error cards */}
          {!modelReady && !modelError && (
            <div style={styles.statusCard}>
              <div style={styles.spinner} />
              <div>
                <p style={styles.statusTitle}>Loading TCN model…</p>
                <p style={styles.statusSub}>Place exported TF.js files in <code>public/v2/model/</code> then refresh.</p>
              </div>
            </div>
          )}
          {modelError && (
            <div style={{ ...styles.statusCard, borderColor: 'rgba(255,107,107,0.2)' }}>
              <span style={{ fontSize: 24 }}>⚠️</span>
              <div>
                <p style={styles.statusTitle}>Model not found</p>
                <p style={styles.statusSub}>Run <code>python training/05_export_tfjs.py</code>, then place files in <code>public/v2/model/</code>.</p>
              </div>
            </div>
          )}
          {handError && (
            <div style={{ ...styles.statusCard, borderColor: 'rgba(255,107,107,0.2)' }}>
              <span style={{ fontSize: 24 }}>⚠️</span>
              <div>
                <p style={styles.statusTitle}>Hand tracking unavailable</p>
                <p style={styles.statusSub}>{handError}</p>
              </div>
            </div>
          )}

          {/* How to use */}
          <div style={styles.hintBox}>
            <p style={styles.hintTitle}>How it works</p>
            <ol style={styles.hintList}>
              <li>Perform a supported ASL word sign clearly in the camera frame.</li>
              <li>Words commit automatically after a brief stability check (~300ms).</li>
              <li>Lower your hand briefly between words to allow the same sign again.</li>
              <li>Press <strong>Speak</strong> to hear the full sentence.</li>
            </ol>
            <p style={{ ...styles.hintList, marginTop: 8, paddingLeft: 0, listStyle: 'none' }}>
              <strong>Supported:</strong> {SUPPORTED_SIGNS.join(' · ')}
            </p>
            <p style={styles.disclaimer}>
              ⓘ Prototype — limited vocabulary, not a full ASL translator.
            </p>
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
    display: 'flex', flexDirection: 'column',
  },
  header: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '16px 28px',
    borderBottom: '1px solid rgba(255,255,255,0.07)',
    backdropFilter: 'blur(8px)', background: 'rgba(255,255,255,0.03)',
  },
  logoWrap: { display: 'flex', alignItems: 'center', gap: 10 },
  logoGlyph: { fontSize: 26 },
  logoText:  { fontSize: 20, fontWeight: 800, letterSpacing: '-0.02em', color: '#fff' },
  v2Badge: {
    fontSize: 10, fontWeight: 700, letterSpacing: '0.1em',
    padding: '2px 8px', borderRadius: 20,
    background: 'linear-gradient(135deg, #6c63ff, #48cfad)',
    color: '#fff', textTransform: 'uppercase',
  },
  nav: { display: 'flex', gap: 10 },
  navBtn: {
    padding: '6px 14px', borderRadius: 8, fontSize: 13, cursor: 'pointer',
    background: 'rgba(255,255,255,0.07)',
    borderWidth: 1, borderStyle: 'solid', borderColor: 'rgba(255,255,255,0.12)',
    color: '#e0e0e0', textDecoration: 'none', transition: 'background 0.2s',
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
  canvas: { position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none' },
  badgeRow: { display: 'flex', justifyContent: 'center' },
  handCount: {
    fontSize: 12,
    fontWeight: 700,
    letterSpacing: '0.04em',
    color: 'rgba(255,255,255,0.55)',
    textTransform: 'uppercase',
  },
  controls: { display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center' },
  ctrlBtn: {
    padding: '9px 20px', borderRadius: 10,
    borderWidth: 1, borderStyle: 'solid', borderColor: 'rgba(255,255,255,0.12)',
    background: 'rgba(255,255,255,0.07)', color: '#fff', fontSize: 14,
    cursor: 'pointer', fontWeight: 600, transition: 'background 0.18s',
  },
  ctrlBtnDanger: { background: 'rgba(229,83,83,0.18)', borderColor: 'rgba(229,83,83,0.35)' },
  transcriptSection: { flex: 1, minWidth: 280, maxWidth: 480, display: 'flex', flexDirection: 'column', gap: 18 },
  sectionTitle: {
    margin: 0, fontSize: 18, fontWeight: 700, color: '#fff',
    borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: 10,
  },
  currentWord: {
    padding: '14px 18px', borderRadius: 12,
    background: 'rgba(108,99,255,0.1)', border: '1px solid rgba(108,99,255,0.3)',
    display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap',
  },
  currentWordLabel: {
    fontSize: 11, color: 'rgba(255,255,255,0.4)',
    textTransform: 'uppercase', letterSpacing: '0.08em', flexShrink: 0,
  },
  currentWordText: {
    fontSize: 32, fontWeight: 800, fontFamily: 'monospace',
    color: '#fff', letterSpacing: '0.12em', flex: 1,
  },
  currentWordUncertain: {
    fontSize: 15, fontWeight: 600, color: '#f0b429',
    fontFamily: 'inherit', letterSpacing: 'normal',
  },
  currentWordCommitted: { color: '#48cfad' },
  placeholder: { color: 'rgba(255,255,255,0.2)', fontStyle: 'italic', fontSize: 13 },

  // Status pill
  statusPill: {
    fontSize: 10, fontWeight: 700, letterSpacing: '0.06em',
    padding: '3px 10px', borderRadius: 20,
    background: 'rgba(255,255,255,0.08)',
    borderWidth: 1, borderStyle: 'solid', borderColor: 'rgba(255,255,255,0.15)',
    color: 'rgba(255,255,255,0.45)',
    whiteSpace: 'nowrap', alignSelf: 'center',
  },
  pillStabilizing: {
    background: 'rgba(240,180,41,0.15)',
    borderColor: 'rgba(240,180,41,0.4)',
    color: '#f0b429',
  },
  pillCommitted: {
    background: 'rgba(72,207,173,0.18)',
    borderColor: 'rgba(72,207,173,0.45)',
    color: '#48cfad',
  },
  pillUncertain: {
    background: 'rgba(229,83,83,0.15)',
    borderColor: 'rgba(229,83,83,0.35)',
    color: '#ff6b6b',
  },
  correctionPanel: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    flexWrap: 'wrap',
    padding: '10px 12px',
    borderRadius: 10,
    background: 'rgba(240,180,41,0.09)',
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: 'rgba(240,180,41,0.24)',
  },
  correctionLabel: {
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: '0.06em',
    color: '#f0b429',
    textTransform: 'uppercase',
  },
  correctionButtons: {
    display: 'flex',
    gap: 8,
    flexWrap: 'wrap',
  },
  correctionBtn: {
    padding: '7px 12px',
    borderRadius: 8,
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: 'rgba(240,180,41,0.42)',
    background: 'rgba(240,180,41,0.16)',
    color: '#fff',
    fontSize: 13,
    fontWeight: 700,
    cursor: 'pointer',
  },

  fieldLabel: { margin: '0 0 8px', fontSize: 11, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.08em' },
  wordList: { display: 'flex', flexWrap: 'wrap', gap: 8, minHeight: 36 },
  wordChip: {
    padding: '5px 14px', borderRadius: 20,
    background: 'rgba(72,207,173,0.15)',
    borderWidth: 1, borderStyle: 'solid', borderColor: 'rgba(72,207,173,0.35)',
    color: '#48cfad', fontWeight: 600, fontSize: 14,
  },
  sentenceRow: {
    padding: '16px 18px', borderRadius: 12,
    background: 'rgba(255,255,255,0.04)',
    borderWidth: 1, borderStyle: 'solid', borderColor: 'rgba(255,255,255,0.09)',
    display: 'flex', alignItems: 'flex-start', gap: 12,
  },
  sentence: { flex: 1, margin: 0, fontSize: 16, lineHeight: 1.5, color: 'rgba(255,255,255,0.8)' },
  speakBtn: {
    padding: '8px 16px', borderRadius: 9,
    borderWidth: 0, borderStyle: 'solid', borderColor: 'transparent',
    cursor: 'pointer',
    background: 'linear-gradient(135deg, #6c63ff, #48cfad)', color: '#fff',
    fontSize: 13, fontWeight: 700, whiteSpace: 'nowrap', flexShrink: 0,
  },
  statusCard: {
    display: 'flex', alignItems: 'flex-start', gap: 14, padding: '14px 18px',
    borderRadius: 12, borderWidth: 1, borderStyle: 'solid',
    borderColor: 'rgba(108,99,255,0.25)', background: 'rgba(108,99,255,0.07)',
  },
  spinner: {
    width: 24, height: 24, flexShrink: 0, marginTop: 2,
    borderWidth: 3, borderStyle: 'solid', borderColor: 'rgba(108,99,255,0.2)',
    borderTopColor: '#6c63ff',
    borderRadius: '50%', animation: 'spin 0.9s linear infinite',
  },
  statusTitle: { margin: '0 0 4px', fontWeight: 700, color: '#fff', fontSize: 14 },
  statusSub:   { margin: 0, fontSize: 12, color: 'rgba(255,255,255,0.45)', lineHeight: 1.5 },
  hintBox: {
    padding: '14px 18px', borderRadius: 12,
    background: 'rgba(255,255,255,0.03)',
    borderWidth: 1, borderStyle: 'solid', borderColor: 'rgba(255,255,255,0.07)',
  },
  hintTitle: { margin: '0 0 8px', fontWeight: 700, fontSize: 13, color: 'rgba(255,255,255,0.55)', textTransform: 'uppercase', letterSpacing: '0.07em' },
  hintList:  { margin: 0, paddingLeft: 20, fontSize: 13, lineHeight: 1.8, color: 'rgba(255,255,255,0.5)' },
  disclaimer: { margin: '8px 0 0', fontSize: 11, color: 'rgba(255,255,255,0.3)', fontStyle: 'italic' },
};
