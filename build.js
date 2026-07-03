const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const rootDir = __dirname;
const sourcesDir = path.join(rootDir, 'sources');
const sharedDir = path.join(sourcesDir, 'shared');
const buildsDir = path.join(rootDir, 'builds');
const packedDir = path.join(buildsDir, 'packed');
const supportedBrowsers = ['chrome', 'firefox'];

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
    "Add-Type -AssemblyName 'System.IO.Compression'",
    "Add-Type -AssemblyName 'System.IO.Compression.FileSystem'",
    `$source = '${sourceDir.replace(/'/g, "''")}'`,
    `$archive = '${archivePath.replace(/'/g, "''")}'`,
    "$sourcePath = (Resolve-Path $source).Path",
    "if (-not $sourcePath.EndsWith([System.IO.Path]::DirectorySeparatorChar)) { $sourcePath += [System.IO.Path]::DirectorySeparatorChar }",
    "$files = Get-ChildItem -Path $sourcePath -Recurse -File",
    "$stream = [System.IO.File]::Open($archive, [System.IO.FileMode]::Create)",
    "try {",
    "  $zip = New-Object System.IO.Compression.ZipArchive($stream, [System.IO.Compression.ZipArchiveMode]::Create, $false)",
    "  try {",
    "    foreach ($file in $files) {",
    "      $relativePath = $file.FullName.Substring($sourcePath.Length).Replace('\\', '/')",
    "      $entry = $zip.CreateEntry($relativePath, [System.IO.Compression.CompressionLevel]::Optimal)",
    "      $entryStream = $entry.Open()",
    "      try {",
    "        $fileStream = [System.IO.File]::OpenRead($file.FullName)",
    "        try {",
    "          $fileStream.CopyTo($entryStream)",
    "        } finally {",
    "          if ($fileStream) { $fileStream.Dispose() }",
    "        }",
    "      } finally {",
    "        if ($entryStream) { $entryStream.Dispose() }",
    "      }",
    "    }",
    "  } finally {",
    "    if ($zip) { $zip.Dispose() }",
    "  }",
    "} finally {",
    "  if ($stream) { $stream.Dispose() }",
    "}"
  ].join('; ');

  const result = spawnSync('powershell', ['-NoProfile', '-Command', script], {
    stdio: 'inherit'
  });

  if (result.status !== 0) {
    process.exit(result.status || 1);
  }
}

function buildBrowser(browserName, options) {
  const browserSourceDir = path.join(sourcesDir, browserName);
  const outputDir = path.join(buildsDir, browserName);
  const manifest = JSON.parse(fs.readFileSync(path.join(browserSourceDir, 'manifest.json'), 'utf8'));
  const archivePath = path.join(packedDir, `twitch_enhancer_${browserName}_v${manifest.version}.zip`);

  removeDir(outputDir);
  ensureDir(outputDir);

  copyDir(sharedDir, outputDir);
  copyDir(browserSourceDir, outputDir);
  console.log(`Built ${browserName} extension at ${outputDir}`);

  if (!options.debug) {
    zipDir(outputDir, archivePath);
    console.log(`Built ${browserName} archive at ${archivePath}`);
  }
}

function parseArgs(argv) {
  const options = {
    debug: false,
    browsers: supportedBrowsers.slice()
  };

  const requestedBrowsers = [];
  for (const arg of argv) {
    if (arg === '--debug') {
      options.debug = true;
      continue;
    }

    if (supportedBrowsers.includes(arg)) {
      requestedBrowsers.push(arg);
      continue;
    }

    console.error(`Unsupported argument: ${arg}`);
    process.exit(1);
  }

  if (requestedBrowsers.length > 0) {
    options.browsers = requestedBrowsers;
  }

  return options;
}

function main() {
  const options = parseArgs(process.argv.slice(2));

  removeDir(buildsDir);
  ensureDir(buildsDir);
  if (!options.debug) {
    ensureDir(packedDir);
  }

  for (const browserName of options.browsers) {
    buildBrowser(browserName, options);
  }
}

main();
