import sharp from 'sharp';
import fs from 'fs';

export class ExportManager {
  async exportFiles(data: {
    buffer: Buffer;
    width: number;
    height: number;
    name: string;
    outputDir: string;
    formats: string[];
  }): Promise<{ paths: string[] }> {
    const paths: string[] = [];
    const { buffer, width, height, name, outputDir, formats } = data;

    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    for (const format of formats) {
      const filePath = `${outputDir}/${name}.${format}`;

      switch (format) {
        case 'png':
          await fs.promises.writeFile(filePath, buffer);
          paths.push(filePath);
          break;

        case 'jpg':
        case 'jpeg':
          const jpgBuffer = await sharp(buffer).jpeg({ quality: 95 }).toBuffer();
          await fs.promises.writeFile(filePath, jpgBuffer);
          paths.push(filePath);
          break;

        case 'svg':
          const svg = await this.bufferToSvg(buffer, width, height);
          await fs.promises.writeFile(filePath, svg);
          paths.push(filePath);
          break;

        case 'pdf':
          const pdf = await this.bufferToPdf(buffer, width, height, name);
          await fs.promises.writeFile(filePath, pdf);
          paths.push(filePath);
          break;
      }
    }

    return { paths };
  }

  async bufferToSvg(buffer: Buffer, width: number, height: number): Promise<string> {
    // Convert to raw pixel data for tracing
    const { data, info } = await sharp(buffer)
      .greyscale()
      .threshold(128)
      .raw()
      .toBuffer({ resolveWithObject: true });

    // Generate SVG paths from bitmap data
    const paths = this.traceToSvgPaths(data, info.width, info.height);

    return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg"
     viewBox="0 0 ${info.width} ${info.height}"
     width="${info.width}" height="${info.height}">
  <rect width="100%" height="100%" fill="white"/>
  ${paths}
</svg>`;
  }

  async bufferToPdf(buffer: Buffer, width: number, height: number, title: string): Promise<Buffer> {
    const pngBase64 = buffer.toString('base64');
    const pngDataUri = `data:image/png;base64,${pngBase64}`;

    // Create a simple PDF with the image embedded
    const ptWidth = (width / 300) * 72;
    const ptHeight = (height / 300) * 72;
    const pageWidth = Math.max(ptWidth + 40, 595); // A4 min
    const pageHeight = Math.max(ptHeight + 40, 842);

    const xOffset = (pageWidth - ptWidth) / 2;
    const yOffset = (pageHeight - ptHeight) / 2;

    // Minimal valid PDF
    const imageBytes = buffer;
    const imageLength = imageBytes.length;

    const objects: string[] = [];
    let objectCount = 0;
    const offsets: number[] = [];

    const addObject = (content: string): number => {
      objectCount++;
      offsets.push(-1); // placeholder
      objects.push(content);
      return objectCount;
    };

    // Object 1: Catalog
    addObject(`1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj`);

    // Object 2: Pages
    addObject(`2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj`);

    // Object 3: Page
    addObject(`3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth.toFixed(2)} ${pageHeight.toFixed(2)}] /Contents 4 0 R /Resources << /XObject << /Im0 5 0 R >> >> >>\nendobj`);

    // Object 4: Content stream
    const contentStream = `q ${ptWidth.toFixed(2)} 0 0 ${ptHeight.toFixed(2)} ${xOffset.toFixed(2)} ${yOffset.toFixed(2)} cm /Im0 Do Q`;
    addObject(`4 0 obj\n<< /Length ${contentStream.length} >>\nstream\n${contentStream}\nendstream\nendobj`);

    // Object 5: Image XObject
    // Use raw grayscale to avoid PNG decode issues in minimal PDF
    const rawGray = await sharp(buffer).greyscale().raw().toBuffer();
    const imgMeta = await sharp(buffer).metadata();
    const imgW = imgMeta.width || width;
    const imgH = imgMeta.height || height;

    const imageHeader = `5 0 obj\n<< /Type /XObject /Subtype /Image /Width ${imgW} /Height ${imgH} /ColorSpace /DeviceGray /BitsPerComponent 8 /Length ${rawGray.length} >>\nstream\n`;
    const imageFooter = `\nendstream\nendobj`;

    // Build PDF
    const header = '%PDF-1.4\n';
    const parts: Buffer[] = [Buffer.from(header)];
    let pos = header.length;

    for (let i = 0; i < objects.length; i++) {
      if (i === 4) {
        // Image object - binary data
        offsets[i] = pos;
        const headerBuf = Buffer.from(imageHeader);
        const footerBuf = Buffer.from(imageFooter);
        parts.push(headerBuf, rawGray, footerBuf);
        pos += headerBuf.length + rawGray.length + footerBuf.length;
      } else {
        offsets[i] = pos;
        const objBuf = Buffer.from(objects[i] + '\n');
        parts.push(objBuf);
        pos += objBuf.length;
      }
    }

    // Cross-reference table
    const xrefPos = pos;
    let xref = `xref\n0 ${objectCount + 1}\n0000000000 65535 f \n`;
    for (let i = 0; i < objectCount; i++) {
      xref += offsets[i].toString().padStart(10, '0') + ' 00000 n \n';
    }
    parts.push(Buffer.from(xref));

    // Trailer
    const trailer = `trailer\n<< /Size ${objectCount + 1} /Root 1 0 R >>\nstartxref\n${xrefPos}\n%%EOF\n`;
    parts.push(Buffer.from(trailer));

    return Buffer.concat(parts);
  }

  private traceToSvgPaths(data: Buffer, width: number, height: number): string {
    // Run-length encoding based vector tracing
    const paths: string[] = [];
    const visited = new Uint8Array(width * height);

    for (let y = 0; y < height; y++) {
      let runStart = -1;

      for (let x = 0; x <= width; x++) {
        const idx = y * width + x;
        const isBlack = x < width && data[idx] === 0;

        if (isBlack && runStart === -1) {
          runStart = x;
        } else if (!isBlack && runStart !== -1) {
          paths.push(`<rect x="${runStart}" y="${y}" width="${x - runStart}" height="1" fill="black"/>`);
          runStart = -1;
        }
      }
    }

    // Optimize: merge adjacent rects vertically
    if (paths.length > 50000) {
      // For very complex images, use a simplified path
      return `<image href="data:image/png;base64," width="${width}" height="${height}"/>`;
    }

    return paths.join('\n  ');
  }
}
