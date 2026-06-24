import React from 'react';

export function TitleBar() {
  const handleMinimize = () => window.api?.windowMinimize();
  const handleMaximize = () => window.api?.windowMaximize();
  const handleClose = () => window.api?.windowClose();

  return (
    <div className="titlebar">
      <div className="titlebar-title">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M2 18a1 1 0 0 0 1 1h18a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1H3a1 1 0 0 0-1 1v2z"/>
          <path d="M10 10V5a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v5"/>
          <path d="M4 15v-3a6 6 0 0 1 6-6h0"/>
          <path d="M14 6a6 6 0 0 1 6 6v3"/>
        </svg>
        Footwear Sketch Generator
      </div>
      <div className="titlebar-controls">
        <button className="titlebar-btn" onClick={handleMinimize}>
          <svg width="12" height="12" viewBox="0 0 12 12"><rect y="5" width="12" height="1" fill="currentColor"/></svg>
        </button>
        <button className="titlebar-btn" onClick={handleMaximize}>
          <svg width="12" height="12" viewBox="0 0 12 12"><rect x="1" y="1" width="10" height="10" stroke="currentColor" strokeWidth="1" fill="none"/></svg>
        </button>
        <button className="titlebar-btn close" onClick={handleClose}>
          <svg width="12" height="12" viewBox="0 0 12 12"><path d="M1 1l10 10M11 1L1 11" stroke="currentColor" strokeWidth="1.5"/></svg>
        </button>
      </div>
    </div>
  );
}
