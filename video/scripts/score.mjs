/**
 * The film's original score, composed in code and synced to the scene lengths in
 * src/timing.json. Writes public/music/score.wav (44.1 kHz, 16-bit stereo).
 *
 *   node scripts/score.mjs
 *
 * Act one (the problem) is dark: a drone, a heartbeat that quickens, ticking, a riser
 * into a deep impact on Q-Day. Act two (the solution) turns to a major key with a steady
 * pulse and arpeggios that build through the attacks, then resolves on the close.
 * Every sound is synthesised here, so the film carries no third-party music.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const timing = JSON.parse(readFileSync(join(root, "src", "timing.json"), "utf8"));

const SR = 44100;
const FPS = 30;
// scene starts in seconds, matching src/timing.ts (frames rounded the same way)
const scene = {};
let at = 0;
for (const s of timing.scenes) {
  const lead = s.audio ? Math.round((s.lead ?? 0) * FPS) : 0;
  const hold = s.audio ? Math.round((s.hold ?? 0) * FPS) : 0;
  const frames = lead + Math.round(s.seconds * FPS) + hold + (s.audio ? Math.round(timing.tailSeconds * FPS) : 0);
  scene[s.id] = { start: at / FPS, dur: frames / FPS };
  at += frames;
}
const TOTAL = at / FPS;
const N = Math.ceil(TOTAL * SR);
/** Absolute time of a beat inside a scene, given as a fraction of that scene (as the scenes do). */
const cue = (id, frac, plusFrames = 0) => scene[id].start + Math.round(scene[id].dur * FPS * frac + plusFrames) / FPS;

// ---------------------------------------------------------------- buses

const dryL = new Float32Array(N);
const dryR = new Float32Array(N);
const send = new Float32Array(N); // to the reverb
const padBus = new Float32Array(N); // low-passed later

let seed = 7;
const rnd = () => {
  seed = (seed * 1664525 + 1013904223) >>> 0;
  return seed / 4294967296;
};
const noise = () => rnd() * 2 - 1;
const hz = (midi) => 440 * Math.pow(2, (midi - 69) / 12);
const TAU = Math.PI * 2;

function put(i, v, pan = 0, rev = 0.2) {
  if (i < 0 || i >= N) return;
  dryL[i] += v * (1 - Math.max(0, pan));
  dryR[i] += v * (1 + Math.min(0, pan));
  send[i] += v * rev;
}

// ---------------------------------------------------------------- instruments

/** A soft detuned saw pad (band-limited by summing a few harmonics), into the pad bus. */
function pad(t0, dur, notes, amp, attack = 1.2, release = 1.5) {
  const s0 = Math.floor(t0 * SR);
  const len = Math.floor((dur + release) * SR);
  for (const note of notes) {
    for (const det of [-0.08, 0.08]) {
      const f = hz(note + det);
      let ph = rnd() * TAU;
      const inc = (TAU * f) / SR;
      for (let k = 0; k < len; k++) {
        const t = k / SR;
        const env = Math.min(1, t / attack) * (t > dur ? Math.max(0, 1 - (t - dur) / release) : 1);
        let v = 0;
        for (let h = 1; h <= 6; h++) v += Math.sin(ph * h) / h;
        ph += inc;
        const i = s0 + k;
        if (i < N) padBus[i] += v * env * amp;
      }
    }
  }
}

function sine(t0, dur, f0, f1, amp, decay, pan = 0, rev = 0.25) {
  const s0 = Math.floor(t0 * SR);
  const len = Math.floor(dur * SR);
  let ph = 0;
  for (let k = 0; k < len; k++) {
    const t = k / SR;
    const f = f1 === f0 ? f0 : f0 * Math.pow(f1 / f0, Math.min(1, t / Math.max(0.001, decay * 0.5)));
    ph += (TAU * f) / SR;
    const env = Math.exp(-t / decay) * Math.min(1, t / 0.003);
    put(s0 + k, Math.sin(ph) * env * amp, pan, rev);
  }
}

const kick = (t, amp = 0.9) => sine(t, 0.5, 140, 42, amp, 0.16, 0, 0.05);
const heart = (t, amp = 0.7) => {
  kick(t, amp);
  kick(t + 0.22, amp * 0.6);
};

function noiseHit(t0, dur, amp, decay, lpStart, lpEnd, pan = 0, rev = 0.3, hp = false) {
  const s0 = Math.floor(t0 * SR);
  const len = Math.floor(dur * SR);
  let lp = 0;
  let prev = 0;
  for (let k = 0; k < len; k++) {
    const t = k / SR;
    const cut = lpStart + (lpEnd - lpStart) * (t / dur);
    const a = 1 - Math.exp((-TAU * cut) / SR);
    const n = noise();
    lp += a * (n - lp);
    const v = hp ? n - prev : lp;
    prev = n;
    put(s0 + k, v * Math.exp(-t / decay) * amp, pan, rev);
  }
}

const tick = (t, amp = 0.12, pan = 0) => noiseHit(t, 0.04, amp, 0.012, 9000, 9000, pan, 0.05, true);
const hat = (t, amp = 0.08, pan = 0.2) => noiseHit(t, 0.08, amp, 0.025, 12000, 12000, pan, 0.08, true);

/** A deep cinematic impact: sub drop, a noise body and a long tail through the reverb. */
function impact(t, amp = 1) {
  sine(t, 3, 70, 28, amp * 1.1, 1.1, 0, 0.35);
  sine(t, 0.6, 180, 60, amp * 0.5, 0.12, 0, 0.2);
  noiseHit(t, 1.6, amp * 0.55, 0.35, 2500, 300, 0, 0.9);
}

/** Rising noise and a climbing tone, cut off hard at t1 (where the impact lands). */
function riser(t0, t1, amp = 0.35) {
  const s0 = Math.floor(t0 * SR);
  const len = Math.floor((t1 - t0) * SR);
  let lp = 0;
  let ph = 0;
  for (let k = 0; k < len; k++) {
    const p = k / len;
    const cut = 200 + 9000 * p * p;
    lp += (1 - Math.exp((-TAU * cut) / SR)) * (noise() - lp);
    ph += (TAU * (180 + 900 * p * p)) / SR;
    const env = p * p * amp;
    put(s0 + k, (lp * 0.8 + Math.sin(ph) * 0.25) * env, Math.sin(p * 20) * 0.3, 0.4);
  }
}

/** A bell: inharmonic partials, long decay. */
function bell(t, midi, amp = 0.25, pan = 0) {
  const f = hz(midi);
  sine(t, 3, f, f, amp, 1.2, pan, 0.6);
  sine(t, 2, f * 2.76, f * 2.76, amp * 0.35, 0.5, pan, 0.6);
  sine(t, 1.2, f * 5.4, f * 5.4, amp * 0.15, 0.25, pan, 0.6);
}

/** A plucked arpeggio note. */
const pluck = (t, midi, amp = 0.12, pan = 0) => {
  sine(t, 0.6, hz(midi), hz(midi), amp, 0.18, pan, 0.45);
  sine(t, 0.3, hz(midi) * 2, hz(midi) * 2, amp * 0.3, 0.08, pan, 0.45);
};

/** A digital glitch: crushed square bursts. */
function glitch(t, amp = 0.25) {
  const s0 = Math.floor(t * SR);
  const len = Math.floor(0.22 * SR);
  for (let k = 0; k < len; k++) {
    const seg = Math.floor(k / 900);
    const f = 200 + ((seg * 7919) % 1400);
    const v = Math.sign(Math.sin((TAU * f * k) / SR)) * (seg % 3 === 1 ? 0 : 1);
    put(s0 + k, v * amp * (1 - k / len), seg % 2 ? 0.6 : -0.6, 0.1);
  }
}

const whoosh = (t, amp = 0.25) => noiseHit(t, 0.7, amp, 0.25, 600, 6000, 0, 0.5);

// ---------------------------------------------------------------- act one: the problem (A minor)

const darkEnd = scene.title.start;
// sub drone through act one
{
  const s0 = 0;
  const len = Math.floor((darkEnd + 1.5) * SR);
  for (let k = 0; k < len; k++) {
    const t = k / SR;
    const fadeIn = Math.min(1, t / 3);
    const fadeOut = t > darkEnd - 0.5 ? Math.max(0, 1 - (t - darkEnd + 0.5) / 2) : 1;
    const lfo = 0.75 + 0.25 * Math.sin(TAU * 0.08 * t);
    const v = (Math.sin(TAU * hz(33) * t) * 0.5 + Math.sin(TAU * hz(40) * t) * 0.2) * lfo * fadeIn * fadeOut * 0.28;
    put(s0 + k, v, 0, 0.1);
  }
}
const darkChords = [
  [45, 48, 52, 57],
  [41, 45, 48, 55],
  [38, 45, 50, 53],
  [40, 44, 47, 52],
];
for (let t = 0, i = 0; t < darkEnd - 1; t += 4.5, i++) pad(t, 4.6, darkChords[i % 4], 0.018, 1.5, 2);

// heartbeat: slow through the wallet and leak, quicker through the quantum scene
for (let t = scene.leak.start; t < scene.quantum.start; t += 60 / 62) heart(t, 0.55);
for (let t = scene.quantum.start; t < cue("qday", 0.3) - 2.2; t += 60 / 86) heart(t, 0.7);
// ticking while the quantum computer works
for (let t = cue("quantum", 0.22); t < cue("qday", 0.3) - 2.2; t += 60 / 86 / 4) tick(t, 0.07, rnd() - 0.5);

// wallet: a soft accent on "whoever holds the key"
impact(cue("wallet", 0.48), 0.35);
bell(cue("wallet", 0.48), 69, 0.12);
// leak: each panel turning red
for (let i = 0; i < 3; i++) glitch(cue("leak", 0.14 + i * 0.14, 26), 0.12);
riser(cue("leak", 0.62) - 1.6, cue("leak", 0.62), 0.25);
impact(cue("leak", 0.62), 0.6);
// drain: the balance falling, then the hit
sine(cue("drain", 0.4), cue("drain", 0.6) - cue("drain", 0.4), 880, 110, 0.08, 1.5, 0, 0.3);
glitch(cue("drain", 0.6, -4), 0.3);
impact(cue("drain", 0.6), 0.9);
// quantum: the private key comes out
impact(cue("quantum", 0.5), 0.55);
glitch(cue("quantum", 0.5), 0.15);
// Q-Day: riser, a breath of silence, the biggest hit
riser(cue("qday", 0.3) - 3.2, cue("qday", 0.3) - 0.15, 0.45);
impact(cue("qday", 0.3), 1.25);
glitch(cue("qday", 0.3), 0.3);
pad(cue("qday", 0.3), scene.qday.dur * 0.6, [33, 40, 45, 48], 0.02, 0.2, 2.5);

// ---------------------------------------------------------------- the turn: the title (C major)

const lead = scene.title.start;
const logo = lead + 66 / FPS;
pad(lead, scene.title.dur + 0.5, [48, 55, 60, 64], 0.02, 2.0, 2.5);
riser(logo - 1.4, logo, 0.18);
bell(logo, 72, 0.22, -0.2);
bell(logo + 0.25, 79, 0.16, 0.2);
bell(logo + 0.5, 84, 0.12, 0);
sine(logo, 3, hz(36), hz(36), 0.35, 1.5, 0, 0.3);

// ---------------------------------------------------------------- act two: the solution

const bpm = 100;
const beat = 60 / bpm;
const solStart = scene.dare.start;
const solEnd = scene.close.start;
const prog = [
  [48, 55, 60, 64, 67], // C
  [43, 50, 55, 59, 62], // G
  [45, 52, 57, 60, 64], // Am
  [41, 48, 53, 57, 60], // F
];
const intensity = (t) => {
  if (t < scene.locks.start) return 0.55;
  if (t < scene.attacks.start) return 0.7;
  if (t < scene.control.start) return 0.9 + 0.1 * ((t - scene.attacks.start) / scene.attacks.dur);
  if (t < scene.product.start) return 0.85;
  if (t < scene.drill.start) return 1;
  return 0.5;
};
let bar = 0;
for (let t = solStart; t < solEnd; t += beat * 4, bar++) {
  const ch = prog[bar % 4];
  pad(t, beat * 4, ch.slice(0, 4), 0.016, 0.4, 1.0);
  for (let b = 0; b < 4; b++) {
    const bt = t + b * beat;
    if (bt >= solEnd) break;
    const I = intensity(bt);
    const drill = bt >= scene.drill.start;
    if (!drill && (b === 0 || b === 2)) kick(bt, 0.55 * I);
    if (drill && b === 0) kick(bt, 0.45);
    if (!drill && bt > scene.locks.start) hat(bt + beat / 2, 0.06 * I, 0.25);
    // arpeggio in eighths, sixteenths through the attacks
    const sub = bt >= scene.attacks.start && bt < scene.control.start ? 4 : 2;
    for (let s = 0; s < sub; s++) {
      if (drill && s > 0) continue;
      const note = ch[(b * sub + s) % ch.length] + 24;
      pluck(bt + (s * beat) / sub, note, 0.07 * I, ((b * sub + s) % 3) * 0.3 - 0.3);
    }
  }
}
// bass line under act two
for (let t = solStart, i = 0; t < solEnd; t += beat * 4, i++) sine(t, beat * 4, hz(prog[i % 4][0] - 12), hz(prog[i % 4][0] - 12), 0.22, 1.6, 0, 0.05);

// accents
impact(cue("dare", 0.42), 0.5); // PUBLISHED ON PURPOSE stamp
bell(cue("locks", 0.3, 24), 76, 0.18); // both signatures: pays
bell(cue("locks", 0.3, 24) + 0.15, 83, 0.12);
impact(cue("locks", 0.62, 24), 0.45); // one key alone: refused
glitch(cue("locks", 0.62, 24), 0.12);
{
  const a = scene.attacks;
  const start = a.dur * 0.12;
  const every = (a.dur * 0.74 - start) / 17;
  for (let i = 0; i < 17; i++) {
    const t = a.start + Math.round((start + i * every + 7 / FPS) * FPS) / FPS;
    tick(t, 0.16, 0.4);
    sine(t, 0.25, hz(88), hz(88), 0.05, 0.06, 0.4, 0.3);
  }
}
impact(cue("attacks", 0.8), 0.6); // the control: robbed
glitch(cue("attacks", 0.8), 0.15);
impact(cue("control", 0.34), 0.8); // the one-lock vault bursts
for (let i = 0; i < 14; i++) sine(cue("control", 0.34) + i * 0.035, 0.4, hz(96 - (i % 5)), hz(96 - (i % 5)), 0.05, 0.12, (i % 3) - 1, 0.5); // coins
bell(cue("control", 0.34) + 0.4, 79, 0.15); // the vault holds
{
  const per = (scene.product.dur * 0.76) / 4;
  for (let i = 0; i < 4; i++) whoosh(scene.product.start + i * per, 0.22);
  riser(cue("product", 0.76) - 1.2, cue("product", 0.76), 0.15);
  bell(cue("product", 0.76), 79, 0.14);
}
// drill: tension, then the proof lands
for (let t = scene.drill.start; t < cue("drill", 0.58); t += 0.5) tick(t, 0.06);
riser(cue("drill", 0.58) - 1.5, cue("drill", 0.58), 0.2);
bell(cue("drill", 0.58), 72, 0.2);
bell(cue("drill", 0.58) + 0.2, 76, 0.16);
bell(cue("drill", 0.58) + 0.4, 79, 0.14);

// ---------------------------------------------------------------- transitions: a soft air whoosh into every cut

for (const [id, sc] of Object.entries(scene)) {
  if (sc.start < 0.5 || id === "title") continue;
  noiseHit(sc.start - 0.35, 0.8, 0.13, 0.3, 400, 5200, id.length % 2 ? 0.3 : -0.3, 0.55);
  sine(sc.start, 0.5, 90, 45, 0.18, 0.18, 0, 0.1);
}

// ---------------------------------------------------------------- the close

{
  const c = scene.close;
  pad(c.start, c.dur - 1.5, [36, 48, 55, 60, 64, 67, 72], 0.016, 1.5, 3.5);
  sine(c.start, c.dur, hz(36), hz(36), 0.3, 3.5, 0, 0.1);
  const hit = cue("close", 0.22);
  riser(hit - 1.8, hit, 0.22);
  impact(hit, 0.8);
  [72, 76, 79, 84].forEach((m, i) => bell(hit + i * 0.18, m, 0.16, i % 2 ? 0.25 : -0.25));
}

// ---------------------------------------------------------------- mix: pad filter, reverb, master

{
  // gentle low-pass on the pads, brighter in act two
  let l = 0;
  for (let i = 0; i < N; i++) {
    const t = i / SR;
    const cut = t < darkEnd ? 700 : 1600;
    l += (1 - Math.exp((-TAU * cut) / SR)) * (padBus[i] - l);
    dryL[i] += l * 0.9;
    dryR[i] += l * 0.9;
    send[i] += l * 0.5;
  }
}
function reverb(input) {
  const combs = [1557, 1617, 1491, 1422, 1277, 1356].map((d) => ({ buf: new Float32Array(d), i: 0, fb: 0.86, lp: 0 }));
  const aps = [225, 556, 441].map((d) => ({ buf: new Float32Array(d), i: 0 }));
  const out = new Float32Array(N);
  for (let n = 0; n < N; n++) {
    let acc = 0;
    for (const c of combs) {
      const y = c.buf[c.i];
      c.lp = y * 0.7 + c.lp * 0.3;
      c.buf[c.i] = input[n] + c.lp * c.fb;
      c.i = (c.i + 1) % c.buf.length;
      acc += y;
    }
    let v = acc / combs.length;
    for (const a of aps) {
      const b = a.buf[a.i];
      const y = -v + b;
      a.buf[a.i] = v + b * 0.5;
      a.i = (a.i + 1) % a.buf.length;
      v = y;
    }
    out[n] = v;
  }
  return out;
}
const wet = reverb(send);
let peak = 0;
const L = new Float32Array(N);
const R = new Float32Array(N);
for (let i = 0; i < N; i++) {
  const t = i / SR;
  const fade = Math.min(1, t / 0.5) * Math.min(1, (TOTAL - t) / 2.5);
  L[i] = Math.tanh((dryL[i] + wet[i] * 0.9) * 0.55) * fade;
  R[i] = Math.tanh((dryR[i] + wet[(i + 331) % N] * 0.9) * 0.55) * fade;
  peak = Math.max(peak, Math.abs(L[i]), Math.abs(R[i]));
}
const gain = 0.7 / (peak || 1);

// ---------------------------------------------------------------- write the WAV

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
const outDir = join(root, "public", "music");
mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, "score.wav"), Buffer.concat([head, data]));
console.log(`score.wav: ${TOTAL.toFixed(1)} s, peak normalised from ${peak.toFixed(2)}`);
