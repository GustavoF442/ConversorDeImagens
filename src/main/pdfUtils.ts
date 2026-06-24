import fs from 'fs';
import path from 'path';
import { PDFDocument } from 'pdf-lib';

export async function mergePdfs(files: string[], outputDir: string): Promise<{ path: string }> {
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const mergedPdf = await PDFDocument.create();

  for (const filePath of files) {
    const pdfBytes = fs.readFileSync(filePath);
    const pdf = await PDFDocument.load(pdfBytes);
    const copiedPages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
    for (const page of copiedPages) {
      mergedPdf.addPage(page);
    }
  }

  const outputPath = path.join(outputDir, `PDFs_Juntos_${Date.now()}.pdf`);
  const mergedBytes = await mergedPdf.save();
  fs.writeFileSync(outputPath, mergedBytes);

  return { path: outputPath };
}
