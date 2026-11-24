import { open, ease } from "./rec60.mjs";
const SP = process.argv[2];
const rec = await open("http://localhost:5174/", { out: `${SP}/rt/frames`, profile: `${SP}/rt/profile`, port: 9550 });
console.log("data ready after", await rec.ready("document.querySelector('.alert-line--head')"), "s");
await rec.js("document.querySelector('.grain')?.remove(); 1");
const to = (p, ms) => Promise.race([p, new Promise((r) => setTimeout(() => r("TIMEOUT"), ms))]);
console.log("clock drift ms:", await rec.drift());
const t0 = Date.now();
for (let i = 0; i < 300; i++) {
  if (i >= 180) {
    const e = await to(rec.js(`window.scrollTo(0, ${Math.round(ease((i - 180) / 120) * 900)}); 1`), 5000);
    if (e === "TIMEOUT") { console.log("eval TIMEOUT at", i); break; }
  }
  const f = await to(rec.frames(1), 5000);
  if (f === "TIMEOUT") { console.log("frame TIMEOUT at", i); break; }
  if (i % 60 === 0) console.log("frame", i, ((Date.now() - t0) / 1000).toFixed(1) + "s");
}
console.log("frames", rec.count(), "real seconds", (Date.now() - t0) / 1000);
await rec.close();
process.exit(0);
