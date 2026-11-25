/**
 * Mixes the second film's sound: Andrew's voice clips placed at their scene offsets, over the
 * original score, which dips under the voice exactly as the picture's timing says.
 * Writes public/music/film-mix.wav (48 kHz stereo); then joined to the picture with ffmpeg.
 *
 *   node scripts/mix-film.mjs
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const words = JSON.parse(readFileSync(join(root, "src", "film", "words.json"), "utf8"));
const timingSrc = readFileSync(join(root, "src", "film", "timing.ts"), "utf8");
const FPS = 60;
const SR = 48000;
const PAD = Object.fromEntries([...timingSrc.matchAll(/\n  (\w+): \[([\d.]+), ([\d.]+)\]/g)].map((m) => [m[1], [Number(m[2]), Number(m[3])]]));

// scene starts and voice offsets, in frames, as src/film/timing.ts computes them
const scenes = [];
let at = 0;
for (const id of Object.keys(words)) {
  const lead = Math.round(PAD[id][0] * FPS);
  const frames = lead + Math.round(words[id].seconds * FPS) + Math.round(PAD[id][1] * FPS);
  scenes.push({ id, file: words[id].file, start: at, lead, frames });
  at += frames;
}
const TOTAL_FRAMES = at;
const N = Math.ceil((TOTAL_FRAMES / FPS) * SR);

/** Reads a 16-bit PCM WAV into per-channel float arrays. */
function readWav(path) {
  const b = readFileSync(path);
  let p = 12;
  let fmt = null;
  let data = null;
  while (p < b.length) {
    const id = b.toString("ascii", p, p + 4);
    const size = b.readUInt32LE(p + 4);
    if (id === "fmt ") fmt = { channels: b.readUInt16LE(p + 10), rate: b.readUInt32LE(p + 12), bits: b.readUInt16LE(p + 22) };
    if (id === "data") data = b.subarray(p + 8, p + 8 + size);
    p += 8 + size + (size % 2);
  }
  if (!fmt || !data || fmt.bits !== 16) throw new Error(`unsupported wav ${path}`);
  const frames = data.length / 2 / fmt.channels;
  const ch = Array.from({ length: fmt.channels }, () => new Float32Array(frames));
  for (let i = 0; i < frames; i++) for (let c = 0; c < fmt.channels; c++) ch[c][i] = data.readInt16LE((i * fmt.channels + c) * 2) / 32768;
  return { rate: fmt.rate, ch };
}

/** Linear resample to the mix rate. */
function resample(x, from) {
  if (from === SR) return x;
  const out = new Float32Array(Math.floor((x.length * SR) / from));
  for (let i = 0; i < out.length; i++) {
    const t = (i * from) / SR;
    const k = Math.floor(t);
    const f = t - k;
    out[i] = (x[k] ?? 0) * (1 - f) + (x[k + 1] ?? 0) * f;
  }
  return out;
}

/** The same dip as the picture: full between lines, down 70 % under the voice, short fades. */
function musicVolume(frame) {
  let v = 1;
  for (const s of scenes) {
    const a = s.start + s.lead - 8;
    const b = s.start + s.frames - Math.round(0.25 * FPS);
    if (frame < a - 12 || frame > b + 18) continue;
    const edge = Math.min(1, (frame - (a - 12)) / 12, (b + 18 - frame) / 18);
    v = Math.min(v, 1 - 0.7 * Math.max(0, edge));
  }
  return v * 0.85;
}

const L = new Float32Array(N);
const R = new Float32Array(N);

// music
const music = readWav(join(root, "public", "music", "film-score.wav"));
const mL = resample(music.ch[0], music.rate);
const mR = resample(music.ch[1] ?? music.ch[0], music.rate);
for (let i = 0; i < N && i < mL.length; i++) {
  const g = musicVolume((i / SR) * FPS);
  L[i] += mL[i] * g;
  R[i] += mR[i] * g;
}

// voice, centred
for (const s of scenes) {
  const v = readWav(join(root, "public", "audio", s.file));
  const x = resample(v.ch[0], v.rate);
  const off = Math.round(((s.start + s.lead) / FPS) * SR);
  for (let i = 0; i < x.length && off + i < N; i++) {
    L[off + i] += x[i];
    R[off + i] += x[i];
  }
}

let peak = 0;
for (let i = 0; i < N; i++) peak = Math.max(peak, Math.abs(L[i]), Math.abs(R[i]));
const gain = peak > 0.98 ? 0.98 / peak : 1;
const data = Buffer.alloc(N * 4);
for (let i = 0; i < N; i++) {
  data.writeInt16LE(Math.round(Math.max(-1, Math.min(1, L[i] * gain)) * 32767), i * 4);
  data.writeInt16LE(Math.round(Math.max(-1, Math.min(1, R[i] * gain)) * 32767), i * 4 + 2);
}
const head = Buffer.alloc(44);
head.write("RIFF", 0);
head.writeUInt32LE(36 + data.length, 4);
head.write("WAVE", 8);
head.write("fmt ", 12);
head.writeUInt32LE(16, 16);
head.writeUInt16LE(1, 20);
head.writeUInt16LE(2, 22);
head.writeUInt32LE(SR, 24);
head.writeUInt32LE(SR * 4, 28);
head.writeUInt16LE(4, 32);
head.writeUInt16LE(16, 34);
head.write("data", 36);
head.writeUInt32LE(data.length, 40);
writeFileSync(join(root, "public", "music", "film-mix.wav"), Buffer.concat([head, data]));
console.log(`film-mix.wav: ${(N / SR).toFixed(2)} s (${TOTAL_FRAMES} frames), peak ${peak.toFixed(2)}${gain < 1 ? ", limited" : ""}`);
