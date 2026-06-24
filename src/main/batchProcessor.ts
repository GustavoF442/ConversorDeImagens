import fs from 'fs';
import path from 'path';
import os from 'os';
import sharp from 'sharp';
import { ImageProcessor, ProcessingSettings } from './imageProcessor';

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

  constructor(processor: ImageProcessor) {
    this.processor = processor;
  }

  private async convertToJpgWithSizeLimit(buffer: Buffer, maxBytes: number | null): Promise<Buffer> {
    // Ensure white background before converting to JPG
    let pipeline = sharp(buffer)
      .flatten({ background: { r: 255, g: 255, b: 255 } })
      .jpeg({ quality: 95, progressive: true });

    let result = await pipeline.toBuffer();

    if (!maxBytes || result.length <= maxBytes) {
      return result;
    }

    // Reduce quality progressively
    for (let quality = 90; quality >= 30; quality -= 10) {
      result = await sharp(buffer)
        .flatten({ background: { r: 255, g: 255, b: 255 } })
        .jpeg({ quality, progressive: true })
        .toBuffer();
      if (result.length <= maxBytes) return result;
    }

    // If still too big, reduce dimensions
    const metadata = await sharp(buffer).metadata();
    let scale = 0.9;
    while (scale > 0.1) {
      const newWidth = Math.round((metadata.width || 800) * scale);
      const newHeight = Math.round((metadata.height || 600) * scale);
      result = await sharp(buffer)
        .flatten({ background: { r: 255, g: 255, b: 255 } })
        .resize(newWidth, newHeight, { fit: 'inside', background: { r: 255, g: 255, b: 255 } })
        .jpeg({ quality: 60, progressive: true })
        .toBuffer();
      if (result.length <= maxBytes) return result;
      scale -= 0.1;
    }

    return result;
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

    // Ensure output directory exists
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const errors: string[] = [];
    let completed = 0;
    const startTime = Date.now();

    const processFile = async (filePath: string): Promise<void> => {
      const fileName = path.basename(filePath, path.extname(filePath));

      try {
        const result = await this.processor.processImage(filePath, settings);

        // Convert processed PNG to JPG, keeping white background
        const maxBytes = settings.maxFileSize ? settings.maxFileSize * 1024 : null;
        const jpgBuffer = await this.convertToJpgWithSizeLimit(result.buffer, maxBytes);
        await fs.promises.writeFile(path.join(outputDir, `${fileName}.jpg`), jpgBuffer);

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
