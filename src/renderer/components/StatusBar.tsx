import React from 'react';

interface StatusBarProps {
  fileCount: number;
  isProcessing: boolean;
  outputDir: string | null;
}

export function StatusBar({ fileCount, isProcessing, outputDir }: StatusBarProps) {
  return (
    <div className="statusbar">
      <div className="statusbar-left">
        <div className={`status-dot ${isProcessing ? 'processing' : ''}`} />
        <span>{isProcessing ? 'Processing...' : 'Ready'}</span>
        <span>{fileCount} images loaded</span>
      </div>
      <div className="statusbar-right">
        <span>v1.0.0</span>
        {outputDir && <span>{outputDir}</span>}
      </div>
    </div>
  );
}
