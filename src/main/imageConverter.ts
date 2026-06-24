import fs from 'fs';
import path from 'path';
import sharp from 'sharp';

const SUPPORTED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp', '.tiff', '.tif', '.gif'];

export interface ConversionResult {
  success: number;
  errors: string[];
}

export async function convertImages(
  files: string[],
  outputDir: string,
  targetFormat: string,
  quality: number
): Promise<ConversionResult> {
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const errors: string[] = [];
  let success = 0;

  for (const filePath of files) {
    const ext = path.extname(filePath).toLowerCase();
    if (!SUPPORTED_EXTENSIONS.includes(ext)) {
      errors.push(`${path.basename(filePath)}: formato nao suportado`);
      continue;
    }

    try {
      const baseName = path.basename(filePath, ext);
      const outputPath = path.join(outputDir, `${baseName}.${targetFormat}`);

      let pipeline = sharp(filePath);

      switch (targetFormat) {
        case 'jpeg':
        case 'jpg':
          await pipeline.jpeg({ quality, progressive: true }).toFile(outputPath);
          break;
        case 'png':
          await pipeline.png({ compressionLevel: 9 }).toFile(outputPath);
          break;
        case 'webp':
          await pipeline.webp({ quality }).toFile(outputPath);
          break;
        case 'tiff':
        case 'tif':
          await pipeline.tiff({ compression: 'jpeg' }).toFile(outputPath);
          break;
        default:
          await pipeline.toFormat(targetFormat as keyof sharp.FormatEnum).toFile(outputPath);
      }

      success++;
    } catch (err: any) {
      errors.push(`${path.basename(filePath)}: ${err.message}`);
    }
  }

  return { success, errors };
}
