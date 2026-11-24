// Records every site shot of the film from the live site, at exactly 60 fps, into
// public/rec/<shot>/fNNNNN.png, then encodes each to public/rec/<shot>.mp4.
//
//   node --experimental-websocket capture/shots.mjs [site-url] [only-shot]
//
// The site must be running (npm run dev at the repo root). The attack lab runs with recording OFF.
import { execFileSync } from "node:child_process";
import { mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { open, ease, FPS } from "./rec60.mjs";

const SITE = process.argv[2] ?? "http://localhost:5174/";
const ONLY = process.argv[3];
const ROOT = fileURLToPath(new URL("..", import.meta.url));
const REC = join(ROOT, "public", "rec");
const PROFILE = join(ROOT, "capture", ".profile");
mkdirSync(REC, { recursive: true });

const s = (sec) => Math.round(sec * FPS);

/** Where an element's top sits in page coordinates, minus a margin for the header. */
const topOf = (rec, sel, margin = 96) =>
  rec.js(`(() => { const el = document.querySelector(${JSON.stringify(sel)}); return el ? Math.round(el.getBoundingClientRect().top + window.scrollY - ${margin}) : null; })()`);

/** A camera move: scroll from where we are to `to` over `sec` seconds, eased. */
function glide(rec, from, to, sec) {
  const n = s(sec);
  return (i) => (i < n ? rec.js(`window.scrollTo(0, ${Math.round(from + (to - from) * ease((i + 1) / n))}); 1`) : null);
}

async function shot(name, url, readyExpr, script, { keepLoader = false } = {}) {
  if (ONLY && !ONLY.split(",").includes(name)) return;
  const out = join(REC, name);
  rmSync(out, { recursive: true, force: true });
  const rec = await open(url, { out, profile: PROFILE, port: 9600 + Math.floor(Math.random() * 300) });
  await rec.ready(readyExpr);
  await rec.js(`(() => { const st = document.createElement('style'); st.textContent = '.grain{display:none!important}'; document.head.appendChild(st); return 1; })()`);
  // let the opening loader finish off camera, unless this shot is about the loader
  if (!keepLoader) {
    for (let k = 0; k < 120 && (await rec.js("!!document.querySelector('.loader')")); k++) await rec.warm(6);
    await rec.warm(12);
  }
  const t0 = Date.now();
  await script(rec);
  console.log(`${name}: ${rec.count()} frames (${(rec.count() / FPS).toFixed(1)} s) in ${((Date.now() - t0) / 1000).toFixed(0)} s`);
  await rec.close();
  execFileSync("ffmpeg", ["-v", "error", "-y", "-framerate", String(FPS), "-i", join(out, "f%05d.png"), "-c:v", "libx264", "-preset", "slow", "-crf", "12", "-pix_fmt", "yuv420p", join(REC, `${name}.mp4`)]);
  rmSync(out, { recursive: true, force: true });
}

/** Run a sequence of steps: each is [seconds, (i) => action] and the frames are recorded. */
async function play(rec, steps) {
  for (const [sec, act] of steps) {
    const fn = typeof act === "function" ? await act() : null;
    await rec.frames(s(sec), fn ? (i) => fn(i) : undefined);
  }
}

const HOME = SITE;
const homeReady = "document.querySelector('.alert-line--head') && document.querySelector('.survived-title') && !/checking/i.test(document.querySelector('.survived-title').textContent)";

// 3 · the dare: the loader, the hero, copying the key
await shot("dare", HOME, "document.querySelector('.loader')", async (rec) => {
  await rec.send("Browser.grantPermissions", { permissions: ["clipboardReadWrite", "clipboardSanitizedWrite"] }).catch(() => {});
  await play(rec, [
    [5.5, null],
    [3.0, null],
    [0.2, async () => { await rec.js("document.querySelector('.keyslip .copy')?.click(); 1"); return null; }],
    [8.0, null],
  ]);
}, { keepLoader: true });

// 4 · two locks: glide down to the drawing and let it play by itself
await shot("locks", HOME, homeReady, async (rec) => {
  const to = await topOf(rec, ".locks-stage", 70);
  await play(rec, [
    [0.6, null],
    [1.6, () => glide(rec, 0, to, 1.6)],
    [16.5, null],
  ]);
});

// 5 · replay: the stage with stamps landing
await shot("replay", HOME, homeReady, async (rec) => {
  const head = await topOf(rec, "#replay", 0);
  const stage = await topOf(rec, ".th-target", 110);
  await rec.js(`window.scrollTo(0, ${head}); 1`);
  await play(rec, [
    [1.4, null],
    [1.4, () => glide(rec, head, stage, 1.4)],
    [9.5, null],
  ]);
});

// 6 · scoreboard: the two endings, then the 39.996, then why they failed
await shot("score", HOME, homeReady, async (rec) => {
  const head = await topOf(rec, "#score", 0);
  const endings = await topOf(rec, ".endings", 110);
  const cf = await topOf(rec, ".cf", 200);
  const board = await topOf(rec, ".board", 110);
  await rec.js(`window.scrollTo(0, ${head}); 1`);
  await play(rec, [
    [1.6, null],
    [1.4, () => glide(rec, head, endings, 1.4)],
    [6.0, null],
    [1.4, () => glide(rec, endings, cf, 1.4)],
    [5.0, null],
    [1.4, () => glide(rec, cf, board, 1.4)],
    [3.0, null],
  ]);
});

// 8 · the drill: the banner, the Q-Day switch, the proof card
await shot("drill", HOME, homeReady, async (rec) => {
  const banner = await topOf(rec, ".survived", 110);
  const qd = await topOf(rec, ".qd", 120);
  const proof = await topOf(rec, ".drillday", 110);
  await rec.js(`window.scrollTo(0, ${banner}); 1`);
  await play(rec, [
    [5.0, null],
    [1.3, () => glide(rec, banner, qd, 1.3)],
    [1.6, null],
    [0.1, async () => { await rec.js("document.querySelectorAll('.qd-switch button')[1].click(); 1"); return null; }],
    [3.4, null],
    [1.3, () => glide(rec, qd, proof, 1.3)],
    [4.0, null],
  ]);
});

// 9 · alerts and rescue
await shot("watch", HOME, homeReady, async (rec) => {
  const grid = await topOf(rec, ".watch-grid", 110);
  const rescue = await topOf(rec, ".rescue-steps", 160);
  await rec.js(`window.scrollTo(0, ${grid - 300}); 1`);
  await play(rec, [
    [1.2, () => glide(rec, grid - 300, grid, 1.2)],
    [6.0, null],
    [1.4, () => glide(rec, grid, rescue, 1.4)],
    [6.5, null],
  ]);
});

// 10 · intruders: the story card and the money trail
await shot("intruders", HOME + "#intruders", "document.querySelectorAll('.trail li').length > 0", async (rec) => {
  const cards = await topOf(rec, ".intruders", 100);
  const trail = await topOf(rec, ".intruder--robbed .trail, .trail", 380);
  await rec.js(`window.scrollTo(0, ${cards}); 1`);
  await play(rec, [
    [3.4, null],
    [1.3, () => glide(rec, cards, trail, 1.3)],
    [4.5, null],
  ]);
});

// menu, for the transition into the lab
await shot("menu", HOME, homeReady, async (rec) => {
  await play(rec, [
    [0.8, null],
    [0.1, async () => { await rec.js("document.querySelector('.menubtn').click(); 1"); return null; }],
    [3.2, null],
  ]);
});

// 7 · the attack lab: recording off, Run all 19, then the scorecard and the twin
await shot("lab", HOME + "#lab", "document.querySelector('.lab-actions .btn') && document.querySelector('.switch input')", async (rec) => {
  await rec.js("(() => { const i = document.querySelector('.switch input'); if (i.checked) i.click(); return i.checked; })()");
  const list = await topOf(rec, ".lab-bar", 110);
  await play(rec, [
    [1.4, null],
    [1.0, () => glide(rec, 0, list, 1.0)],
    [0.6, null],
  ]);
  await rec.js("[...document.querySelectorAll('.lab-actions .btn')].find((b) => /run all/i.test(b.textContent)).click(); 1");
  // follow the list down while the attempts run: one frame at a time, until the run ends
  const end = await rec.js("document.querySelector('.group--control').getBoundingClientRect().top + window.scrollY - 500");
  let y = list;
  let frames = 0;
  while ((await rec.js("/stop after/i.test(document.querySelector('.lab-actions').textContent)")) && frames < s(90)) {
    const running = await rec.js("(() => { const r = document.querySelector('.attack--running'); return r ? Math.round(r.getBoundingClientRect().top + window.scrollY - 380) : null; })()");
    if (running !== null) y += Math.max(-40, Math.min(40, (running - y) * 0.08));
    await rec.frames(1, () => rec.js(`window.scrollTo(0, ${Math.round(Math.min(y, end))}); 1`));
    frames++;
  }
  console.log("  run finished:", await rec.js("document.querySelector('.scorecard')?.textContent"));
  const now = await rec.js("Math.round(window.scrollY)");
  const card = await topOf(rec, ".scorecard", 110);
  const twin = await topOf(rec, ".group--control", 110);
  await play(rec, [
    [0.6, null],
    [1.6, () => glide(rec, now, card, 1.6)],
    [5.0, null],
    [1.4, () => glide(rec, card, twin, 1.4)],
    [4.0, null],
  ]);
});

process.exit(0);
