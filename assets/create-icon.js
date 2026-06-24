const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const sizes = [16, 32, 48, 64, 128, 256];
const outputDir = path.dirname(__filename);
const outputPath = path.join(outputDir, 'icon.ico');

const svgIcon = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" width="256" height="256">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#1a1a2e"/>
      <stop offset="100%" stop-color="#16213e"/>
    </linearGradient>
  </defs>
  <rect width="256" height="256" rx="48" fill="url(#bg)"/>
  <g transform="translate(28, 70)" fill="none" stroke="#ffffff" stroke-linecap="round" stroke-linejoin="round">
    <!-- Shoe outline -->
    <path d="M20 85 C20 85, 45 95, 80 95 C115 95, 150 90, 175 80 C190 75, 200 65, 200 50 C200 35, 185 25, 165 25 C145 25, 120 35, 95 45 C70 55, 40 55, 20 50 C10 48, 5 55, 5 65 C5 75, 10 82, 20 85 Z" stroke-width="10"/>
    <!-- Shoe sole -->
    <path d="M20 85 C45 92, 80 95, 120 95 C160 95, 190 88, 200 80" stroke-width="6"/>
    <!-- Laces / detail -->
    <path d="M90 48 C105 42, 125 35, 145 30" stroke-width="5"/>
    <path d="M95 60 C110 55, 130 50, 150 45" stroke-width="5"/>
  </g>
  <text x="128" y="210" text-anchor="middle" font-family="Arial, sans-serif" font-size="32" font-weight="bold" fill="#ffffff">FSG</text>
</svg>
`;

async function createIcon() {
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const pngBuffers = [];
  for (const size of sizes) {
    const buffer = await sharp(Buffer.from(svgIcon))
      .resize(size, size)
      .png()
      .toBuffer();
    pngBuffers.push({ size, buffer });
  }

  // ICO Header: Reserved (2), Type (2), Count (2)
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // Reserved
  header.writeUInt16LE(1, 2); // Type: 1 = ICO
  header.writeUInt16LE(pngBuffers.length, 4); // Count

  // Directory entries: 16 bytes each
  const entries = [];
  const dataOffsets = [];
  let offset = 6 + pngBuffers.length * 16;

  for (const { size, buffer } of pngBuffers) {
    const entry = Buffer.alloc(16);
    entry.writeUInt8(size === 256 ? 0 : size, 0); // Width
    entry.writeUInt8(size === 256 ? 0 : size, 1); // Height
    entry.writeUInt8(0, 2); // Color palette
    entry.writeUInt8(0, 3); // Reserved
    entry.writeUInt16LE(1, 4); // Color planes
    entry.writeUInt16LE(32, 6); // Bits per pixel
    entry.writeUInt32LE(buffer.length, 8); // Size in bytes
    entry.writeUInt32LE(offset, 12); // Offset
    entries.push(entry);
    dataOffsets.push(offset);
    offset += buffer.length;
  }

  const parts = [header, ...entries, ...pngBuffers.map(p => p.buffer)];
  const icoBuffer = Buffer.concat(parts);
  fs.writeFileSync(outputPath, icoBuffer);
  console.log(`Icon created: ${outputPath}`);
}

createIcon().catch(err => {
  console.error('Failed to create icon:', err);
  process.exit(1);
});
