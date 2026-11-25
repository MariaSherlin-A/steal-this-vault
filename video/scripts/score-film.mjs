/**
 * The second film's original score, composed in code and synced to src/film/words.json and the
 * scene pads in src/film/timing.ts. Writes public/music/film-score.wav (44.1 kHz, 16-bit stereo).
 *
 *   node scripts/score-film.mjs
 *
 * Act one (the problem, Q-Day) is dark: a drone, a heartbeat, glitches on each leak, a riser into
 * a deep hit on "Q-Day". From the dare on it turns to a major key with a steady pulse, a soft tick
 * on every refusal, a lift on "survived", and resolves on the close. Every sound is made here.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const words = JSON.parse(readFileSync(join(root, "src", "film", "words.json"), "utf8"));
const timingSrc = readFileSync(join(root, "src", "film", "timing.ts"), "utf8");

const SR = 44100;
const FPS = 60;
// the same pads as src/film/timing.ts, read from it so the two never disagree
const PAD = Object.fromEntries([...timingSrc.matchAll(/\n  (\w+): \[([\d.]+), ([\d.]+)\]/g)].map((m) => [m[1], [Number(m[2]), Number(m[3])]]));
const ORDER = Object.keys(words);
const scene = {};
let at = 0;
for (const id of ORDER) {
  const lead = Math.round(PAD[id][0] * FPS);
  const frames = lead + Math.round(words[id].seconds * FPS) + Math.round(PAD[id][1] * FPS);
  scene[id] = { start: at / FPS, dur: frames / FPS, lead: lead / FPS };
  at += frames;
}
const TOTAL = at / FPS;
const N = Math.ceil(TOTAL * SR);
/** Absolute time of the first word matching `re` in a scene. */
const word = (id, re) => {
  const w = words[id].words.find((x) => re.test(x[0]));
  return scene[id].start + scene[id].lead + (w ? w[1] : 0);
};

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

const darkEnd = scene.dare.start;
{
  const len = Math.floor((darkEnd + 1.5) * SR);
  for (let k = 0; k < len; k++) {
    const t = k / SR;
    const fadeIn = Math.min(1, t / 3);
    const fadeOut = t > darkEnd - 0.5 ? Math.max(0, 1 - (t - darkEnd + 0.5) / 2) : 1;
    const lfo = 0.75 + 0.25 * Math.sin(TAU * 0.08 * t);
    put(k, (Math.sin(TAU * hz(33) * t) * 0.5 + Math.sin(TAU * hz(40) * t) * 0.2) * lfo * fadeIn * fadeOut * 0.26, 0, 0.1);
  }
}
const darkChords = [
  [45, 48, 52, 57],
  [41, 45, 48, 55],
  [38, 45, 50, 53],
  [40, 44, 47, 52],
];
for (let t = 0, i = 0; t < darkEnd - 1; t += 4.5, i++) pad(t, 4.6, darkChords[i % 4], 0.018, 1.5, 2);
for (let t = 0.5; t < word("problem", /^Whoever$/); t += 60 / 64) heart(t, 0.45);
// each leak: a glitch as the wallet drains
for (const re of [/^fake$/, /^Malware$/, /^backup$/]) {
  glitch(word("problem", re) + 0.9, 0.16);
  sine(word("problem", re) + 0.8, 0.9, 660, 140, 0.05, 0.6, 0, 0.3);
}
impact(word("problem", /^Whoever$/), 0.55);
bell(word("problem", /^Whoever$/), 69, 0.1);
impact(word("problem", /^Last$/), 0.7);
// Q-Day: ticking while the quantum computer works, a riser, the biggest hit
for (let t = word("qday", /^quantum$/); t < word("qday", /^Q-Day\.$/) - 2; t += 0.25) tick(t, 0.06, rnd() - 0.5);
riser(word("qday", /^Q-Day\.$/) - 3, word("qday", /^Q-Day\.$/) - 0.1, 0.45);
impact(word("qday", /^Q-Day\.$/), 1.25);
glitch(word("qday", /^Q-Day\.$/), 0.3);
pad(word("qday", /^Q-Day\.$/), 6, [33, 40, 45, 48], 0.02, 0.2, 2.5);

// ---------------------------------------------------------------- the turn and the solution (C major)

const bpm = 100;
const beat = 60 / bpm;
const solStart = scene.dare.start;
const solEnd = scene.close.start;
const prog = [
  [48, 55, 60, 64, 67],
  [43, 50, 55, 59, 62],
  [45, 52, 57, 60, 64],
  [41, 48, 53, 57, 60],
];
const intensity = (t) => (t < scene.locks.start ? 0.55 : t < scene.lab.start ? 0.75 : t < scene.drill.start ? 1 : 0.7);
let bar = 0;
for (let t = solStart; t < solEnd; t += beat * 4, bar++) {
  const ch = prog[bar % 4];
  pad(t, beat * 4, ch.slice(0, 4), 0.016, 0.4, 1.0);
  for (let b = 0; b < 4; b++) {
    const bt = t + b * beat;
    if (bt >= solEnd) break;
    const I = intensity(bt);
    if (b === 0 || b === 2) kick(bt, 0.5 * I);
    if (bt > scene.locks.start) hat(bt + beat / 2, 0.05 * I, 0.25);
    const sub = bt >= scene.lab.start && bt < scene.drill.start ? 4 : 2;
    for (let s = 0; s < sub; s++) pluck(bt + (s * beat) / sub, ch[(b * sub + s) % ch.length] + 24, 0.06 * I, ((b * sub + s) % 3) * 0.3 - 0.3);
  }
}
for (let t = solStart, i = 0; t < solEnd; t += beat * 4, i++) sine(t, beat * 4, hz(prog[i % 4][0] - 12), hz(prog[i % 4][0] - 12), 0.2, 1.6, 0, 0.05);

// accents on the words that matter
impact(word("dare", /^publishes$/), 0.45);
impact(word("locks", /^first$/) + 0.4, 0.4);
glitch(word("locks", /^first$/) + 0.4, 0.1);
bell(word("locks", /^No$/), 76, 0.16);
bell(word("locks", /^No$/) + 0.15, 83, 0.1);
for (let i = 0; i < 4; i++) tick(word("replay", /^Every$/) + i * 0.18, 0.12, 0.3);
impact(word("score", /^robbed\.$/), 0.6);
glitch(word("score", /^robbed\.$/), 0.14);
bell(word("score", /^nothing\.$/), 79, 0.16);
for (let i = 0; i < 18; i++) tick(word("lab", /^live\.$/) + i * 0.09, 0.1, 0.4);
bell(word("lab", /^refused\.$/), 72, 0.18);
bell(word("lab", /^refused\.$/) + 0.18, 79, 0.14);
impact(word("lab", /^pays\.$/), 0.5);
riser(word("drill", /^Zero$/) - 1.3, word("drill", /^Zero$/), 0.2);
[72, 76, 79].forEach((m, i) => bell(word("drill", /^Zero$/) + i * 0.2, m, 0.16));
whoosh(word("watch", /^way$/), 0.2);

// ---------------------------------------------------------------- transitions: an air whoosh and a low thump on every cut

for (const [id, sc] of Object.entries(scene)) {
  if (sc.start < 0.5) continue;
  noiseHit(sc.start - 0.35, 0.8, 0.13, 0.3, 400, 5200, id.length % 2 ? 0.3 : -0.3, 0.55);
  sine(sc.start, 0.5, 90, 45, 0.18, 0.18, 0, 0.1);
}

// ---------------------------------------------------------------- the close

{
  const c = scene.close;
  pad(c.start, c.dur - 1.5, [36, 48, 55, 60, 64, 67, 72], 0.016, 1.5, 3.5);
  sine(c.start, c.dur, hz(36), hz(36), 0.3, 3.5, 0, 0.1);
  const hit = word("close", /^Steal$/);
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
writeFileSync(join(outDir, "film-score.wav"), Buffer.concat([head, data]));
console.log(`film-score.wav: ${TOTAL.toFixed(1)} s, peak normalised from ${peak.toFixed(2)}`);
