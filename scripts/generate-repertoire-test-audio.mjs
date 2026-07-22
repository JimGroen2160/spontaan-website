import {mkdir, writeFile} from 'node:fs/promises';
import {dirname, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

export function createTestWave({frequency, durationSeconds = 4, sampleRate = 22050}) {
  const sampleCount = Math.floor(sampleRate * durationSeconds);
  const bytesPerSample = 2;
  const dataSize = sampleCount * bytesPerSample;
  const buffer = Buffer.alloc(44 + dataSize);
  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write('WAVE', 8);
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(1, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * bytesPerSample, 28);
  buffer.writeUInt16LE(bytesPerSample, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write('data', 36);
  buffer.writeUInt32LE(dataSize, 40);

  for (let index = 0; index < sampleCount; index += 1) {
    const time = index / sampleRate;
    const fade = Math.min(1, index / (sampleRate * 0.12), (sampleCount - index) / (sampleRate * 0.2));
    const fundamental = Math.sin(2 * Math.PI * frequency * time);
    const overtone = Math.sin(2 * Math.PI * frequency * 1.5 * time) * 0.18;
    buffer.writeInt16LE(Math.round((fundamental + overtone) * fade * 0.16 * 32767), 44 + index * bytesPerSample);
  }
  return buffer;
}

export async function generateRepertoireTestAudio() {
  const output = resolve(ROOT, 'data');
  await mkdir(output, {recursive: true});
  await Promise.all([
    writeFile(resolve(output, 'test--repertoire-warm.wav'), createTestWave({frequency: 196})),
    writeFile(resolve(output, 'test--repertoire-helder.wav'), createTestWave({frequency: 261.63})),
  ]);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  generateRepertoireTestAudio().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
