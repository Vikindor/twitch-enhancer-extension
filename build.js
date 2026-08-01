const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT_DIRECTORY = __dirname;
const SOURCES_DIRECTORY = path.join(ROOT_DIRECTORY, 'sources');
const SHARED_SOURCE_DIRECTORY = path.join(SOURCES_DIRECTORY, 'shared');
const BUILDS_DIRECTORY = path.join(ROOT_DIRECTORY, 'builds');
const PACKED_DIRECTORY = path.join(BUILDS_DIRECTORY, 'packed');
const SUPPORTED_BROWSERS = ['chrome', 'firefox'];

function ensureDirectory(directoryPath) {
  fs.mkdirSync(directoryPath, { recursive: true });
}

function removeDirectory(directoryPath) {
  fs.rmSync(directoryPath, { recursive: true, force: true });
}

function copyDirectory(sourceDirectory, targetDirectory) {
  ensureDirectory(targetDirectory);

  for (const entry of fs.readdirSync(sourceDirectory, {
    withFileTypes: true
  })) {
    const sourcePath = path.join(sourceDirectory, entry.name);
    const targetPath = path.join(targetDirectory, entry.name);

    if (entry.isDirectory()) {
      copyDirectory(sourcePath, targetPath);
    } else {
      fs.copyFileSync(sourcePath, targetPath);
    }
  }
}

function escapePowerShellSingleQuotedString(value) {
  return value.replace(/'/g, "''");
}

function createArchive(sourceDirectory, archivePath) {
  if (fs.existsSync(archivePath)) {
    fs.rmSync(archivePath, { force: true });
  }

  const script = [
    "Add-Type -AssemblyName 'System.IO.Compression'",
    "Add-Type -AssemblyName 'System.IO.Compression.FileSystem'",
    `$source = '${escapePowerShellSingleQuotedString(sourceDirectory)}'`,
    `$archive = '${escapePowerShellSingleQuotedString(archivePath)}'`,
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
  const browserSourceDirectory = path.join(SOURCES_DIRECTORY, browserName);
  const outputDirectory = path.join(BUILDS_DIRECTORY, browserName);
  const manifestPath = path.join(browserSourceDirectory, 'manifest.json');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const archivePath = path.join(
    PACKED_DIRECTORY,
    `twitch_enhancer_${browserName}_v${manifest.version}.zip`
  );

  removeDirectory(outputDirectory);
  ensureDirectory(outputDirectory);

  copyDirectory(SHARED_SOURCE_DIRECTORY, outputDirectory);
  copyDirectory(browserSourceDirectory, outputDirectory);
  console.log(`Built ${browserName} extension at ${outputDirectory}`);

  if (!options.debug) {
    createArchive(outputDirectory, archivePath);
    console.log(`Built ${browserName} archive at ${archivePath}`);
  }
}

function parseArgs(argv) {
  const options = {
    debug: false,
    browsers: [...SUPPORTED_BROWSERS]
  };

  const requestedBrowsers = [];
  for (const arg of argv) {
    if (arg === '--debug') {
      options.debug = true;
      continue;
    }

    if (SUPPORTED_BROWSERS.includes(arg)) {
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

  removeDirectory(BUILDS_DIRECTORY);
  ensureDirectory(BUILDS_DIRECTORY);
  if (!options.debug) {
    ensureDirectory(PACKED_DIRECTORY);
  }

  for (const browserName of options.browsers) {
    buildBrowser(browserName, options);
  }
}

main();
