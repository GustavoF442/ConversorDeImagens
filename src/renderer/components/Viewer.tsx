import React from 'react';

interface ViewerProps {
  originalPreview: string | null;
  resultPreview: string | null;
  isDragging: boolean;
  isProcessing?: boolean;
}

export function Viewer({ originalPreview, resultPreview, isDragging, isProcessing }: ViewerProps) {
  return (
    <div className="viewer" style={{ position: 'relative' }}>
      {isDragging && (
        <div className="drop-zone" style={{ position: 'absolute', inset: 0, zIndex: 50 }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="1.5">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="17 8 12 3 7 8"/>
              <line x1="12" x2="12" y1="3" y2="15"/>
            </svg>
            <div className="drop-zone-text">Solte as imagens aqui</div>
          </div>
        </div>
      )}

      <div className="viewer-panel">
        <div className="viewer-header">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <rect width="18" height="18" x="3" y="3" rx="2"/>
            <circle cx="9" cy="9" r="2"/>
            <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/>
          </svg>
          Original
        </div>
        <div className="viewer-canvas">
          {originalPreview ? (
            <img src={originalPreview} alt="Original" draggable={false} />
          ) : (
            <EmptyState
              text="Importe imagens para começar"
              hint="Selecione uma pasta ou arraste arquivos"
            />
          )}
        </div>
      </div>

      <div className="viewer-panel">
        <div className="viewer-header">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
          </svg>
          Resultado
          {isProcessing && (
            <span className="viewer-badge" style={{ marginLeft: 6 }}>Processando…</span>
          )}
        </div>
        <div className="viewer-canvas" style={{ background: resultPreview ? '#f8f8f8' : undefined }}>
          {resultPreview ? (
            <img src={resultPreview} alt="Resultado" draggable={false}
              style={{ imageRendering: 'crisp-edges' }} />
          ) : (
            <EmptyState
              text="Preview aparecerá aqui"
              hint="Selecione uma imagem para ver o resultado"
            />
          )}
        </div>
      </div>
    </div>
  );
}

function EmptyState({ text, hint }: { text: string; hint: string }) {
  return (
    <div className="viewer-empty">
      <div className="viewer-empty-icon">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
          stroke="var(--text-muted)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <rect width="18" height="18" x="3" y="3" rx="2" ry="2"/>
          <circle cx="9" cy="9" r="2"/>
          <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/>
        </svg>
      </div>
      <div className="viewer-empty-text">{text}</div>
      <div className="viewer-empty-hint">{hint}</div>
    </div>
  );
}
