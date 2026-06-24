const fs = require('fs');
const path = require('path');
const AdmZip = require('adm-zip');

const rootDir = path.resolve(__dirname, '..');
const releaseDir = path.join(rootDir, 'release');
const appName = 'Footwear Sketch Generator';
const version = getVersion();

function getVersion() {
  const pkg = JSON.parse(fs.readFileSync(path.join(rootDir, 'package.json'), 'utf8'));
  return pkg.version;
}

function findFolderVersion() {
  const entries = fs.readdirSync(releaseDir, { withFileTypes: true });
  const folder = entries.find(e => e.isDirectory() && e.name.startsWith(`${appName} v`));
  if (!folder) {
    throw new Error(`Folder version not found in ${releaseDir}. Run "npm run package:folder" first.`);
  }
  return path.join(releaseDir, folder.name);
}

function addFolderToZip(zip, sourceFolder, basePath) {
  const entries = fs.readdirSync(sourceFolder, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(sourceFolder, entry.name);
    const zipPath = path.join(basePath, entry.name).replace(/\\/g, '/');

    if (entry.isDirectory()) {
      addFolderToZip(zip, fullPath, zipPath);
    } else {
      zip.addLocalFile(fullPath, basePath, entry.name);
    }
  }
}

function main() {
  const sourceFolder = findFolderVersion();
  const zipName = `${appName} v${version}.zip`;
  const zipPath = path.join(releaseDir, zipName);

  if (fs.existsSync(zipPath)) {
    fs.rmSync(zipPath, { force: true });
  }

  console.log(`Creating ZIP: ${zipPath}`);
  const zip = new AdmZip();
  addFolderToZip(zip, sourceFolder, '');
  zip.writeZip(zipPath);

  const stats = fs.statSync(zipPath);
  console.log(`\nDone! ZIP created at:`);
  console.log(zipPath);
  console.log(`Size: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);
}

main();
