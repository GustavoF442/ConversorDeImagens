import React from 'react';

interface ViewerProps {
  originalPreview: string | null;
  resultPreview: string | null;
  isDragging: boolean;
}

export function Viewer({ originalPreview, resultPreview, isDragging }: ViewerProps) {
  return (
    <div className="viewer">
      {isDragging && (
        <div className="drop-zone">
          <div className="drop-zone-text">Drop images here</div>
        </div>
      )}

      <div className="viewer-panel">
        <div className="viewer-header">Original</div>
        <div className="viewer-canvas">
          {originalPreview ? (
            <img src={originalPreview} alt="Original" />
          ) : (
            <EmptyState text="Import images to begin" hint="Select a folder or drag and drop images" />
          )}
        </div>
      </div>

      <div className="viewer-panel">
        <div className="viewer-header">Result</div>
        <div className="viewer-canvas" style={{ background: '#ffffff' }}>
          {resultPreview ? (
            <img src={resultPreview} alt="Result" />
          ) : (
            <EmptyState
              text="Preview will appear here"
              hint="Select an image and adjust settings"
              dark={false}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function EmptyState({ text, hint, dark = true }: { text: string; hint: string; dark?: boolean }) {
  return (
    <div className="viewer-empty">
      <div className="viewer-empty-icon" style={dark ? {} : { borderColor: '#ccc' }}>
        <svg
          width="24" height="24" viewBox="0 0 24 24" fill="none"
          stroke={dark ? '#555' : '#999'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
        >
          <rect width="18" height="18" x="3" y="3" rx="2" ry="2"/>
          <circle cx="9" cy="9" r="2"/>
          <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/>
        </svg>
      </div>
      <div className="viewer-empty-text" style={dark ? {} : { color: '#666' }}>{text}</div>
      <div className="viewer-empty-hint" style={dark ? {} : { color: '#999' }}>{hint}</div>
    </div>
  );
}
