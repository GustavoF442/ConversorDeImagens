import React, { useState, useCallback } from 'react';

interface PdfMergerProps {
  onBack: () => void;
}

export function PdfMerger({ onBack }: PdfMergerProps) {
  const [files, setFiles] = useState<string[]>([]);
  const [outputDir, setOutputDir] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const showNotification = useCallback((type: 'success' | 'error', message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 4000);
  }, []);

  const handleSelectFiles = useCallback(async () => {
    if (!window.api) return;
    const filePaths = await window.api.selectPdfs();
    if (!filePaths) return;
    setFiles(prev => [...prev, ...filePaths]);
    showNotification('success', `${filePaths.length} PDFs adicionados`);
  }, [showNotification]);

  const handleSelectOutput = useCallback(async () => {
    if (!window.api) return;
    const folder = await window.api.selectOutputFolder();
    if (folder) {
      setOutputDir(folder);
      showNotification('success', `Saída: ${folder}`);
    }
  }, [showNotification]);

  const handleMerge = useCallback(async () => {
    if (!window.api || files.length < 2) {
      showNotification('error', 'Selecione pelo menos 2 PDFs');
      return;
    }

    let output = outputDir;
    if (!output) {
      output = await window.api.selectOutputFolder();
      if (!output) return;
      setOutputDir(output);
    }

    setIsProcessing(true);
    try {
      const result = await window.api.mergePdfs(files, output);
      showNotification('success', `PDFs combinados: ${result.path}`);
    } catch (err: any) {
      showNotification('error', `Falha ao combinar PDFs: ${err.message}`);
    } finally {
      setIsProcessing(false);
    }
  }, [files, outputDir, showNotification]);

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  const moveFile = (index: number, direction: -1 | 1) => {
    setFiles(prev => {
      const newFiles = [...prev];
      const newIndex = index + direction;
      if (newIndex < 0 || newIndex >= newFiles.length) return prev;
      [newFiles[index], newFiles[newIndex]] = [newFiles[newIndex], newFiles[index]];
      return newFiles;
    });
  };

  return (
    <div className="module-container">
      <div className="module-header">
        <button className="btn btn-sm" onClick={onBack}>← Voltar</button>
        <span className="module-title">Juntar PDFs</span>
      </div>

      <div className="module-content">
        <div className="module-toolbar">
          <button className="btn" onClick={handleSelectFiles}>
            <FileIcon /> Selecionar PDFs
          </button>
          <button className="btn" onClick={handleSelectOutput}>
            <SaveIcon /> Pasta de Saída
          </button>
          <button
            className="btn btn-primary"
            onClick={handleMerge}
            disabled={files.length < 2 || isProcessing}
          >
            {isProcessing ? 'Combinando...' : 'Combinar PDFs'}
          </button>
        </div>

        <div className="module-info">
          {outputDir ? `Saída: ${outputDir}` : 'Nenhuma pasta de saída selecionada'}
        </div>

        <div className="pdf-list">
          {files.length === 0 && (
            <div className="empty-list">Nenhum PDF selecionado</div>
          )}
          {files.map((file, idx) => (
            <div key={`${file}-${idx}`} className="pdf-list-item">
              <span className="pdf-list-number">{idx + 1}</span>
              <span className="pdf-list-name">{file.split(/[\\/]/).pop()}</span>
              <div className="pdf-list-actions">
                <button onClick={() => moveFile(idx, -1)} disabled={idx === 0}>↑</button>
                <button onClick={() => moveFile(idx, 1)} disabled={idx === files.length - 1}>↓</button>
                <button onClick={() => removeFile(idx)}>×</button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {notification && (
        <div className={`notification ${notification.type}`}>
          {notification.type === 'success' ? '✓' : '✕'} {notification.message}
        </div>
      )}
    </div>
  );
}

function FileIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/>
      <polyline points="14 2 14 8 20 8"/>
    </svg>
  );
}

function SaveIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
      <polyline points="17 21 17 13 7 13 7 21"/>
      <polyline points="7 3 7 8 15 8"/>
    </svg>
  );
}
