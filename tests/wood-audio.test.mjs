import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

for (const name of ['wood-move.wav', 'wood-capture.wav']) {
  test(`${name} is a valid locally bundled PCM audio sample`, async () => {
    const wav = await readFile(resolve(root, 'public', 'audio', name));
    assert.equal(wav.subarray(0, 4).toString('ascii'), 'RIFF');
    assert.equal(wav.subarray(8, 12).toString('ascii'), 'WAVE');
    assert.equal(wav.readUInt16LE(22), 1, 'mono sample');
    assert.equal(wav.readUInt32LE(24), 44100, '44.1 kHz sample rate');
    assert.equal(wav.readUInt16LE(34), 16, '16-bit PCM');
    assert.ok(wav.length > 12000, 'sample contains audio data');
  });
}
