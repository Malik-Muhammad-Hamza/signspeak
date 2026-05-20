/**
 * SignSpeak v2 — V2PredictionBadge
 *
 * Displays the current stable prediction label and confidence bar.
 * Designed to be dropped into the existing UI alongside v1 output.
 *
 * Props
 * -----
 * label       {string|null}  Stable predicted label (e.g. "A")
 * confidence  {number}       0–1 confidence of the top-1 class
 * modelReady  {boolean}      Shows a loading state when false
 * error       {string|null}  Shows error state when non-null
 */

import React from 'react';

export default function V2PredictionBadge({ label, confidence, modelReady, error }) {
  if (error) {
    return (
      <div style={styles.container}>
        <span style={styles.errorIcon}>⚠️</span>
        <span style={styles.errorText}>v2 model error</span>
      </div>
    );
  }

  if (!modelReady) {
    return (
      <div style={styles.container}>
        <span style={styles.loadingDot} />
        <span style={styles.loadingText}>Loading TCN model…</span>
      </div>
    );
  }

  const pct = Math.round((confidence ?? 0) * 100);

  return (
    <div style={styles.container}>
      {/* Version badge */}
      <span style={styles.versionBadge}>v2</span>

      {/* Predicted letter */}
      <span style={styles.label}>{label ?? '—'}</span>

      {/* Confidence bar */}
      <div style={styles.barOuter} title={`${pct}% confidence`}>
        <div
          style={{
            ...styles.barInner,
            width: `${pct}%`,
            background: pct > 70
              ? 'linear-gradient(90deg, #00c896, #00e5b0)'
              : pct > 40
              ? 'linear-gradient(90deg, #f0b429, #f5c842)'
              : 'linear-gradient(90deg, #e55353, #ff6b6b)',
          }}
        />
      </div>
      <span style={styles.pct}>{pct}%</span>
    </div>
  );
}

const styles = {
  container: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '8px 14px',
    borderRadius: '12px',
    background: 'rgba(255,255,255,0.06)',
    border: '1px solid rgba(255,255,255,0.12)',
    backdropFilter: 'blur(8px)',
    fontSize: '14px',
    color: '#e0e0e0',
  },
  versionBadge: {
    fontSize: '10px',
    fontWeight: 700,
    letterSpacing: '0.08em',
    background: 'linear-gradient(135deg, #6c63ff, #48cfad)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    textTransform: 'uppercase',
  },
  label: {
    fontSize: '28px',
    fontWeight: 800,
    color: '#ffffff',
    minWidth: '28px',
    textAlign: 'center',
    fontFamily: 'monospace',
  },
  barOuter: {
    flex: 1,
    height: '6px',
    borderRadius: '3px',
    background: 'rgba(255,255,255,0.1)',
    overflow: 'hidden',
  },
  barInner: {
    height: '100%',
    borderRadius: '3px',
    transition: 'width 0.2s ease, background 0.2s ease',
  },
  pct: {
    fontSize: '12px',
    color: 'rgba(255,255,255,0.55)',
    minWidth: '34px',
    textAlign: 'right',
  },
  loadingDot: {
    display: 'inline-block',
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    background: '#6c63ff',
    animation: 'pulse 1.2s infinite',
  },
  loadingText: {
    color: 'rgba(255,255,255,0.45)',
    fontSize: '12px',
  },
  errorIcon: { fontSize: '16px' },
  errorText: { color: '#ff6b6b', fontSize: '12px' },
};
