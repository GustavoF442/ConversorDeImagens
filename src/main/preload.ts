import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('api', {
  selectFolder: () => ipcRenderer.invoke('select-folder'),
  selectFiles: () => ipcRenderer.invoke('select-files'),
  selectOutputFolder: () => ipcRenderer.invoke('select-output-folder'),
  scanFolder: (path: string) => ipcRenderer.invoke('scan-folder', path),
  processSingle: (path: string, settings: any) => ipcRenderer.invoke('process-single', path, settings),
  processBatch: (files: string[], outputDir: string, settings: any) => ipcRenderer.invoke('process-batch', files, outputDir, settings),
  exportFiles: (data: any) => ipcRenderer.invoke('export-files', data),
  getPreview: (path: string, settings: any) => ipcRenderer.invoke('get-preview', path, settings),
  openFolder: (path: string) => ipcRenderer.invoke('open-folder', path),
  onBatchProgress: (callback: (progress: any) => void) => {
    ipcRenderer.on('batch-progress', (_event, progress) => callback(progress));
    return () => ipcRenderer.removeAllListeners('batch-progress');
  },
  windowMinimize: () => ipcRenderer.invoke('window-minimize'),
  windowMaximize: () => ipcRenderer.invoke('window-maximize'),
  windowClose: () => ipcRenderer.invoke('window-close'),
});
