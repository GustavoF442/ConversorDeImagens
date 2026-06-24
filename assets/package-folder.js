const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const releaseDir = path.join(rootDir, 'release');
const appName = 'Footwear Sketch Generator';
const folderName = `${appName} v${getVersion()}`;
const targetDir = path.join(releaseDir, folderName);

function getVersion() {
  const pkg = JSON.parse(fs.readFileSync(path.join(rootDir, 'package.json'), 'utf8'));
  return pkg.version;
}

function cleanTargetDir() {
  if (!fs.existsSync(targetDir)) return;

  try {
    fs.rmSync(targetDir, { recursive: true, force: true });
  } catch (err) {
    // Folder may be locked by a running process. Rename it instead.
    const backupDir = `${targetDir}.old-${Date.now()}`;
    try {
      fs.renameSync(targetDir, backupDir);
      console.log(`Previous folder locked. Renamed to: ${backupDir}`);
    } catch (renameErr) {
      console.log(`Warning: could not replace previous folder. It may be in use.`);
    }
  }
}

function copyFolder(src, dest) {
  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true });
  }

  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      copyFolder(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

function copyRuntimeDlls() {
  const dlls = ['msvcp140.dll', 'vcruntime140.dll', 'vcruntime140_1.dll'];
  const systemDirs = [
    path.join(process.env.SystemRoot || 'C:\\Windows', 'System32'),
    path.join(process.env.SystemRoot || 'C:\\Windows', 'SysWOW64'),
  ];

  for (const dll of dlls) {
    for (const dir of systemDirs) {
      const sourcePath = path.join(dir, dll);
      if (fs.existsSync(sourcePath)) {
        const destPath = path.join(targetDir, dll);
        fs.copyFileSync(sourcePath, destPath);
        console.log(`Copied runtime DLL: ${dll}`);
        break;
      }
    }
  }
}

function copySharpNativeLibs() {
  const sharpLibSource = path.join(rootDir, 'node_modules', '@img', 'sharp-win32-x64', 'lib');
  const sharpLibDest = path.join(
    targetDir,
    'resources',
    'app.asar.unpacked',
    'node_modules',
    '@img',
    'sharp-win32-x64',
    'lib'
  );

  if (!fs.existsSync(sharpLibSource)) {
    console.log('Warning: sharp native libs source not found');
    return;
  }

  if (!fs.existsSync(sharpLibDest)) {
    fs.mkdirSync(sharpLibDest, { recursive: true });
  }

  const files = fs.readdirSync(sharpLibSource);
  for (const file of files) {
    const sourcePath = path.join(sharpLibSource, file);
    const destPath = path.join(sharpLibDest, file);
    if (fs.statSync(sourcePath).isFile()) {
      fs.copyFileSync(sourcePath, destPath);
      console.log(`Copied sharp native lib: ${file}`);
    }
  }
}

function createReadme() {
  const readmePath = path.join(targetDir, 'LEIA-ME.txt');
  const content = `${appName} v${getVersion()}
================================

Este programa nao precisa ser instalado.

Para usar:
1. Mantenha todos os arquivos desta pasta juntos.
2. Execute o arquivo "${appName}.exe".
3. Pronto.

A pasta pode ser copiada para qualquer lugar do computador
ou para um pendrive.

`;
  fs.writeFileSync(readmePath, content, 'utf8');
}

async function buildUnpacked() {
  const { packager } = require('@electron/packager');
  const appPaths = await packager({
    dir: rootDir,
    out: releaseDir,
    overwrite: true,
    platform: 'win32',
    arch: 'x64',
    icon: path.join(rootDir, 'assets', 'icon.ico'),
    name: appName,
    appVersion: getVersion(),
    prune: true,
    ignore: [
      /^\/(release|src|assets(?!\/icon\.ico)|\.claude|footwear-sketch-generator\.html)/,
      /^\/.git/,
      /^\/node_modules\/(\.bin|\.cache)/,
      /^\/assets\/.+\.js$/,
    ],
    asar: true,
    win32metadata: {
      ProductName: appName,
      InternalName: appName,
      FileDescription: appName,
      OriginalFilename: `${appName}.exe`,
    },
  });

  return appPaths[0];
}

async function main() {
  const sourceDir = await buildUnpacked();
  console.log(`Built at: ${sourceDir}`);

  console.log(`Creating folder version: ${targetDir}`);
  cleanTargetDir();
  copyFolder(sourceDir, targetDir);
  copyRuntimeDlls();
  copySharpNativeLibs();
  createReadme();

  console.log(`\nDone! Folder version created at:`);
  console.log(targetDir);
  console.log(`\nExecutable: ${path.join(targetDir, `${appName}.exe`)}`);

  // Clean up temporary build directories
  const tempDirs = [
    path.join(releaseDir, `${appName}-win32-x64`),
    path.join(releaseDir, 'win-unpacked'),
  ];
  for (const tempDir of tempDirs) {
    if (fs.existsSync(tempDir)) {
      try {
        fs.rmSync(tempDir, { recursive: true, force: true });
        console.log(`Cleaned up: ${tempDir}`);
      } catch (err) {
        console.log(`Could not clean up (in use or locked): ${tempDir}`);
      }
    }
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
