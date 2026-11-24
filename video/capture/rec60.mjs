// Frame-exact recorder for the live site: every frame advances the page's clock by exactly 1/60 s,
// then Chrome draws it and we save it. Animations come out perfectly smooth however slow the machine
// is, while network requests (the live chain reads) still complete in real time.
//
// Usage from a shot script:  const rec = await open(url); await rec.frames(n, (i) => {...}); await rec.close();
import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { uptime } from "node:os";

const SHELL = new URL("../node_modules/.remotion/chrome-headless-shell/win64/chrome-headless-shell-win64/chrome-headless-shell.exe", import.meta.url);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
export const FPS = 60;
const STEP = 1000 / FPS;

export async function open(url, { width = 1920, height = 1080, out, port = 9520, profile }) {
  mkdirSync(out, { recursive: true });
  const chrome = spawn(decodeURIComponent(SHELL.pathname.replace(/^\//, "")), [
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${profile}`,
    "--enable-begin-frame-control",
    "--deterministic-mode",
    "--run-all-compositor-stages-before-draw",
    "--disable-threaded-animation",
    "--disable-threaded-scrolling",
    "--disable-checker-imaging",
    "--disable-new-content-rendering-timeout",
    "--hide-scrollbars",
    "--font-render-hinting=none",
    `--window-size=${width},${height}`,
    "about:blank",
  ]);
  let version;
  for (let i = 0; i < 120 && !version; i++) {
    await sleep(250);
    try {
      version = await (await fetch(`http://127.0.0.1:${port}/json/version`)).json();
    } catch {}
  }
  const ws = new WebSocket(version.webSocketDebuggerUrl);
  await new Promise((r) => ws.addEventListener("open", r));
  let id = 0;
  const pending = new Map();
  const listeners = [];
  ws.addEventListener("message", (e) => {
    const m = JSON.parse(e.data);
    if (m.id && pending.has(m.id)) {
      pending.get(m.id)(m);
      pending.delete(m.id);
    } else if (m.method) for (const l of listeners) l(m);
  });
  const raw = (method, params = {}, sessionId) =>
    new Promise((r) => {
      const n = ++id;
      pending.set(n, r);
      ws.send(JSON.stringify({ id: n, method, params, sessionId }));
    });
  const { result: target } = await raw("Target.createTarget", { url: "about:blank", width, height, enableBeginFrameControl: true });
  const { result: att } = await raw("Target.attachToTarget", { targetId: target.targetId, flatten: true });
  const sid = att.sessionId;
  const send = async (method, params = {}) => {
    const m = await raw(method, params, sid);
    if (m.error) throw new Error(`${method}: ${m.error.message}`);
    return m.result;
  };
  const js = async (expression) => (await send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true })).result?.value;
  const waitEvent = (name) =>
    new Promise((r) => {
      const l = (m) => {
        if (m.method === name && m.sessionId === sid) {
          listeners.splice(listeners.indexOf(l), 1);
          r(m.params);
        }
      };
      listeners.push(l);
    });

  await send("Page.enable");
  await send("Runtime.enable");
  await send("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile: false });
  // In the recording browser only: animation callbacks get the page's own clock as their timestamp,
  // so code that compares the two (count-ups, timed reveals) behaves exactly as in a normal browser.
  await send("Page.addScriptToEvaluateOnNewDocument", {
    source: "(() => { const raf = window.requestAnimationFrame.bind(window); window.requestAnimationFrame = (cb) => raf(() => cb(performance.now())); })();",
  });
  await send("Page.navigate", { url });

  let ticks = 0;
  let n = 0;
  /** Advance the clock by one frame, draw it, and save it. */
  async function frame() {
    // Granting the budget is enough: the page's clock moves by exactly one frame before the draw.
    await send("Emulation.setVirtualTimePolicy", { policy: "advance", budget: STEP });
    ticks += STEP;
    const r = await send("HeadlessExperimental.beginFrame", { frameTimeTicks: ticks, interval: STEP, screenshot: { format: "png" } });
    if (r.screenshotData) last = Buffer.from(r.screenshotData, "base64");
    if (last) writeFileSync(join(out, `f${String(n).padStart(5, "0")}.png`), last);
    n++;
  }
  let last = null;

  return {
    js,
    send,
    /** Let the page load in real time until `expression` is true (its live data is in), then freeze its clock for recording. */
    async ready(expression, timeoutMs = 90_000) {
      const t0 = Date.now();
      while (Date.now() - t0 < timeoutMs) {
        if (await js(`!!(${expression})`)) break;
        await sleep(500);
      }
      await send("Emulation.setVirtualTimePolicy", { policy: "pause" });
      // CSS animations follow the frame times, and stand still until those pass the page's own
      // start. Raise the starting frame time until the page's animation clock moves, then step on.
      let x = Math.max(ticks, Math.round(uptime() * 1000));
      for (let k = 0; k < 60; k++) {
        await send("Emulation.setVirtualTimePolicy", { policy: "advance", budget: STEP });
        await send("HeadlessExperimental.beginFrame", { frameTimeTicks: x, interval: STEP, noDisplayUpdates: false });
        if ((await js("document.timeline.currentTime || 0")) > 0) break;
        x = Math.round(x * 1.25 + 60_000);
      }
      ticks = x + STEP;
      return (Date.now() - t0) / 1000;
    },
    /** Navigate within the open page (same document), then wait for its data in real time. */
    async go(hash, expression, timeoutMs = 90_000) {
      await send("Emulation.setVirtualTimePolicy", { policy: "advance" });
      await js(`location.hash = ${JSON.stringify(hash)}`);
      const t0 = Date.now();
      while (Date.now() - t0 < timeoutMs) {
        if (await js(`!!(${expression})`)) break;
        await sleep(300);
      }
      await send("Emulation.setVirtualTimePolicy", { policy: "pause" });
    },
    /** Let real time pass (for live chain reads) while the page's clock stays still. */
    wait: sleep,
    /** Record `count` frames; `each(i)` runs before frame i, for scripted scrolling and clicks. */
    async frames(count, each) {
      for (let i = 0; i < count; i++) {
        if (each) await each(i);
        await frame();
      }
    },
    /** Advance the page without saving, for example while it boots. */
    async warm(count) {
      for (let i = 0; i < count; i++) {
        await send("Emulation.setVirtualTimePolicy", { policy: "advance", budget: STEP });
        ticks += STEP;
        await send("HeadlessExperimental.beginFrame", { frameTimeTicks: ticks, interval: STEP, noDisplayUpdates: false });
      }
    },
    count: () => n,
    async close() {
      ws.close();
      chrome.kill();
    },
  };
}

/** Smooth in-and-out motion, for camera moves. */
export const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
