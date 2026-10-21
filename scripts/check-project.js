'use strict';

const { readdirSync } = require('node:fs');
const { join, relative } = require('node:path');
const { spawnSync } = require('node:child_process');

const root = join(__dirname, '..');
const ignoredDirectories = new Set(['.git', '.vercel', 'node_modules']);
const sourceFiles = [];

function collect(directory) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const fullPath = join(directory, entry.name);
    if (entry.isDirectory()) {
      if (!ignoredDirectories.has(entry.name)) collect(fullPath);
    } else if (entry.isFile() && entry.name.endsWith('.js')) {
      sourceFiles.push(fullPath);
    }
  }
}

collect(root);
let failed = false;
for (const file of sourceFiles) {
  const result = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' });
  if (result.status !== 0) {
    failed = true;
    process.stderr.write(`${relative(root, file)}\n${result.stderr}`);
  }
}

for (const file of ['package.json', 'vercel.json']) {
  try {
    JSON.parse(require('node:fs').readFileSync(join(root, file), 'utf8'));
  } catch (error) {
    failed = true;
    process.stderr.write(`${file}: ${error.message}\n`);
  }
}

if (failed) process.exitCode = 1;
else process.stdout.write(`Validación correcta: ${sourceFiles.length} archivos JavaScript y configuración JSON.\n`);

