# Footwear Sketch Generator

Professional desktop application for converting footwear photos into technical drawings for catalogs, thermal printing (Argox), labels, and product development documentation.

## Features

### Image Processing
- **Line Art** — Clean black outlines on white background via Sobel edge detection
- **Line Art + Solid** — Lines with dark/textured areas filled as solid black
- **Technical Sheet** — Industrial-style drawing with border frame
- **Silhouette** — Pure black shape on white background

### Adjustable Parameters
- Line Thickness (1–10)
- Detection Sensitivity (1–100)
- Black Fill Intensity (1–100)
- Contrast (50–200)
- Sharpness (0–100)

### Batch Processing
- Import entire folders or multiple files
- Drag and drop support
- Process hundreds of images with parallel Canvas workers
- Progress tracking with ETA

### Export Formats
- **PNG** — Raster output with optional size compression
- **SVG** — Vector output via run-length bitmap tracing
- **PDF** — Embedded image in standard PDF document

### Argox Thermal Print Optimization
- Pure black (#000000) and white (#FFFFFF) only
- No grayscale, no anti-aliasing
- Optimized for 203 DPI and 300 DPI
- Configurable label dimensions (mm)
- Maximum contrast for thermal printing

### Dark Area Solidification
Automatically detects stippled/dotted/textured dark regions and converts them to solid black fills — critical for clean thermal label printing on Argox printers.

### Output Size Presets
- 50×50mm, 60×40mm, 80×50mm, 100×60mm
- Custom dimensions via Argox settings
- Proportional scaling with centering

### File Size Control
- Configurable max file size: 50KB, 100KB, 200KB, 500KB
- Automatic resolution reduction to meet targets
- PNG compression optimization

### AI Integration (Optional)
- Customizable prompt field for OpenAI / Claude / Gemini
- Default prompt optimized for footwear technical drawings

## Quick Start

### Browser Version (No Installation Required)
1. Open `footwear-sketch-generator.html` in any modern browser (Chrome, Edge, Firefox)
2. Click **Select Folder** or **Select Files** to import footwear images
3. Choose an output mode (Line Art, Line + Solid, Tech Sheet, Silhouette)
4. Adjust settings in the right panel
5. Click **Process Current** to preview, or **Process All** for batch processing
6. Export as PNG, SVG, or PDF

### Electron Desktop App (Requires Node.js)
```bash
npm install
npm run dev
```

### Build Windows Executable

#### Version as a folder (portable, no installation required)
```bash
npm run package:folder
```
This creates a complete folder inside `release/` that can be copied anywhere — including a USB drive — and opened by running `Footwear Sketch Generator.exe`. It does not require administrator privileges and does not modify the system.

#### Zip file for distribution
```bash
npm run package:zip
```
Generates the same folder version and compresses it into `release/Footwear Sketch Generator v1.0.0.zip`.

#### Windows installer (NSIS)
```bash
npm run package:win
```
Generates an NSIS installer. Note: this requires administrator privileges on the build machine because it downloads code-signing tools.

## Project Structure

```
D:\editor\
├── footwear-sketch-generator.html  — Standalone browser application (all-in-one)
├── package.json                     — Electron project configuration
├── tsconfig.json                    — TypeScript config (renderer)
├── tsconfig.main.json               — TypeScript config (main process)
├── vite.config.ts                   — Vite bundler config
├── README.md
│
├── src/
│   ├── main/                        — Electron main process
│   │   ├── main.ts                  — App window, IPC handlers
│   │   ├── preload.ts               — Context bridge API
│   │   ├── imageProcessor.ts        — Sharp-based image processing engine
│   │   ├── batchProcessor.ts        — Parallel batch processing with progress
│   │   └── exportManager.ts         — PNG/SVG/PDF export with tracing
│   │
│   └── renderer/                    — React UI
│       ├── index.html
│       ├── main.tsx
│       ├── App.tsx                  — Main application component
│       ├── types.ts                 — TypeScript interfaces
│       ├── styles.css               — Full application styles
│       └── components/
│           ├── TitleBar.tsx
│           ├── Sidebar.tsx
│           ├── Viewer.tsx
│           ├── RightPanel.tsx
│           ├── BatchPanel.tsx
│           └── StatusBar.tsx
```

## Processing Pipeline

1. **Load** — Read image file via FileReader API (browser) or Sharp (Electron)
2. **Grayscale** — Convert to luminance using ITU-R BT.601 coefficients
3. **Contrast** — Apply linear contrast adjustment
4. **Edge Detection** — Sobel operator with configurable kernel stride
5. **Thresholding** — Binary threshold based on sensitivity setting
6. **Line Dilation** — Morphological dilation for line thickness control
7. **Dark Fill** — Block-based dark area detection and solid fill (Line+Solid mode)
8. **Argox Optimization** — Hard threshold, DPI scaling, size constraints
9. **Output Resize** — Proportional fit to target dimensions in mm
10. **Compression** — Progressive quality reduction to meet file size target

## Technology

| Component | Browser Version | Electron Version |
|-----------|----------------|-----------------|
| Image Processing | Canvas 2D API | Sharp (libvips) |
| Edge Detection | Sobel (JavaScript) | Sobel + Sharp filters |
| Vectorization | Run-length SVG tracing | Potrace |
| PDF Export | Manual PDF builder | PDFKit |
| UI Framework | Vanilla HTML/CSS/JS | React + TypeScript |
| Batch Processing | Promise.all batches | Worker threads |

## System Requirements

- **Browser version**: Any modern browser (Chrome 90+, Edge 90+, Firefox 88+)
- **Electron version**: Node.js 18+, Windows 10/11
- **RAM**: 4GB minimum, 8GB recommended for batch processing
- **CPU**: Multi-core recommended for batch operations

## License

Proprietary — All rights reserved.
