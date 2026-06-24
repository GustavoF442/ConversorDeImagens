import React from 'react';

export function TitleBar() {
  const handleMinimize = () => window.api?.windowMinimize();
  const handleMaximize = () => window.api?.windowMaximize();
  const handleClose = () => window.api?.windowClose();

  return (
    <div className="titlebar">
      <div className="titlebar-title">
        <img src="img/logo.png" alt="Logo" className="titlebar-logo" />
        <span>Conversor de Imagens</span>
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
