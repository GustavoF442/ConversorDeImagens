import React from 'react';
import { ProcessingSettings, FileInfo } from '../types';

interface SidebarProps {
  files: FileInfo[];
  selectedFile: FileInfo | null;
  onSelectFile: (file: FileInfo) => void;
  onSelectFolder: () => void;
  onSelectFiles: () => void;
  settings: ProcessingSettings;
  onSettingsChange: (settings: ProcessingSettings) => void;
}

const MODES = [
  { id: 'line-art' as const, label: 'Line Art', icon: '✏️' },
  { id: 'line-art-solid' as const, label: 'Line + Solid', icon: '🖊️' },
  { id: 'technical-sheet' as const, label: 'Tech Sheet', icon: '📐' },
  { id: 'silhouette' as const, label: 'Silhouette', icon: '👤' },
];

export function Sidebar({
  files,
  selectedFile,
  onSelectFile,
  onSelectFolder,
  onSelectFiles,
  settings,
  onSettingsChange,
}: SidebarProps) {
  const update = (patch: Partial<ProcessingSettings>) => {
    onSettingsChange({ ...settings, ...patch });
  };

  return (
    <div className="sidebar">
      <div className="sidebar-section">
        <div className="sidebar-label">Import</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <button className="btn" onClick={onSelectFolder}>
            <FolderPlusIcon /> Select Folder
          </button>
          <button className="btn" onClick={onSelectFiles}>
            <FilePlusIcon /> Select Files
          </button>
        </div>
      </div>

      <div className="sidebar-section">
        <div className="sidebar-label">Output Mode</div>
        <div className="mode-grid">
          {MODES.map(mode => (
            <div
              key={mode.id}
              className={`mode-card ${settings.mode === mode.id ? 'active' : ''}`}
              onClick={() => update({ mode: mode.id })}
            >
              <div className="mode-card-icon">{mode.icon}</div>
              <div className="mode-card-label">{mode.label}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="sidebar-section sidebar-scroll">
        <div className="sidebar-label">Files ({files.length})</div>
        <div className="file-list">
          {files.length === 0 && (
            <div style={{ padding: '16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 11 }}>
              No images loaded. Import a folder or drag files here.
            </div>
          )}
          {files.map((file, idx) => (
            <div
              key={file.path}
              className={`file-item ${selectedFile?.path === file.path ? 'active' : ''}`}
              onClick={() => onSelectFile(file)}
            >
              <div
                className="file-item-thumb"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 10,
                  color: 'var(--text-muted)',
                }}
              >
                {idx + 1}
              </div>
              <div className="file-item-info">
                <div className="file-item-name">{file.name}</div>
                <div className="file-item-meta">
                  {file.extension.toUpperCase().slice(1)} • {formatSize(file.size)}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function formatSize(bytes: number): string {
  if (bytes === 0) return '';
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

function FolderPlusIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 10v6M9 13h6"/>
      <path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z"/>
    </svg>
  );
}

function FilePlusIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/>
      <polyline points="14 2 14 8 20 8"/>
      <line x1="12" x2="12" y1="18" y2="12"/>
      <line x1="9" x2="15" y1="15" y2="15"/>
    </svg>
  );
}
