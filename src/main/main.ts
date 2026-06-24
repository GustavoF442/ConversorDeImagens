import { app, BrowserWindow, ipcMain, dialog, shell } from 'electron';
import path from 'path';
import { ImageProcessor } from './imageProcessor';
import { BatchProcessor } from './batchProcessor';
import { ExportManager } from './exportManager';

let mainWindow: BrowserWindow | null = null;
const imageProcessor = new ImageProcessor();
const batchProcessor = new BatchProcessor(imageProcessor);
const exportManager = new ExportManager();

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1100,
    minHeight: 700,
    title: 'Footwear Sketch Generator',
    backgroundColor: '#0f0f0f',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    frame: false,
    titleBarStyle: 'hidden',
  });

  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// IPC Handlers

ipcMain.handle('select-folder', async () => {
  const result = await dialog.showOpenDialog(mainWindow!, {
    properties: ['openDirectory'],
    title: 'Select Folder with Footwear Images',
  });
  if (result.canceled) return null;
  return result.filePaths[0];
});

ipcMain.handle('select-files', async () => {
  const result = await dialog.showOpenDialog(mainWindow!, {
    properties: ['openFile', 'multiSelections'],
    filters: [
      { name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'webp', 'bmp', 'tiff'] },
    ],
    title: 'Select Footwear Images',
  });
  if (result.canceled) return null;
  return result.filePaths;
});

ipcMain.handle('select-output-folder', async () => {
  const result = await dialog.showOpenDialog(mainWindow!, {
    properties: ['openDirectory', 'createDirectory'],
    title: 'Select Output Folder',
  });
  if (result.canceled) return null;
  return result.filePaths[0];
});

ipcMain.handle('scan-folder', async (_event, folderPath: string) => {
  return batchProcessor.scanFolder(folderPath);
});

ipcMain.handle('process-single', async (_event, filePath: string, settings: any) => {
  return imageProcessor.processImage(filePath, settings);
});

ipcMain.handle('process-batch', async (event, files: string[], outputDir: string, settings: any) => {
  return batchProcessor.processBatch(files, outputDir, settings, (progress: any) => {
    mainWindow?.webContents.send('batch-progress', progress);
  });
});

ipcMain.handle('export-files', async (_event, data: any) => {
  return exportManager.exportFiles(data);
});

ipcMain.handle('get-preview', async (_event, filePath: string, settings: any) => {
  return imageProcessor.getPreview(filePath, settings);
});

ipcMain.handle('open-folder', async (_event, folderPath: string) => {
  shell.openPath(folderPath);
});

ipcMain.handle('window-minimize', () => mainWindow?.minimize());
ipcMain.handle('window-maximize', () => {
  if (mainWindow?.isMaximized()) {
    mainWindow.unmaximize();
  } else {
    mainWindow?.maximize();
  }
});
ipcMain.handle('window-close', () => mainWindow?.close());
