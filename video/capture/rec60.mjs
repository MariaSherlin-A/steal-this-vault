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
  await send("Page.navigate", { url });

  let ticks = 0;
  let base = 0;
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
      // Chrome's frame times count from when the computer started; the page's clock from when it
      // loaded. One calibration frame finds the gap, so animation timestamps match the page's clock.
      await js("window.__raf = null; requestAnimationFrame((t) => (window.__raf = t)); 1");
      const probe = Math.round(uptime() * 1000);
      await send("Emulation.setVirtualTimePolicy", { policy: "advance", budget: STEP });
      await send("HeadlessExperimental.beginFrame", { frameTimeTicks: probe, interval: STEP, noDisplayUpdates: false });
      const seen = await js("window.__raf");
      base = seen == null ? 0 : probe - seen;
      ticks = base + (await js("performance.now()")) + STEP;
      // then measure what is left of the gap and take it out, until it is under a millisecond
      for (let k = 0; k < 4; k++) {
        const d = await this.drift();
        if (Math.abs(d) < 1) break;
        base -= d;
        ticks -= d;
      }
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
      ticks = Math.max(ticks, base + (await js("performance.now()")) + STEP);
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
    /** For checks: the gap between the page clock and an animation timestamp, in ms (should be about 0). */
    async drift() {
      await js("window.__raf2 = null; requestAnimationFrame((t) => (window.__raf2 = t)); 1");
      await frame();
      n--;
      return (await js("window.__raf2 - performance.now()"));
    },
    async close() {
      ws.close();
      chrome.kill();
    },
  };
}

/** Smooth in-and-out motion, for camera moves. */
export const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
