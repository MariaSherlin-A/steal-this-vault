/**
 * Fits the film to the voiceover. For each scene with a voice file in public/audio:
 *   - the scene lasts exactly as long as its recording (plus a short tail), so cuts
 *     never land mid-sentence;
 *   - the narration is split into phrases and each phrase is timed to the speech, using
 *     the pauses ffmpeg finds in the recording, so subtitles change when the voice does;
 *   - the speech spans are kept so the music can dip under the voice.
 * Writes src/timing.json and src/captions.json. Run `npm run score` afterwards so the
 * music is composed to the new lengths.
 *
 *   node scripts/timing.mjs
 */
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const timingPath = join(root, "src", "timing.json");
const captionsPath = join(root, "src", "captions.json");
const timing = JSON.parse(readFileSync(timingPath, "utf8"));
const EXT = ["mp3", "wav", "m4a", "ogg", "aac", "flac"];

// the narration text, read from src/script.ts (one quoted string per scene id)
const scriptSrc = readFileSync(join(root, "src", "script.ts"), "utf8");
const NARRATION = {};
for (const m of scriptSrc.matchAll(/\n {2}(\w+):\s*\n?\s*"([^"]+)"/g)) NARRATION[m[1]] = m[2];

function duration(file) {
  const out = execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "default=noprint_wrappers=1:nokey=1", file], { encoding: "utf8" });
  const s = Number(out.trim());
  if (!Number.isFinite(s) || s <= 0) throw new Error(`ffprobe gave no duration for ${file}`);
  return s;
}

/** Spans of speech, from the pauses ffmpeg detects. */
function speechSpans(file, total) {
  const r = spawnSync("ffmpeg", ["-v", "info", "-i", file, "-af", "silencedetect=noise=-38dB:d=0.16", "-f", "null", "-"], { encoding: "utf8" });
  const log = r.stderr;
  const silences = [];
  let start = null;
  for (const line of log.split("\n")) {
    const s = line.match(/silence_start: ([\d.]+)/);
    const e = line.match(/silence_end: ([\d.]+)/);
    if (s) start = Number(s[1]);
    if (e && start !== null) {
      silences.push([start, Number(e[1])]);
      start = null;
    }
  }
  if (start !== null) silences.push([start, total]);
  const spans = [];
  let t = 0;
  for (const [a, b] of silences) {
    if (a > t + 0.05) spans.push([t, a]);
    t = b;
  }
  if (t < total - 0.05) spans.push([t, total]);
  return spans.length ? spans : [[0, total]];
}

/** Subtitle phrases: broken at punctuation, and a phrase over 10 words split near its middle. */
function phrases(text) {
  const clauses = text.match(/[^.,:;!?]+[.,:;!?]*/g).map((c) => c.trim()).filter(Boolean);
  const out = [];
  let cur = "";
  for (const c of clauses) {
    const joined = cur ? `${cur} ${c}` : c;
    // keep very short clauses ("Step three:") with what follows, within the length limit
    if (cur && joined.split(" ").length > 10) {
      out.push(cur);
      cur = c;
    } else cur = joined;
    if (cur.split(" ").length >= 4 && /[.!?:]$/.test(cur)) {
      out.push(cur);
      cur = "";
    }
  }
  if (cur) out.push(cur);
  return out.flatMap((p) => {
    const w = p.split(" ");
    if (w.length <= 10) return [p];
    const mid = Math.ceil(w.length / 2);
    return [w.slice(0, mid).join(" "), w.slice(mid).join(" ")];
  });
}

/**
 * Time each phrase: lay the phrases' characters along the speech (pauses excluded), then
 * snap each phrase start to the end of the nearest pause, which is where a voice starts a
 * new phrase.
 */
function timePhrases(list, spans) {
  const speech = spans.reduce((n, [a, b]) => n + (b - a), 0);
  const chars = list.reduce((n, p) => n + p.length, 0);
  const at = (frac) => {
    let left = frac * speech;
    for (const [a, b] of spans) {
      if (left <= b - a) return a + left;
      left -= b - a;
    }
    return spans[spans.length - 1][1];
  };
  const starts = spans.map(([a]) => a);
  let acc = 0;
  let prev = -1;
  const timed = list.map((text, i) => {
    let start = i === 0 ? starts[0] : at(acc / chars);
    acc += text.length;
    // a new phrase begins where the voice resumes after a pause: take the nearest such
    // point after the previous phrase, if it is close to where the text says it should be
    const cands = starts.filter((s) => s > prev + 0.2);
    const near = cands.reduce((best, s) => (best === null || Math.abs(s - start) < Math.abs(best - start) ? s : best), null);
    if (near !== null && Math.abs(near - start) < 1.2) start = near;
    start = Math.max(start, prev + 0.2);
    prev = start;
    return { text, start };
  });
  return timed.map((p, i) => ({ text: p.text, start: round(p.start), end: round(i + 1 < timed.length ? timed[i + 1].start : spans[spans.length - 1][1] + 0.25) }));
}

const round = (s) => Math.round(s * 100) / 100;

const captions = {};
let total = 0;
let placed = 0;
for (const scene of timing.scenes) {
  const ext = EXT.find((e) => existsSync(join(root, "public", "audio", `${scene.file}.${e}`)));
  if (ext) {
    const file = join(root, "public", "audio", `${scene.file}.${ext}`);
    const s = duration(file);
    scene.seconds = round(s);
    scene.audio = ext;
    placed++;
    total += s + timing.tailSeconds;
    const spans = speechSpans(file, s);
    captions[scene.id] = { speech: spans.map(([a, b]) => [round(a), round(b)]), lines: NARRATION[scene.id] ? timePhrases(phrases(NARRATION[scene.id]), spans) : [] };
    console.log(`${scene.file}.${ext}  ${s.toFixed(2)} s, ${spans.length} spoken phrase(s) -> scene "${scene.id}"`);
  } else {
    scene.audio = null;
    total += scene.seconds;
    console.log(`${scene.file}  (no file, keeping ${scene.seconds} s)`);
  }
}
writeFileSync(timingPath, JSON.stringify(timing, null, 2) + "\n");
writeFileSync(captionsPath, JSON.stringify(captions, null, 2) + "\n");
const m = Math.floor(total / 60);
const sec = Math.round(total % 60);
console.log(`\n${placed} of ${timing.scenes.length} scenes have a voice. Film length ${m}:${String(sec).padStart(2, "0")}${total > 180 ? "  OVER THE 3 MINUTE LIMIT" : ""}`);
console.log("Now run: npm run score");
