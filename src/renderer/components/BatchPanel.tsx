import React from 'react';
import { BatchProgress } from '../types';

interface BatchPanelProps {
  progress: BatchProgress;
}

export function BatchPanel({ progress }: BatchPanelProps) {
  return (
    <div className="batch-panel">
      <div className="batch-stats">
        <div className="batch-stat">
          <div className="batch-stat-value">{progress.completed}</div>
          <div className="batch-stat-label">Processed</div>
        </div>
        <div className="batch-stat">
          <div className="batch-stat-value">{progress.total}</div>
          <div className="batch-stat-label">Total</div>
        </div>
        <div className="batch-stat">
          <div className="batch-stat-value">{progress.errors.length}</div>
          <div className="batch-stat-label">Errors</div>
        </div>
        <div className="batch-stat">
          <div className="batch-stat-value">{formatTime(progress.estimated)}</div>
          <div className="batch-stat-label">Remaining</div>
        </div>
      </div>

      <div className="progress-bar">
        <div className="progress-fill" style={{ width: `${progress.percentage}%` }} />
      </div>
      <div className="progress-info">
        <span>Processing: {progress.current}</span>
        <span>{progress.percentage}%</span>
      </div>
    </div>
  );
}

function formatTime(ms: number): string {
  if (ms <= 0) return '0s';
  const seconds = Math.ceil(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remaining = seconds % 60;
  return `${minutes}m ${remaining}s`;
}
