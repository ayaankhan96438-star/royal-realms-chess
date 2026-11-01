const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const outDir = path.join(root, 'public', 'engine');
fs.mkdirSync(outDir, { recursive: true });

function walk(dir, files = []) {
  if (!fs.existsSync(dir)) return files;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, files);
    else files.push(full);
  }
  return files;
}

let files = [];
try {
  const stockfish = require('stockfish');
  if (typeof stockfish.findEngine === 'function') {
    for (const flavor of ['lite-single', 'single']) {
      const found = stockfish.findEngine(flavor);
      if (found && fs.existsSync(found)) files.push(found);
    }
  }
} catch (error) {
  console.warn('Could not use Stockfish findEngine helper; searching its package files instead.');
}
files.push(...walk(path.join(root, 'node_modules', 'stockfish')));

const variants = [
  { label:'Lite single-threaded', base:'stockfish-19-lite-single' },
  { label:'Full single-threaded', base:'stockfish-19-single' }
];
let copied = 0;
for (const variant of variants) {
  const jsName = `${variant.base}.js`;
  const wasmName = `${variant.base}.wasm`;
  const jsFile = files.find(file => path.basename(file) === jsName);
  const wasmFile = files.find(file => path.basename(file) === wasmName);
  if (!jsFile || !wasmFile) {
    console.warn(`Stockfish ${variant.label} files were not found (${jsName}, ${wasmName}).`);
    continue;
  }
  fs.copyFileSync(jsFile, path.join(outDir, jsName));
  fs.copyFileSync(wasmFile, path.join(outDir, wasmName));
  console.log(`Copied Stockfish ${variant.label} engine into public/engine.`);
  copied++;
}

if (!copied) {
  console.warn('\nStockfish browser engine files were not found. Run `npm install` with internet access, then `npm run copy-engine`.');
  process.exitCode = 0;
}
