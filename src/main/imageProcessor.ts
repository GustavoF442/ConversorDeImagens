import sharp from 'sharp';
import path from 'path';
import potrace from 'potrace';

/**
 * Wrapper para potrace.trace com opções tipadas.
 * A lib usa callback (buffer, options, cb) — promisify não funciona
 * pois os tipos declaram apenas 1 argumento.
 */
function potraceTrace(buffer: Buffer, options: Record<string, unknown>): Promise<string> {
  return new Promise((resolve, reject) => {
    (potrace.trace as any)(buffer, options, (err: Error | null, svg: string) => {
      if (err) reject(err);
      else resolve(svg);
    });
  });
}

/**
 * Aplica CLAHE simulado (contraste adaptativo local) via:
 *  1. Normalização linear intensa
 *  2. Gamma correction (brighten produtos claros)
 *  3. Sharpening (Unsharp Mask)
 *
 * Finalidade: realçar detalhes de forma independente da luminosidade global,
 * para que sandálias rosa ou chinelos bege em fundo branco mantenham
 * bordas e divisões de peças detectáveis.
 */
async function applyCLAHE(
  buffer: Buffer,
  contrastFactor: number,   // 0.5 – 2.0
  sharpnessFactor: number,  // 0 – 100
  gamma: number             // 0.5 – 2.0 (< 1 = clarea, > 1 = escurece)
): Promise<Buffer> {
  let pipe = sharp(buffer).greyscale();

  // Normalização: estica o histograma para 0–255
  pipe = pipe.normalise();

  // Contraste linear forte
  const cf = Math.max(0.5, contrastFactor);
  pipe = pipe.linear(cf, -(128 * cf - 128));

  // Gamma para clarear regiões de baixo contraste.
  // sharp.gamma() aceita 1.0–3.0 (> 1 escurece, encode phase).
  // Para clarear (< 1), usamos linear adicional.
  if (gamma >= 1.0 && gamma <= 3.0) {
    pipe = pipe.gamma(gamma);
  } else if (gamma < 1.0) {
    // Simula gamma < 1 (clareamento) via linear boost
    const boost = 1.0 + (1.0 - gamma) * 0.6;
    pipe = pipe.linear(boost, 0);
  }

  // Unsharp Mask
  if (sharpnessFactor > 10) {
    const sigma = 0.3 + (sharpnessFactor / 100) * 2.5;
    pipe = pipe.sharpen({ sigma, m1: 1.5, m2: 0.7 });
  }

  return pipe.png().toBuffer();
}

/**
 * Detecta bordas por gradiente Sobel simulado com sharp:
 *  1. Converte para greyscale + aplica CLAHE
 *  2. Blur leve para suavizar ruído
 *  3. Diferença entre imagem original e versão suavizada = bordas
 *  4. Normaliza e threshold adaptativo
 *
 * Funciona mesmo em produtos monocromáticos porque usa GRADIENTE
 * de luminância, não valor absoluto de escuro.
 */
async function detectEdgesByGradient(
  greyBuf: Buffer,
  sensitivity: number,  // 1–100 (maior = mais bordas)
  lineThickness: number // 1–10
): Promise<Buffer> {
  const blurRadius = 0.6 + lineThickness * 0.2;

  // Imagem original normalizada
  const orig = await sharp(greyBuf).normalise().png().toBuffer();

  // Versão borrada (simula região média local)
  const blurred = await sharp(greyBuf)
    .blur(blurRadius + 1.0)
    .normalise()
    .png()
    .toBuffer();

  // Diferença = bordas (regiões de transição de qualquer intensidade)
  const diff = await sharp(orig)
    .composite([{ input: blurred, blend: 'difference' }])
    .normalise()
    .png()
    .toBuffer();

  // Threshold adaptativo: ajustado pela sensibilidade
  // Alta sensibilidade → mais bordas detectadas
  const thresh = Math.round(255 - (sensitivity / 100) * 230);

  return sharp(diff)
    .threshold(thresh)
    .negate()           // bordas ficam pretas, fundo branco
    .png()
    .toBuffer();
}

/**
 * Extrai silhueta do produto por segmentação baseada em:
 *  1. Detecção de região de interesse por gradiente
 *  2. Flood-fill dos contornos externos
 *  3. Morphological close para fechar lacunas
 *
 * IMPORTANTE: NÃO usa threshold de escuro — funciona com
 * qualquer produto independente de cor.
 */
async function extractSilhouetteByGradient(
  greyBuf: Buffer,
  sensitivity: number,
  fillIntensity: number
): Promise<Buffer> {
  // Gradiente de bordas fortes
  const blurLight = await sharp(greyBuf).blur(1.5).normalise().png().toBuffer();
  const blurHeavy = await sharp(greyBuf).blur(8).normalise().png().toBuffer();

  // Diferença entre escalas = estrutura do objeto (DoG - Difference of Gaussians)
  const dog = await sharp(blurLight)
    .composite([{ input: blurHeavy, blend: 'difference' }])
    .normalise()
    .png()
    .toBuffer();

  // Threshold para extrair máscara
  const thresh = Math.round(255 - (sensitivity / 100) * 220);
  const mask = await sharp(dog)
    .threshold(thresh)
    .negate()
    .png()
    .toBuffer();

  // Fechar lacunas: blur → threshold cria efeito de close morfológico
  const closeRadius = 2 + Math.round((fillIntensity / 100) * 6);
  return sharp(mask)
    .blur(closeRadius)
    .threshold(100)
    .png()
    .toBuffer();
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
    const originalWidth  = metadata.width  || 800;
    const originalHeight = metadata.height || 600;

    // 1. Preparar base greyscale normalizada (entrada comum a todos os modos)
    const greyBuf = await this.prepareGreyscale(filePath, settings);

    // 2. Gerar ilustração pelo modo selecionado
    let resultBuffer: Buffer;
    switch (settings.mode) {
      case 'silhouette':
        resultBuffer = await this.modeSilhouette(greyBuf, settings);
        break;
      case 'line-art':
        resultBuffer = await this.modeLineArt(greyBuf, settings);
        break;
      case 'line-art-solid':
        resultBuffer = await this.modeLineArtSolid(filePath, greyBuf, settings);
        break;
      case 'technical-sheet':
        resultBuffer = await this.modeTechnicalSheet(filePath, greyBuf, settings, originalWidth, originalHeight);
        break;
      default:
        resultBuffer = await this.modeLineArtSolid(filePath, greyBuf, settings);
    }

    // 3. Argox: redimensionar para etiqueta e garantir 1-bit
    if (settings.argoxMode) {
      resultBuffer = await this.fitForArgox(resultBuffer, settings);
    }

    // 4. Resize para tamanho mm configurado
    if (settings.outputSize) {
      const dpi = settings.argoxMode ? settings.argoxDpi : 300;
      const widthPx  = Math.round((settings.outputSize.width  / 25.4) * dpi);
      const heightPx = Math.round((settings.outputSize.height / 25.4) * dpi);
      resultBuffer = await sharp(resultBuffer)
        .resize(widthPx, heightPx, { fit: 'inside', background: { r: 255, g: 255, b: 255 } })
        .flatten({ background: { r: 255, g: 255, b: 255 } })
        .png()
        .toBuffer();
    }

    // 5. Limitar tamanho do arquivo
    if (settings.maxFileSize) {
      resultBuffer = await this.compressJpgToSize(resultBuffer, settings.maxFileSize * 1024);
    }

    const processingTime = Date.now() - startTime;
    const resultMeta = await sharp(resultBuffer).metadata();

    return {
      buffer: resultBuffer,
      width:  resultMeta.width  || originalWidth,
      height: resultMeta.height || originalHeight,
      size:   resultBuffer.length,
      processingTime,
      originalPath: filePath,
      originalName: path.basename(filePath, path.extname(filePath)),
    };
  }

  async getPreview(filePath: string, settings: ProcessingSettings): Promise<string> {
    const result = await this.processImage(filePath, settings);
    return `data:image/png;base64,${result.buffer.toString('base64')}`;
  }

  // ─────────────────────────────────────────────────────────
  // PREPARAÇÃO BASE
  // ─────────────────────────────────────────────────────────

  /**
   * Passo 1 comum a todos os modos:
   *  - Achata fundo transparente → branco
   *  - Converte para greyscale
   *  - Redimensiona para largura máxima de trabalho (1400px)
   *  - Aplica CLAHE: normalise + contraste linear + gamma + sharpening
   *
   * Resultado: imagem em escala de cinza com máximo de contraste local,
   * detalhes realçados, sem limitar por cor do produto.
   */
  private async prepareGreyscale(filePath: string, settings: ProcessingSettings): Promise<Buffer> {
    const contrastFactor  = (settings.contrast / 100) * 1.6 + 0.2;
    const sharpnessFactor = settings.sharpness;

    const base = await sharp(filePath)
      .flatten({ background: { r: 255, g: 255, b: 255 } })
      .removeAlpha()
      .greyscale()
      .resize(1400, undefined, { fit: 'inside', withoutEnlargement: false })
      .png()
      .toBuffer();

    return applyCLAHE(base, contrastFactor, sharpnessFactor, 0.85);
  }

  // ─────────────────────────────────────────────────────────
  // MODOS DE SAÍDA
  // ─────────────────────────────────────────────────────────

  /**
   * MODO SILHUETA:
   * Extrai contorno externo do produto por DoG (Difference of Gaussians).
   * Preenche completamente com preto sólido.
   * Funciona com qualquer cor de produto — detecta forma, não escuridão.
   */
  private async modeSilhouette(
    greyBuf: Buffer,
    settings: ProcessingSettings
  ): Promise<Buffer> {
    const silhouette = await extractSilhouetteByGradient(
      greyBuf,
      settings.detectionSensitivity,
      settings.blackFillIntensity
    );

    const svg = await potraceTrace(silhouette, {
      threshold: 128,
      turdSize:  8,
      alphaMax:  1.0,
      optCurve:  true,
      optTolerance: 0.2,
    });

    return this.svgToCleanPng(svg);
  }

  /**
   * MODO CONTORNO (LINE ART):
   * Detecta bordas por gradiente de luminância — não por threshold de escuro.
   * Vetoriza com Potrace para curvas suaves.
   * Ideal para produtos de qualquer cor.
   */
  private async modeLineArt(
    greyBuf: Buffer,
    settings: ProcessingSettings
  ): Promise<Buffer> {
    const edges = await detectEdgesByGradient(
      greyBuf,
      settings.detectionSensitivity,
      settings.lineThickness
    );

    // Segunda passagem: bordas mais grossas por dilatação
    const dilateRadius = 0.5 + settings.lineThickness * 0.3;
    const thickEdges = await sharp(edges)
      .negate()                           // preto → branco
      .blur(dilateRadius)
      .threshold(180)
      .negate()                           // voltar: bordas pretas
      .png()
      .toBuffer();

    const svg = await potraceTrace(thickEdges, {
      threshold:    128,
      turdSize:     2,
      alphaMax:     0.8,
      optCurve:     true,
      optTolerance: 0.4,
    });

    return this.svgToCleanPng(svg);
  }

  /**
   * MODO CONTORNO + PREENCHIDO (padrão Argox):
   * Combina três camadas:
   *  1. Bordas externas (contorno do produto)
   *  2. Bordas internas (divisões de peças, cadarços, costuras)
   *  3. Preenchimento de áreas naturalmente escuras (sola, tiras escuras)
   *
   * A camada de bordas usa GRADIENTE — não threshold de escuro.
   * A camada de preenchimento usa threshold absoluto APENAS como
   * complemento, não como fonte principal de informação.
   */
  private async modeLineArtSolid(
    filePath: string,
    greyBuf: Buffer,
    settings: ProcessingSettings
  ): Promise<Buffer> {
    // --- Camada A: Bordas por gradiente ---
    const edges = await detectEdgesByGradient(
      greyBuf,
      settings.detectionSensitivity,
      settings.lineThickness
    );
    const dilateRadius = 0.6 + settings.lineThickness * 0.35;
    const thickEdges = await sharp(edges)
      .negate().blur(dilateRadius).threshold(160).negate().png().toBuffer();

    // --- Camada B: Silhueta geral por DoG ---
    const silhouette = await extractSilhouetteByGradient(
      greyBuf,
      Math.min(settings.detectionSensitivity + 15, 100),
      settings.blackFillIntensity
    );
    // Converter silhueta para apenas contorno externo (erode da silhueta)
    const silhouetteEroded = await sharp(silhouette)
      .negate().blur(2 + settings.lineThickness * 0.3).threshold(140).negate().png().toBuffer();
    const silhouetteContour = await sharp(silhouette)
      .composite([{ input: silhouetteEroded, blend: 'difference' }])
      .threshold(10).negate().png().toBuffer();

    // --- Camada C: Preenchimentos de áreas escuras (COMPLEMENTAR) ---
    // Só funciona para pixels genuinamente escuros — não apaga produtos claros
    const darkThresh = settings.solidifyDarkAreas
      ? Math.round(80 + ((100 - settings.blackFillIntensity) / 100) * 100)
      : 0;
    let fillLayer: Buffer | null = null;
    if (settings.solidifyDarkAreas && darkThresh > 0) {
      const darkRaw = await sharp(filePath)
        .flatten({ background: { r: 255, g: 255, b: 255 } })
        .removeAlpha()
        .greyscale()
        .resize(1400, undefined, { fit: 'inside' })
        .normalise()
        .threshold(darkThresh)
        .png()
        .toBuffer();
      fillLayer = await sharp(darkRaw)
        .blur(2).threshold(100).png().toBuffer();
    }

    // --- Compor camadas em SVG único ---
    const svgEdges     = await potraceTrace(thickEdges, { threshold: 128, turdSize: 2, alphaMax: 0.7, optCurve: true, optTolerance: 0.3 });
    const svgSilhouette= await potraceTrace(silhouetteContour, { threshold: 128, turdSize: 4, alphaMax: 1.0, optCurve: true, optTolerance: 0.2 });
    const svgFill      = fillLayer ? await potraceTrace(fillLayer, { threshold: 128, turdSize: 8, alphaMax: 1.0, optCurve: true, optTolerance: 0.2 }) : null;

    const merged = this.mergeSvgLayers([svgSilhouette, svgEdges, ...(svgFill ? [svgFill] : [])]);
    return this.svgToCleanPng(merged);
  }

  /**
   * MODO FICHA TÉCNICA:
   * Line Art + Preenchido com frame de catálogo.
   */
  private async modeTechnicalSheet(
    filePath: string,
    greyBuf: Buffer,
    settings: ProcessingSettings,
    originalWidth: number,
    originalHeight: number
  ): Promise<Buffer> {
    const content = await this.modeLineArtSolid(filePath, greyBuf, settings);
    const meta    = await sharp(content).metadata();
    const w = meta.width  || originalWidth;
    const h = meta.height || originalHeight;
    const border = 3, padBottom = 50;

    return sharp({
      create: {
        width:    w + border * 2,
        height:   h + border * 2 + padBottom,
        channels: 3,
        background: { r: 255, g: 255, b: 255 },
      },
    })
      .composite([
        { input: content, top: border, left: border },
        {
          input: Buffer.from(
            `<svg xmlns="http://www.w3.org/2000/svg" width="${w + border * 2}" height="${h + border * 2 + padBottom}">` +
            `<rect x="1" y="1" width="${w + border * 2 - 2}" height="${h + border * 2 + padBottom - 2}" ` +
            `fill="none" stroke="#000000" stroke-width="2"/></svg>`
          ),
          top: 0, left: 0,
        },
      ])
      .png()
      .toBuffer();
  }

  // ─────────────────────────────────────────────────────────
  // UTILITÁRIOS
  // ─────────────────────────────────────────────────────────

  /**
   * Redimensiona para etiqueta Argox e converte para 1-bit puro.
   */
  private async fitForArgox(buffer: Buffer, settings: ProcessingSettings): Promise<Buffer> {
    const dpi  = settings.argoxDpi;
    const maxW = Math.round((settings.argoxMaxWidth  / 25.4) * dpi);
    const maxH = Math.round((settings.argoxMaxHeight / 25.4) * dpi);

    return sharp(buffer)
      .resize(maxW, maxH, { fit: 'inside', background: { r: 255, g: 255, b: 255 } })
      .flatten({ background: { r: 255, g: 255, b: 255 } })
      .threshold(128)
      .png({ compressionLevel: 9 })
      .toBuffer();
  }

  /**
   * Comprime para JPEG dentro do limite de bytes.
   * Reduz qualidade (95→20), depois dimensões.
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
      const nw = Math.round((meta.width  || 800) * scale);
      const nh = Math.round((meta.height || 600) * scale);
      const out = await sharp(buffer)
        .flatten({ background: { r: 255, g: 255, b: 255 } })
        .resize(nw, nh)
        .jpeg({ quality: 30, progressive: true })
        .toBuffer();
      if (out.length <= maxBytes) return out;
      scale -= 0.1;
    }
    return sharp(buffer).flatten({ background: { r: 255, g: 255, b: 255 } }).jpeg({ quality: 20 }).toBuffer();
  }

  /**
   * Rasteriza SVG do Potrace para PNG preto/branco puro.
   * Aplica threshold 200 para eliminar antialiasing cinza.
   */
  private async svgToCleanPng(svg: string): Promise<Buffer> {
    const cleanSvg = svg
      .replace(/fill="[^"]*"/g, 'fill="#000000"')
      .replace(/stroke="[^"]*"/g, 'stroke="#000000"')
      .replace(/<svg([^>]*)>/, (m) => m + `<rect width="100%" height="100%" fill="#ffffff"/>`);

    const rasterized = await sharp(Buffer.from(cleanSvg)).png().toBuffer();
    return sharp(rasterized)
      .greyscale()
      .threshold(200)
      .flatten({ background: { r: 255, g: 255, b: 255 } })
      .png()
      .toBuffer();
  }

  /**
   * Mescla N SVGs do Potrace em um único documento.
   * A ordem da lista define a ordem de renderização (primeiro = baixo).
   */
  private mergeSvgLayers(svgs: string[]): string {
    const extract = (svg: string) => {
      const m = svg.match(/<g[^>]*>([\s\S]*?)<\/g>/);
      return m ? m[1] : '';
    };
    const first   = svgs[0] || '';
    const wMatch  = first.match(/width="(\d+)"/);
    const hMatch  = first.match(/height="(\d+)"/);
    const vMatch  = first.match(/viewBox="([^"]+)"/);
    const w = wMatch ? wMatch[1] : '1400';
    const h = hMatch ? hMatch[1] : '1050';
    const viewBox = vMatch ? vMatch[1] : `0 0 ${w} ${h}`;

    const layers = svgs
      .map(s => `<g fill="#000000" stroke="none">${extract(s)}</g>`)
      .join('\n  ');

    return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="${viewBox}">
  <rect width="100%" height="100%" fill="#ffffff"/>
  ${layers}
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
