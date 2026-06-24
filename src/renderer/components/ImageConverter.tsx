import React, { useState, useCallback } from 'react';

const FORMATS = [
  { value: 'jpeg', label: 'JPEG' },
  { value: 'png', label: 'PNG' },
  { value: 'webp', label: 'WEBP' },
  { value: 'bmp', label: 'BMP' },
  { value: 'tiff', label: 'TIFF' },
];

interface ImageConverterProps {
  onBack: () => void;
}

export function ImageConverter({ onBack }: ImageConverterProps) {
  const [files, setFiles] = useState<string[]>([]);
  const [outputDir, setOutputDir] = useState<string | null>(null);
  const [targetFormat, setTargetFormat] = useState('jpeg');
  const [quality, setQuality] = useState(95);
  const [isProcessing, setIsProcessing] = useState(false);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const showNotification = useCallback((type: 'success' | 'error', message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 4000);
  }, []);

  const handleSelectFiles = useCallback(async () => {
    if (!window.api) return;
    const filePaths = await window.api.selectAnyImages();
    if (!filePaths) return;
    setFiles(prev => [...prev, ...filePaths]);
    showNotification('success', `${filePaths.length} imagens adicionadas`);
  }, [showNotification]);

  const handleSelectOutput = useCallback(async () => {
    if (!window.api) return;
    const folder = await window.api.selectOutputFolder();
    if (folder) {
      setOutputDir(folder);
      showNotification('success', `Saída: ${folder}`);
    }
  }, [showNotification]);

  const handleConvert = useCallback(async () => {
    if (!window.api || files.length === 0) {
      showNotification('error', 'Selecione pelo menos uma imagem');
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
      const result = await window.api.convertImages(files, output, targetFormat, quality);
      showNotification('success', `${result.success} imagens convertidas`);
    } catch (err: any) {
      showNotification('error', `Falha na conversão: ${err.message}`);
    } finally {
      setIsProcessing(false);
    }
  }, [files, outputDir, targetFormat, quality, showNotification]);

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  return (
    <div className="module-container">
      <div className="module-header">
        <button className="btn btn-sm" onClick={onBack}>← Voltar</button>
        <span className="module-title">Converter Imagens</span>
      </div>

      <div className="module-content">
        <div className="module-toolbar">
          <button className="btn" onClick={handleSelectFiles}>
            <ImageIcon /> Selecionar Imagens
          </button>
          <button className="btn" onClick={handleSelectOutput}>
            <SaveIcon /> Pasta de Saída
          </button>
          <div className="select-group-inline">
            <label>Formato</label>
            <select value={targetFormat} onChange={e => setTargetFormat(e.target.value)}>
              {FORMATS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
            </select>
          </div>
          <button
            className="btn btn-primary"
            onClick={handleConvert}
            disabled={files.length === 0 || isProcessing}
          >
            {isProcessing ? 'Convertendo...' : 'Converter'}
          </button>
        </div>

        <div className="module-info">
          {outputDir ? `Saída: ${outputDir}` : 'Nenhuma pasta de saída selecionada'}
        </div>

        <div className="image-list">
          {files.length === 0 && (
            <div className="empty-list">Nenhuma imagem selecionada</div>
          )}
          {files.map((file, idx) => (
            <div key={`${file}-${idx}`} className="pdf-list-item">
              <span className="pdf-list-number">{idx + 1}</span>
              <span className="pdf-list-name">{file.split(/[\\/]/).pop()}</span>
              <div className="pdf-list-actions">
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

function ImageIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect width="18" height="18" x="3" y="3" rx="2" ry="2"/>
      <circle cx="9" cy="9" r="2"/>
      <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/>
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
