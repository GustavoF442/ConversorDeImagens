import sharp from 'sharp';
import path from 'path';
import potrace from 'potrace';

function potraceTrace(buffer: Buffer, options: Record<string, unknown>): Promise<string> {
  return new Promise((resolve, reject) => {
    (potrace.trace as any)(buffer, options, (err: Error | null, svg: string) => {
      if (err) reject(err);
      else resolve(svg);
    });
  });
}

export interface ProcessingSettings {
  mode: 'line-art' | 'line-art-solid' | 'technical-sheet' | 'silhouette';
  lineThickness: number;        // 1-10
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

    const metadata = await sharp(filePath).metadata();
    const originalWidth = metadata.width || 800;
    const originalHeight = metadata.height || 600;

    let resultBuffer: Buffer;

    switch (settings.mode) {
      case 'silhouette':
        resultBuffer = await this.generateSilhouette(filePath, settings);
        break;
      case 'line-art':
        resultBuffer = await this.generateVectorLineArt(filePath, settings);
        break;
      case 'line-art-solid':
        resultBuffer = await this.generateVectorLineArtSolid(filePath, settings);
        break;
      case 'technical-sheet':
        resultBuffer = await this.generateTechnicalSheet(filePath, settings, originalWidth, originalHeight);
        break;
      default:
        resultBuffer = await this.generateVectorLineArtSolid(filePath, settings);
    }

    // Argox resize
    if (settings.argoxMode) {
      resultBuffer = await this.fitForArgox(resultBuffer, settings);
    }

    // Output size resize (mm → px)
    if (settings.outputSize) {
      const dpi = settings.argoxMode ? settings.argoxDpi : 300;
      const widthPx = Math.round((settings.outputSize.width / 25.4) * dpi);
      const heightPx = Math.round((settings.outputSize.height / 25.4) * dpi);
      resultBuffer = await sharp(resultBuffer)
        .resize(widthPx, heightPx, { fit: 'inside', background: { r: 255, g: 255, b: 255 } })
        .flatten({ background: { r: 255, g: 255, b: 255 } })
        .png()
        .toBuffer();
    }

    // File size control
    if (settings.maxFileSize) {
      resultBuffer = await this.compressJpgToSize(resultBuffer, settings.maxFileSize * 1024);
    }

    const processingTime = Date.now() - startTime;
    const resultMeta = await sharp(resultBuffer).metadata();

    return {
      buffer: resultBuffer,
      width: resultMeta.width || originalWidth,
      height: resultMeta.height || originalHeight,
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

  /**
   * Prepara um bitmap binarizado (apenas 0 ou 255) para o Potrace.
   * Pipeline:
   *  1. Achatar fundo transparente → branco
   *  2. Grayscale
   *  3. Aumentar contraste fortemente (linear)
   *  4. Limpar ruído com blur leve
   *  5. Threshold — divide em preto/branco puro sem cinza
   */
  private async prepareBinaryBitmap(
    filePath: string,
    settings: ProcessingSettings,
    targetWidth?: number
  ): Promise<Buffer> {
    // Threshold central: quanto menor, mais preto; quanto maior, mais branco
    const thresh = Math.round(180 - (settings.detectionSensitivity / 100) * 120);

    let pipe = sharp(filePath)
      .flatten({ background: { r: 255, g: 255, b: 255 } })
      .removeAlpha()
      .greyscale();

    // Resize para largura alvo (melhora qualidade do Potrace)
    if (targetWidth) {
      pipe = pipe.resize(targetWidth, undefined, { fit: 'inside', withoutEnlargement: false });
    }

    // Aumentar contraste com linear: escurece sombras e clareia altas luzes
    const cf = (settings.contrast / 100) * 1.8 + 0.2;
    pipe = pipe.linear(cf, -(128 * cf - 128));

    // Sharpness antes do threshold ajuda a recuperar detalhes de bordas
    if (settings.sharpness > 20) {
      const sigma = 0.3 + (settings.sharpness / 100) * 1.5;
      pipe = pipe.sharpen({ sigma });
    }

    // Blur muito leve para eliminar ruído fotográfico
    pipe = pipe.blur(0.4);

    return pipe
      .threshold(thresh)
      .png()
      .toBuffer();
  }

  /**
   * Vetoriza a silhueta: tudo que é escuro vira preto sólido.
   * Usa Potrace em modo "fill" para preencher completamente.
   */
  private async generateSilhouette(
    filePath: string,
    settings: ProcessingSettings
  ): Promise<Buffer> {
    const binaryBuf = await this.prepareBinaryBitmap(filePath, settings, 1200);

    const svg = await potraceTrace(binaryBuf, {
      threshold: 128,
      turdSize: 6,
      alphaMax: 1.0,
      optCurve: true,
      optTolerance: 0.2,
    });

    // Renderiza SVG → PNG preto/branco puro
    return this.svgToCleanPng(svg, settings);
  }

  /**
   * Line Art puro: detecta contornos do tênis e desenha apenas as bordas.
   * Usa diferença entre original e versão borrada para isolar bordas,
   * depois vetoriza com Potrace.
   */
  private async generateVectorLineArt(
    filePath: string,
    settings: ProcessingSettings
  ): Promise<Buffer> {
    const binaryBuf = await this.prepareBinaryBitmap(filePath, settings, 1200);

    // Detectar bordas: diferença entre bitmap e versão dilatada
    const dilated = await sharp(binaryBuf)
      .blur(1 + settings.lineThickness * 0.4)
      .threshold(128)
      .png()
      .toBuffer();

    // Bordas = pixels que diferem entre original e dilatado
    const edges = await sharp(binaryBuf)
      .composite([{ input: dilated, blend: 'difference' }])
      .threshold(10)
      .negate()  // bordas ficam pretas
      .png()
      .toBuffer();

    const svg = await potraceTrace(edges, {
      threshold: 128,
      turdSize: 3,
      alphaMax: 0.8,
      optCurve: true,
      optTolerance: 0.4,
    });

    return this.svgToCleanPng(svg, settings);
  }

  /**
   * Line Art + Sólido: principal modo para Argox.
   * Combina:
   *  - Silhueta (preenchimento sólido das áreas escuras)
   *  - Contornos reforçados
   * Resultado: ilustração vetorial com fill preto + linhas limpas.
   */
  private async generateVectorLineArtSolid(
    filePath: string,
    settings: ProcessingSettings
  ): Promise<Buffer> {
    const binaryBuf = await this.prepareBinaryBitmap(filePath, settings, 1200);

    // --- Camada 1: preenchimentos sólidos ---
    // Threshold mais agressivo para solidificar áreas escuras (tecido, sola)
    const darkThresh = Math.round(160 + ((100 - settings.blackFillIntensity) / 100) * 70);
    const darkBuf = await sharp(filePath)
      .flatten({ background: { r: 255, g: 255, b: 255 } })
      .removeAlpha()
      .greyscale()
      .resize(1200, undefined, { fit: 'inside' })
      .linear((settings.contrast / 100) * 2.0, -60)
      .blur(0.5)
      .threshold(darkThresh)
      .png()
      .toBuffer();

    // Fechar lacunas pequenas nas áreas escuras (morphological close)
    const closedDark = await sharp(darkBuf)
      .blur(2)
      .threshold(100)
      .png()
      .toBuffer();

    // Vetorizar preenchimentos
    const svgFill = await potraceTrace(closedDark, {
      threshold: 128,
      turdSize: 8,
      alphaMax: 1.0,
      optCurve: true,
      optTolerance: 0.2,
    });

    // --- Camada 2: contornos externos reforçados ---
    const dilateRadius = 1 + Math.round(settings.lineThickness * 0.5);
    const dilated = await sharp(binaryBuf)
      .blur(dilateRadius)
      .threshold(128)
      .png()
      .toBuffer();

    const contourBuf = await sharp(binaryBuf)
      .composite([{ input: dilated, blend: 'difference' }])
      .threshold(10)
      .negate()
      .png()
      .toBuffer();

    const svgContour = await potraceTrace(contourBuf, {
      threshold: 128,
      turdSize: 2,
      alphaMax: 0.6,
      optCurve: true,
      optTolerance: 0.3,
    });

    // --- Composição: merge preenchimento + contornos em um único SVG ---
    const mergedSvg = this.mergeSvgLayers(svgFill, svgContour);

    return this.svgToCleanPng(mergedSvg, settings);
  }

  /**
   * Ficha Técnica: Contorno+Sólido + frame de borda para catálogo.
   */
  private async generateTechnicalSheet(
    filePath: string,
    settings: ProcessingSettings,
    originalWidth: number,
    originalHeight: number
  ): Promise<Buffer> {
    const content = await this.generateVectorLineArtSolid(filePath, settings);
    const meta = await sharp(content).metadata();
    const w = meta.width || originalWidth;
    const h = meta.height || originalHeight;

    const border = 3;
    const padBottom = 50;

    return sharp({
      create: {
        width: w + border * 2,
        height: h + border * 2 + padBottom,
        channels: 3,
        background: { r: 255, g: 255, b: 255 },
      },
    })
      .composite([
        { input: content, top: border, left: border },
        {
          input: Buffer.from(
            `<svg width="${w + border * 2}" height="${h + border * 2 + padBottom}">` +
            `<rect x="1" y="1" width="${w + border * 2 - 2}" height="${h + border * 2 + padBottom - 2}" ` +
            `fill="none" stroke="black" stroke-width="2"/>` +
            `</svg>`
          ),
          top: 0, left: 0,
        },
      ])
      .png()
      .toBuffer();
  }

  /**
   * Ajusta para impressão Argox: redimensiona dentro do limite mm e garante preto/branco puro.
   */
  private async fitForArgox(buffer: Buffer, settings: ProcessingSettings): Promise<Buffer> {
    const dpi = settings.argoxDpi;
    const maxW = Math.round((settings.argoxMaxWidth / 25.4) * dpi);
    const maxH = Math.round((settings.argoxMaxHeight / 25.4) * dpi);

    return sharp(buffer)
      .resize(maxW, maxH, { fit: 'inside', background: { r: 255, g: 255, b: 255 } })
      .flatten({ background: { r: 255, g: 255, b: 255 } })
      .threshold(128)
      .png({ compressionLevel: 9 })
      .toBuffer();
  }

  /**
   * Comprime para JPEG garantindo tamanho máximo em bytes.
   * Reduz qualidade primeiro, depois escala.
   */
  async compressJpgToSize(buffer: Buffer, maxBytes: number): Promise<Buffer> {
    for (let quality = 95; quality >= 20; quality -= 5) {
      const out = await sharp(buffer)
        .flatten({ background: { r: 255, g: 255, b: 255 } })
        .jpeg({ quality, progressive: true })
        .toBuffer();
      if (out.length <= maxBytes) return out;
    }

    const meta = await sharp(buffer).metadata();
    let scale = 0.85;
    while (scale > 0.15) {
      const nw = Math.round((meta.width || 800) * scale);
      const nh = Math.round((meta.height || 600) * scale);
      const out = await sharp(buffer)
        .flatten({ background: { r: 255, g: 255, b: 255 } })
        .resize(nw, nh)
        .jpeg({ quality: 30, progressive: true })
        .toBuffer();
      if (out.length <= maxBytes) return out;
      scale -= 0.1;
    }

    return sharp(buffer)
      .flatten({ background: { r: 255, g: 255, b: 255 } })
      .jpeg({ quality: 20 })
      .toBuffer();
  }

  /**
   * Converte SVG do Potrace para PNG preto/branco puro via rasterização.
   * Remove qualquer cinza ou antialiasing do resultado.
   */
  private async svgToCleanPng(svg: string, settings: ProcessingSettings): Promise<Buffer> {
    // Extrair viewBox / width / height do SVG
    const wMatch = svg.match(/width="(\d+)"/);
    const hMatch = svg.match(/height="(\d+)"/);
    const svgW = wMatch ? parseInt(wMatch[1]) : 1200;
    const svgH = hMatch ? parseInt(hMatch[1]) : 900;

    // Garantir cores corretas: fundo branco, paths pretos
    const cleanSvg = this.normalizeSvgColors(svg);

    // Rasterizar SVG com sharp
    const rasterized = await sharp(Buffer.from(cleanSvg))
      .png()
      .toBuffer();

    // Threshold final: elimina qualquer pixel de antialiasing cinza
    return sharp(rasterized)
      .greyscale()
      .threshold(200)
      .flatten({ background: { r: 255, g: 255, b: 255 } })
      .png()
      .toBuffer();
  }

  /**
   * Garante que o SVG tem fundo branco e paths pretos (#000000).
   */
  private normalizeSvgColors(svg: string): string {
    // Substituir fill de paths por preto puro
    let out = svg
      .replace(/fill="[^"]*"/g, 'fill="#000000"')
      .replace(/stroke="[^"]*"/g, 'stroke="#000000"');

    // Garantir fundo branco antes dos paths
    if (!out.includes('fill="#ffffff"') && !out.includes("fill='#ffffff'") && !out.includes('fill="white"')) {
      out = out.replace(/<svg([^>]*)>/, (m) => {
        return m + `<rect width="100%" height="100%" fill="#ffffff"/>`;
      });
    }

    return out;
  }

  /**
   * Mescla dois SVGs do Potrace em um único documento,
   * colocando o preenchimento embaixo e os contornos em cima.
   */
  private mergeSvgLayers(svgFill: string, svgContour: string): string {
    const extractPaths = (svg: string): string => {
      const match = svg.match(/<g[^>]*>([\s\S]*)<\/g>/);
      return match ? match[1] : '';
    };

    const wMatch = svgFill.match(/width="(\d+)"/);
    const hMatch = svgFill.match(/height="(\d+)"/);
    const viewMatch = svgFill.match(/viewBox="([^"]+)"/);
    const w = wMatch ? wMatch[1] : '1200';
    const h = hMatch ? hMatch[1] : '900';
    const viewBox = viewMatch ? viewMatch[1] : `0 0 ${w} ${h}`;

    const fillPaths = extractPaths(svgFill);
    const contourPaths = extractPaths(svgContour);

    return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="${viewBox}">
  <rect width="100%" height="100%" fill="#ffffff"/>
  <g fill="#000000" stroke="none">${fillPaths}</g>
  <g fill="#000000" stroke="none">${contourPaths}</g>
</svg>`;
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
