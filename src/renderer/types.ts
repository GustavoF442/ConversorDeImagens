export interface ProcessingSettings {
  mode: 'line-art' | 'line-art-solid' | 'technical-sheet' | 'silhouette';
  lineThickness: number;
  detectionSensitivity: number;
  blackFillIntensity: number;
  contrast: number;
  sharpness: number;
  argoxMode: boolean;
  argoxDpi: 203 | 300;
  argoxMaxWidth: number;
  argoxMaxHeight: number;
  outputSize: { width: number; height: number } | null;
  maxFileSize: number | null;
  removeBackground: boolean;
  solidifyDarkAreas: boolean;
}

export interface FileInfo {
  path: string;
  name: string;
  size: number;
  extension: string;
}

export interface BatchProgress {
  total: number;
  completed: number;
  current: string;
  percentage: number;
  errors: string[];
  elapsed: number;
  estimated: number;
}

export const DEFAULT_SETTINGS: ProcessingSettings = {
  mode: 'line-art',
  lineThickness: 3,
  detectionSensitivity: 50,
  blackFillIntensity: 50,
  contrast: 100,
  sharpness: 50,
  argoxMode: false,
  argoxDpi: 203,
  argoxMaxWidth: 100,
  argoxMaxHeight: 60,
  outputSize: null,
  maxFileSize: null,
  removeBackground: true,
  solidifyDarkAreas: true,
};

declare global {
  interface Window {
    api: {
      selectFolder: () => Promise<string | null>;
      selectFiles: () => Promise<string[] | null>;
      selectAnyImages: () => Promise<string[] | null>;
      selectPdfs: () => Promise<string[] | null>;
      selectOutputFolder: () => Promise<string | null>;
      scanFolder: (path: string) => Promise<{ files: FileInfo[]; totalSize: number; count: number }>;
      processSingle: (path: string, settings: ProcessingSettings) => Promise<any>;
      processBatch: (files: string[], outputDir: string, settings: ProcessingSettings) => Promise<{ success: number; errors: string[] }>;
      exportFiles: (data: any) => Promise<{ paths: string[] }>;
      getPreview: (path: string, settings: ProcessingSettings) => Promise<string>;
      mergePdfs: (files: string[], outputDir: string) => Promise<{ path: string }>;
      convertImages: (files: string[], outputDir: string, format: string, quality: number) => Promise<{ success: number; errors: string[] }>;
      openFolder: (path: string) => Promise<void>;
      onBatchProgress: (callback: (progress: BatchProgress) => void) => () => void;
      windowMinimize: () => Promise<void>;
      windowMaximize: () => Promise<void>;
      windowClose: () => Promise<void>;
    };
  }
}

