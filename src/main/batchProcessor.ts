import fs from 'fs';
import path from 'path';
import os from 'os';
import { ImageProcessor, ProcessingSettings, ProcessingResult } from './imageProcessor';
import { ExportManager } from './exportManager';

const SUPPORTED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp', '.bmp', '.tiff', '.tif'];

export interface BatchProgress {
  total: number;
  completed: number;
  current: string;
  percentage: number;
  errors: string[];
  elapsed: number;
  estimated: number;
}

export interface ScanResult {
  files: FileInfo[];
  totalSize: number;
  count: number;
}

export interface FileInfo {
  path: string;
  name: string;
  size: number;
  extension: string;
}

export class BatchProcessor {
  private processor: ImageProcessor;
  private exportManager: ExportManager;

  constructor(processor: ImageProcessor) {
    this.processor = processor;
    this.exportManager = new ExportManager();
  }

  scanFolder(folderPath: string): ScanResult {
    const files: FileInfo[] = [];
    let totalSize = 0;

    const entries = fs.readdirSync(folderPath, { withFileTypes: true });

    for (const entry of entries) {
      if (!entry.isFile()) continue;

      const ext = path.extname(entry.name).toLowerCase();
      if (!SUPPORTED_EXTENSIONS.includes(ext)) continue;

      const fullPath = path.join(folderPath, entry.name);
      const stats = fs.statSync(fullPath);

      files.push({
        path: fullPath,
        name: entry.name,
        size: stats.size,
        extension: ext,
      });

      totalSize += stats.size;
    }

    files.sort((a, b) => a.name.localeCompare(b.name));

    return { files, totalSize, count: files.length };
  }

  async processBatch(
    files: string[],
    outputDir: string,
    settings: ProcessingSettings,
    onProgress: (progress: BatchProgress) => void
  ): Promise<{ success: number; errors: string[] }> {
    const cpuCount = os.cpus().length;
    const concurrency = Math.max(1, Math.min(cpuCount - 1, 8));

    // Create output subdirectories
    const pngDir = path.join(outputDir, 'PNG');
    const svgDir = path.join(outputDir, 'SVG');
    const pdfDir = path.join(outputDir, 'PDF');
    const argoxDir = path.join(outputDir, 'Argox');

    for (const dir of [pngDir, svgDir, pdfDir, argoxDir]) {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    }

    const errors: string[] = [];
    let completed = 0;
    const startTime = Date.now();

    const processFile = async (filePath: string): Promise<void> => {
      const fileName = path.basename(filePath, path.extname(filePath));

      try {
        const result = await this.processor.processImage(filePath, settings);

        // Save PNG
        await fs.promises.writeFile(path.join(pngDir, `${fileName}.png`), result.buffer);

        // Save SVG via tracing
        const svgContent = await this.exportManager.bufferToSvg(result.buffer, result.width, result.height);
        await fs.promises.writeFile(path.join(svgDir, `${fileName}.svg`), svgContent);

        // Save PDF
        const pdfBuffer = await this.exportManager.bufferToPdf(result.buffer, result.width, result.height, fileName);
        await fs.promises.writeFile(path.join(pdfDir, `${fileName}.pdf`), pdfBuffer);

        // Save Argox-optimized
        if (settings.argoxMode) {
          const argoxSettings = { ...settings, argoxMode: true };
          const argoxResult = await this.processor.processImage(filePath, argoxSettings);
          await fs.promises.writeFile(path.join(argoxDir, `${fileName}.png`), argoxResult.buffer);
        }

        completed++;
      } catch (err: any) {
        errors.push(`${fileName}: ${err.message}`);
        completed++;
      }

      const elapsed = Date.now() - startTime;
      const avgTime = elapsed / completed;
      const estimated = avgTime * (files.length - completed);

      onProgress({
        total: files.length,
        completed,
        current: fileName,
        percentage: Math.round((completed / files.length) * 100),
        errors,
        elapsed,
        estimated,
      });
    };

    // Process in parallel batches
    for (let i = 0; i < files.length; i += concurrency) {
      const batch = files.slice(i, i + concurrency);
      await Promise.all(batch.map(processFile));
    }

    return { success: completed - errors.length, errors };
  }
}
