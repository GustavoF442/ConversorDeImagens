import React, { useState, useCallback, useEffect, useRef } from 'react';
import { ProcessingSettings, FileInfo, BatchProgress, DEFAULT_SETTINGS } from '../types';
import { Sidebar } from './Sidebar';
import { Viewer } from './Viewer';
import { RightPanel } from './RightPanel';
import { BatchPanel } from './BatchPanel';

interface ShoeConverterProps {
  onBack: () => void;
}

export function ShoeConverter({ onBack }: ShoeConverterProps) {
  const [files, setFiles] = useState<FileInfo[]>([]);
  const [selectedFile, setSelectedFile] = useState<FileInfo | null>(null);
  const [settings, setSettings] = useState<ProcessingSettings>(DEFAULT_SETTINGS);
  const [originalPreview, setOriginalPreview] = useState<string | null>(null);
  const [resultPreview, setResultPreview] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [batchProgress, setBatchProgress] = useState<BatchProgress | null>(null);
  const [outputDir, setOutputDir] = useState<string | null>(null);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const showNotification = useCallback((type: 'success' | 'error', message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 4000);
  }, []);

  const handleSelectFolder = useCallback(async () => {
    if (!window.api) return;
    const folder = await window.api.selectFolder();
    if (!folder) return;

    const result = await window.api.scanFolder(folder);
    setFiles(result.files);
    if (result.files.length > 0) {
      setSelectedFile(result.files[0]);
    }
    showNotification('success', `${result.count} imagens encontradas (${formatSize(result.totalSize)})`);
  }, [showNotification]);

  const handleSelectFiles = useCallback(async () => {
    if (!window.api) return;
    const filePaths = await window.api.selectFiles();
    if (!filePaths) return;

    const fileInfos: FileInfo[] = filePaths.map(p => ({
      path: p,
      name: p.split(/[\\/]/).pop() || '',
      size: 0,
      extension: '.' + (p.split('.').pop() || ''),
    }));

    setFiles(fileInfos);
    if (fileInfos.length > 0) {
      setSelectedFile(fileInfos[0]);
    }
    showNotification('success', `${fileInfos.length} imagens selecionadas`);
  }, [showNotification]);

  const handleSelectOutput = useCallback(async () => {
    if (!window.api) return;
    const folder = await window.api.selectOutputFolder();
    if (folder) {
      setOutputDir(folder);
      showNotification('success', `Saída: ${folder}`);
    }
  }, [showNotification]);

  useEffect(() => {
    if (!selectedFile || !window.api) return;

    setOriginalPreview(`file://${selectedFile.path}`);

    const timer = setTimeout(async () => {
      try {
        const preview = await window.api.getPreview(selectedFile.path, settings);
        setResultPreview(preview);
      } catch (err: any) {
        console.error('Preview error:', err);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [selectedFile, settings]);

  const handleProcessBatch = useCallback(async () => {
    if (!window.api || files.length === 0) return;

    let output = outputDir;
    if (!output) {
      output = await window.api.selectOutputFolder();
      if (!output) return;
      setOutputDir(output);
    }

    setIsProcessing(true);
    setBatchProgress(null);

    const cleanup = window.api.onBatchProgress((progress) => {
      setBatchProgress(progress);
    });

    try {
      const filePaths = files.map(f => f.path);
      const result = await window.api.processBatch(filePaths, output, settings);
      showNotification('success', `${result.success} imagens processadas com sucesso`);
      if (result.errors.length > 0) {
        console.error('Batch errors:', result.errors);
      }
    } catch (err: any) {
      showNotification('error', `Falha no processamento em lote: ${err.message}`);
    } finally {
      setIsProcessing(false);
      cleanup();
    }
  }, [files, outputDir, settings, showNotification]);

  const handleProcessSingle = useCallback(async () => {
    if (!selectedFile || !window.api) return;

    let output = outputDir;
    if (!output) {
      output = await window.api.selectOutputFolder();
      if (!output) return;
      setOutputDir(output);
    }

    setIsProcessing(true);
    try {
      const result = await window.api.processSingle(selectedFile.path, settings);
      await window.api.exportFiles({
        buffer: result.buffer,
        width: result.width,
        height: result.height,
        name: result.originalName,
        outputDir: output,
        formats: ['jpg'],
      });
      showNotification('success', `Exportado: ${result.originalName}.jpg`);
    } catch (err: any) {
      showNotification('error', `Falha na exportação: ${err.message}`);
    } finally {
      setIsProcessing(false);
    }
  }, [selectedFile, outputDir, settings, showNotification]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const items = Array.from(e.dataTransfer.files);
    const imageFiles = items.filter(f =>
      /\.(jpg|jpeg|png|webp|bmp|tiff?)$/i.test(f.name)
    );

    if (imageFiles.length > 0) {
      const fileInfos: FileInfo[] = imageFiles.map(f => ({
        path: (f as any).path || f.name,
        name: f.name,
        size: f.size,
        extension: '.' + (f.name.split('.').pop() || ''),
      }));

      setFiles(prev => [...prev, ...fileInfos]);
      if (!selectedFile && fileInfos.length > 0) {
        setSelectedFile(fileInfos[0]);
      }
      showNotification('success', `${imageFiles.length} imagens adicionadas`);
    }
  }, [selectedFile, showNotification]);

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      style={{ width: '100vw', height: '100vh', display: 'flex', flexDirection: 'column' }}
    >
      <div className="module-header">
        <button className="btn btn-sm" onClick={onBack}>← Voltar</button>
        <span className="module-title">Conversor de Calçados</span>
      </div>

      <div className="app-layout">
        <Sidebar
          files={files}
          selectedFile={selectedFile}
          onSelectFile={setSelectedFile}
          onSelectFolder={handleSelectFolder}
          onSelectFiles={handleSelectFiles}
          settings={settings}
          onSettingsChange={setSettings}
        />

        <div className="main-content">
          <div className="toolbar">
            <button className="btn btn-sm" onClick={handleSelectFolder}>
              <FolderIcon /> Selecionar Pasta
            </button>
            <button className="btn btn-sm" onClick={handleSelectFiles}>
              <ImageIcon /> Selecionar Arquivos
            </button>
            <div className="toolbar-separator" />
            <button className="btn btn-sm" onClick={handleSelectOutput}>
              <SaveIcon /> Pasta de Saída
            </button>
            <div className="toolbar-separator" />
            <button
              className="btn btn-sm btn-primary"
              onClick={handleProcessSingle}
              disabled={!selectedFile || isProcessing}
            >
              <PlayIcon /> Processar Atual
            </button>
            <button
              className="btn btn-sm btn-success"
              onClick={handleProcessBatch}
              disabled={files.length === 0 || isProcessing}
            >
              <ZapIcon /> Processar Todas ({files.length})
            </button>
            <div className="toolbar-info">
              {outputDir ? `Saída: ${outputDir.split(/[\\/]/).pop()}` : 'Nenhuma pasta de saída selecionada'}
            </div>
          </div>

          <Viewer
            originalPreview={originalPreview}
            resultPreview={resultPreview}
            isDragging={isDragging}
            isProcessing={isProcessing}
          />

          {(isProcessing && batchProgress) && (
            <BatchPanel progress={batchProgress} />
          )}
        </div>

        <RightPanel
          settings={settings}
          onSettingsChange={setSettings}
          selectedFile={selectedFile}
        />
      </div>

      {notification && (
        <div className={`notification ${notification.type}`}>
          {notification.type === 'success' ? '✓' : '✕'} {notification.message}
        </div>
      )}
    </div>
  );
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

function FolderIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z"/>
    </svg>
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

function PlayIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="5 3 19 12 5 21 5 3"/>
    </svg>
  );
}

function ZapIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
    </svg>
  );
}
