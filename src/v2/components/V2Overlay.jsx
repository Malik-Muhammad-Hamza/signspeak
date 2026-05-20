/**
 * SignSpeak v2 — V2Overlay
 *
 * Debug overlay that sits on top of the webcam feed canvas.
 * Shows landmark skeleton, current raw label, and smoother history.
 *
 * Activate via:  <V2Overlay debug={true} … />
 *
 * Props
 * -----
 * debug          {boolean}        Toggle visibility
 * rawLabel       {string|null}    Unsmoothed top-1 prediction
 * stableLabel    {string|null}    Smoothed prediction
 * confidence     {number}         0-1
 * smootherHistory{string[]}       Last N raw predictions (from smoother.getHistory())
 */

import React from 'react';

export default function V2Overlay({
  debug = false,
  rawLabel,
  stableLabel,
  confidence,
  smootherHistory = [],
}) {
  if (!debug) return null;

  const pct = Math.round((confidence ?? 0) * 100);

  return (
    <div style={styles.overlay}>
      <div style={styles.panel}>
        <div style={styles.row}>
          <span style={styles.key}>Raw</span>
          <span style={styles.mono}>{rawLabel ?? '—'}</span>
        </div>
        <div style={styles.row}>
          <span style={styles.key}>Stable</span>
          <span style={{ ...styles.mono, color: '#00e5b0' }}>{stableLabel ?? '—'}</span>
        </div>
        <div style={styles.row}>
          <span style={styles.key}>Conf</span>
          <span style={styles.mono}>{pct}%</span>
        </div>
        <div style={styles.historyRow}>
          {smootherHistory.slice(-10).map((l, i) => (
            <span
              key={i}
              style={{
                ...styles.historyItem,
                opacity: 0.3 + (i / 10) * 0.7,
                background: l === stableLabel
                  ? 'rgba(0,229,176,0.25)'
                  : 'rgba(255,255,255,0.07)',
              }}
            >
              {l ?? '·'}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

const styles = {
  overlay: {
    position: 'absolute',
    top: 8,
    left: 8,
    pointerEvents: 'none',
    zIndex: 10,
  },
  panel: {
    padding: '8px 12px',
    borderRadius: '10px',
    background: 'rgba(0,0,0,0.55)',
    border: '1px solid rgba(255,255,255,0.1)',
    backdropFilter: 'blur(6px)',
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
    minWidth: '130px',
  },
  row: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '12px',
  },
  key: {
    fontSize: '10px',
    color: 'rgba(255,255,255,0.4)',
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
  },
  mono: {
    fontFamily: 'monospace',
    fontSize: '13px',
    fontWeight: 700,
    color: '#ffffff',
  },
  historyRow: {
    marginTop: '4px',
    display: 'flex',
    gap: '3px',
    flexWrap: 'wrap',
  },
  historyItem: {
    fontFamily: 'monospace',
    fontSize: '11px',
    padding: '1px 5px',
    borderRadius: '4px',
    color: '#fff',
  },
};
