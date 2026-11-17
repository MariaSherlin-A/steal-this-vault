/**
 * Measures the voice files in public/audio and writes their lengths into src/timing.json,
 * so each scene lasts exactly as long as its narration (plus a short tail). A scene with
 * no file keeps the script's estimate and gets no audio.
 *
 *   node scripts/timing.mjs
 */
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const timingPath = join(root, "src", "timing.json");
const timing = JSON.parse(readFileSync(timingPath, "utf8"));
const EXT = ["mp3", "wav", "m4a", "ogg", "aac", "flac"];

function duration(file) {
  const out = execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "default=noprint_wrappers=1:nokey=1", file], {
    encoding: "utf8",
  });
  const s = Number(out.trim());
  if (!Number.isFinite(s) || s <= 0) throw new Error(`ffprobe gave no duration for ${file}`);
  return s;
}

let total = 0;
let placed = 0;
for (const scene of timing.scenes) {
  const ext = EXT.find((e) => existsSync(join(root, "public", "audio", `${scene.file}.${e}`)));
  if (ext) {
    const s = duration(join(root, "public", "audio", `${scene.file}.${ext}`));
    scene.seconds = Math.round(s * 100) / 100;
    scene.audio = ext;
    placed++;
    total += s + timing.tailSeconds;
    console.log(`${scene.file}.${ext}  ${s.toFixed(2)} s  -> scene "${scene.id}"`);
  } else {
    scene.audio = null;
    total += scene.seconds;
    console.log(`${scene.file}  (no file, keeping the estimate of ${scene.seconds} s)`);
  }
}
writeFileSync(timingPath, JSON.stringify(timing, null, 2) + "\n");
const m = Math.floor(total / 60);
const sec = Math.round(total % 60);
console.log(`\n${placed} of ${timing.scenes.length} scenes have audio. Film length ${m}:${String(sec).padStart(2, "0")}${total > 180 ? "  OVER THE 3 MINUTE LIMIT" : ""}`);
