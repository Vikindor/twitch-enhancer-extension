const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const rootDir = __dirname;
const sourcesDir = path.join(rootDir, 'sources');
const sharedDir = path.join(sourcesDir, 'shared');
const buildsDir = path.join(rootDir, 'builds');
const packedDir = path.join(buildsDir, 'packed');

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function removeDir(dirPath) {
  fs.rmSync(dirPath, { recursive: true, force: true });
}

function copyDir(sourceDir, targetDir) {
  ensureDir(targetDir);

  for (const entry of fs.readdirSync(sourceDir, { withFileTypes: true })) {
    const sourcePath = path.join(sourceDir, entry.name);
    const targetPath = path.join(targetDir, entry.name);

    if (entry.isDirectory()) {
      copyDir(sourcePath, targetPath);
    } else {
      fs.copyFileSync(sourcePath, targetPath);
    }
  }
}

function zipDir(sourceDir, archivePath) {
  if (fs.existsSync(archivePath)) {
    fs.rmSync(archivePath, { force: true });
  }

  const script = [
    "Add-Type -AssemblyName 'System.IO.Compression.FileSystem'",
    `$source = '${sourceDir.replace(/'/g, "''")}'`,
    `$archive = '${archivePath.replace(/'/g, "''")}'`,
    '[System.IO.Compression.ZipFile]::CreateFromDirectory($source, $archive)'
  ].join('; ');

  const result = spawnSync('powershell', ['-NoProfile', '-Command', script], {
    stdio: 'inherit'
  });

  if (result.status !== 0) {
    process.exit(result.status || 1);
  }
}

function buildBrowser(browserName) {
  const browserSourceDir = path.join(sourcesDir, browserName);
  const outputDir = path.join(buildsDir, browserName);
  const manifest = JSON.parse(fs.readFileSync(path.join(browserSourceDir, 'manifest.json'), 'utf8'));
  const archivePath = path.join(packedDir, `twitch-enhancer-${browserName}-${manifest.version}.zip`);

  removeDir(outputDir);
  ensureDir(outputDir);

  copyDir(sharedDir, outputDir);
  copyDir(browserSourceDir, outputDir);
  zipDir(outputDir, archivePath);

  console.log(`Built ${browserName} extension at ${outputDir}`);
  console.log(`Built ${browserName} archive at ${archivePath}`);
}

function main() {
  removeDir(buildsDir);
  ensureDir(buildsDir);
  ensureDir(packedDir);

  buildBrowser('chrome');
  buildBrowser('firefox');
}

main();
