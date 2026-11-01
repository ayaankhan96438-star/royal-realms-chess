import { spawn } from 'node:child_process';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const node = process.execPath;
const children = [
  spawn(node, [resolve(root, 'server/server.js')], { cwd:root, stdio:'inherit', env:process.env }),
  spawn(node, [resolve(root, 'node_modules/vite/bin/vite.js'), '--host', '0.0.0.0'], { cwd:root, stdio:'inherit', env:process.env })
];
let stopping = false;
function stop(signal = 'SIGINT') {
  if (stopping) return;
  stopping = true;
  for (const child of children) if (!child.killed) child.kill(signal);
}
process.on('SIGINT', () => stop('SIGINT'));
process.on('SIGTERM', () => stop('SIGTERM'));
for (const child of children) child.on('exit', code => { if (!stopping && code !== 0) { console.error(`A Royal Realms process exited with code ${code}.`); stop('SIGTERM'); process.exitCode = code || 1; } });
