#!/usr/bin/env node
// Bundles the React UI app into a single self-contained plugin/ui.html
// Usage: node scripts/build-ui.mjs

import { execSync } from 'child_process';
import { readFileSync, writeFileSync, mkdtempSync } from 'fs';
import { resolve, dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { tmpdir } from 'os';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const tmp = mkdtempSync(join(tmpdir(), 'dominic-build-'));

const cssOut = join(tmp, 'styles.css');
const jsOut = join(tmp, 'app.js');

// 1. Process Tailwind CSS
console.log('[build-ui] Processing Tailwind CSS...');
execSync(
  `npx tailwindcss -i app/globals.css -o "${cssOut}" --minify`,
  { cwd: root, stdio: 'inherit' }
);
const css = readFileSync(cssOut, 'utf8');

// 2. Bundle React app with esbuild
console.log('[build-ui] Bundling React app...');
execSync(
  [
    'npx esbuild app/entry.tsx',
    '--bundle',
    `--outfile="${jsOut}"`,
    '--format=iife',
    '--target=es2020',
    '--jsx=automatic',
    '--loader:.tsx=tsx',
    '--loader:.ts=ts',
    '--define:process.env.NODE_ENV=\\"production\\"',
    '--minify',
  ].join(' '),
  { cwd: root, stdio: 'inherit' }
);
const js = readFileSync(jsOut, 'utf8');

// 3. Produce the single-file HTML
console.log('[build-ui] Assembling plugin/ui.html...');

const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<style>${css}</style>
</head>
<body class="w-screen h-screen overflow-hidden">
<div id="root" class="w-full h-full"></div>
<script>${js}</script>
</body>
</html>`;

writeFileSync(resolve(root, 'plugin/ui.html'), html);

console.log(
  `[build-ui] Done! plugin/ui.html (${(Buffer.byteLength(html) / 1024).toFixed(1)} KB)`
);
