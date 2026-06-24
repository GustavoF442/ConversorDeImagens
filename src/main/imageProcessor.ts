import sharp from 'sharp';
import path from 'path';

export interface ProcessingSettings {
  mode: 'line-art' | 'line-art-solid' | 'technical-sheet' | 'silhouette';
  lineThickness: number;       // 1-10
  detectionSensitivity: number; // 1-100
  blackFillIntensity: number;   // 1-100
  contrast: number;             // 1-200
  sharpness: number;            // 1-100
  argoxMode: boolean;
  argoxDpi: 203 | 300;
  argoxMaxWidth: number;        // mm
  argoxMaxHeight: number;       // mm
  outputSize: { width: number; height: number } | null; // mm
  maxFileSize: number | null;   // KB
  removeBackground: boolean;
  solidifyDarkAreas: boolean;
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

export class ImageProcessor {
  async processImage(filePath: string, settings: ProcessingSettings): Promise<ProcessingResult> {
    const startTime = Date.now();

    let pipeline = sharp(filePath);
    const metadata = await pipeline.metadata();
    const originalWidth = metadata.width || 800;
    const originalHeight = metadata.height || 600;

    // Step 1: Normalize and prepare - flatten to white, convert to grayscale, then pure black & white
    pipeline = sharp(filePath)
      .flatten({ background: { r: 255, g: 255, b: 255 } })
      .removeAlpha()
      .greyscale()
      .toColorspace('b-w');

    // Step 2: Apply contrast
    const contrastFactor = settings.contrast / 100;
    pipeline = pipeline.linear(contrastFactor, -(128 * contrastFactor - 128));

    // Step 3: Apply sharpness
    if (settings.sharpness > 0) {
      const sigma = 0.5 + (settings.sharpness / 100) * 2;
      pipeline = pipeline.sharpen({ sigma });
    }

    // Step 4: Generate based on mode
    let resultBuffer: Buffer;

    switch (settings.mode) {
      case 'line-art':
        resultBuffer = await this.generateLineArt(pipeline, settings, originalWidth, originalHeight);
        break;
      case 'line-art-solid':
        resultBuffer = await this.generateLineArtWithSolids(pipeline, settings, originalWidth, originalHeight);
        break;
      case 'technical-sheet':
        resultBuffer = await this.generateTechnicalSheet(pipeline, settings, originalWidth, originalHeight);
        break;
      case 'silhouette':
        resultBuffer = await this.generateSilhouette(pipeline, settings, originalWidth, originalHeight);
        break;
      default:
        resultBuffer = await this.generateLineArt(pipeline, settings, originalWidth, originalHeight);
    }

    // Step 5: Argox optimization
    if (settings.argoxMode) {
      resultBuffer = await this.optimizeForArgox(resultBuffer, settings);
    }

    // Step 6: Resize if specified
    if (settings.outputSize) {
      const dpi = settings.argoxMode ? settings.argoxDpi : 300;
      const widthPx = Math.round((settings.outputSize.width / 25.4) * dpi);
      const heightPx = Math.round((settings.outputSize.height / 25.4) * dpi);
      resultBuffer = await sharp(resultBuffer)
        .resize(widthPx, heightPx, { fit: 'inside', background: { r: 255, g: 255, b: 255 } })
        .extend({
          top: 0, bottom: 0, left: 0, right: 0,
          background: { r: 255, g: 255, b: 255 },
        })
        .toBuffer();
    }

    // Step 7: Compress if max size specified
    if (settings.maxFileSize) {
      resultBuffer = await this.compressToSize(resultBuffer, settings.maxFileSize * 1024);
    }

    const processingTime = Date.now() - startTime;
    const resultMetadata = await sharp(resultBuffer).metadata();

    return {
      buffer: resultBuffer,
      width: resultMetadata.width || originalWidth,
      height: resultMetadata.height || originalHeight,
      size: resultBuffer.length,
      processingTime,
      originalPath: filePath,
      originalName: path.basename(filePath, path.extname(filePath)),
    };
  }

  async getPreview(filePath: string, settings: ProcessingSettings): Promise<string> {
    const result = await this.processImage(filePath, settings);
    const base64 = result.buffer.toString('base64');
    return `data:image/png;base64,${base64}`;
  }

  private async generateLineArt(
    pipeline: sharp.Sharp,
    settings: ProcessingSettings,
    width: number,
    height: number
  ): Promise<Buffer> {
    const threshold = Math.round(255 - (settings.detectionSensitivity / 100) * 200);
    const buf = await pipeline.toBuffer();

    // Edge detection via multi-pass sharpening and thresholding
    const edgeSigma = 0.5 + (settings.lineThickness / 10) * 2;
    const edges = await sharp(buf)
      .greyscale()
      .negate()
      .sharpen({ sigma: edgeSigma, m1: 10, m2: 5 })
      .negate()
      .threshold(threshold)
      .negate()
      .toBuffer();

    // Laplacian-like edge detection via difference
    const blurred = await sharp(buf)
      .greyscale()
      .blur(1 + settings.lineThickness * 0.5)
      .toBuffer();

    const original = await sharp(buf).greyscale().toBuffer();

    // Composite edges
    const composite = await sharp(original)
      .composite([
        { input: blurred, blend: 'difference' },
      ])
      .normalise()
      .threshold(threshold)
      .negate()
      .png()
      .toBuffer();

    // Combine both edge detection methods
    const result = await sharp(edges)
      .composite([
        { input: composite, blend: 'darken' },
      ])
      .png()
      .toBuffer();

    // Clean up: ensure pure black and white
    return sharp(result)
      .threshold(128)
      .png()
      .toBuffer();
  }

  private async generateLineArtWithSolids(
    pipeline: sharp.Sharp,
    settings: ProcessingSettings,
    width: number,
    height: number
  ): Promise<Buffer> {
    const lineArt = await this.generateLineArt(pipeline, settings, width, height);

    if (!settings.solidifyDarkAreas) {
      return lineArt;
    }

    const buf = await pipeline.toBuffer();

    // Detect dark/textured areas and fill with solid black
    const darkThreshold = Math.round(80 + ((100 - settings.blackFillIntensity) / 100) * 120);
    const darkAreas = await sharp(buf)
      .greyscale()
      .threshold(darkThreshold)
      .negate()
      .blur(2)
      .threshold(128)
      .png()
      .toBuffer();

    // Merge line art with solid dark areas
    return sharp(lineArt)
      .composite([
        { input: darkAreas, blend: 'darken' },
      ])
      .threshold(128)
      .png()
      .toBuffer();
  }

  private async generateTechnicalSheet(
    pipeline: sharp.Sharp,
    settings: ProcessingSettings,
    width: number,
    height: number
  ): Promise<Buffer> {
    const lineArtSolid = await this.generateLineArtWithSolids(pipeline, settings, width, height);

    // Add border frame and label area
    const borderWidth = 2;
    const labelHeight = 60;
    const totalHeight = height + labelHeight;

    const frame = await sharp({
      create: {
        width: width + borderWidth * 2,
        height: totalHeight + borderWidth * 2,
        channels: 3,
        background: { r: 255, g: 255, b: 255 },
      },
    })
      .composite([
        {
          input: lineArtSolid,
          top: borderWidth,
          left: borderWidth,
        },
      ])
      .png()
      .toBuffer();

    return frame;
  }

  private async generateSilhouette(
    pipeline: sharp.Sharp,
    settings: ProcessingSettings,
    _width: number,
    _height: number
  ): Promise<Buffer> {
    const threshold = Math.round(200 - (settings.detectionSensitivity / 100) * 150);
    const buf = await pipeline.toBuffer();

    return sharp(buf)
      .greyscale()
      .threshold(threshold)
      .negate()
      .blur(1)
      .threshold(128)
      .png()
      .toBuffer();
  }

  private async optimizeForArgox(buffer: Buffer, settings: ProcessingSettings): Promise<Buffer> {
    const dpi = settings.argoxDpi;
    const maxWidthPx = Math.round((settings.argoxMaxWidth / 25.4) * dpi);
    const maxHeightPx = Math.round((settings.argoxMaxHeight / 25.4) * dpi);

    return sharp(buffer)
      .resize(maxWidthPx, maxHeightPx, {
        fit: 'inside',
        background: { r: 255, g: 255, b: 255 },
      })
      .threshold(128)
      .png({ compressionLevel: 9 })
      .toBuffer();
  }

  private async compressToSize(buffer: Buffer, maxBytes: number): Promise<Buffer> {
    if (buffer.length <= maxBytes) {
      return buffer;
    }

    // Try increasing compression
    let result = await sharp(buffer).png({ compressionLevel: 9, effort: 10 }).toBuffer();
    if (result.length <= maxBytes) return result;

    // Progressively reduce dimensions
    const metadata = await sharp(buffer).metadata();
    let scale = 0.9;

    while (scale > 0.1) {
      const newWidth = Math.round((metadata.width || 800) * scale);
      const newHeight = Math.round((metadata.height || 600) * scale);

      result = await sharp(buffer)
        .resize(newWidth, newHeight)
        .threshold(128)
        .png({ compressionLevel: 9 })
        .toBuffer();

      if (result.length <= maxBytes) return result;
      scale -= 0.1;
    }

    return result;
  }
}

export interface ProcessingResult {
  buffer: Buffer;
  width: number;
  height: number;
  size: number;
  processingTime: number;
  originalPath: string;
  originalName: string;
}
