/** The film's look: Paper & Ink, the site's fonts, and the pieces every scene is built from. */
import React, { useEffect, useState } from "react";
import { AbsoluteFill, Easing, continueRender, delayRender, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import type { Word } from "./timing";

export const C = {
  paper: "#ECE7DC",
  paper2: "#E2DCCF",
  ink: "#141311",
  ink2: "#1D1B18",
  violet: "#5B3DF5",
  violetTint: "#9C8CFF",
  mint: "#3DDC97",
  carmine: "#D7263D",
  carmineTint: "#FF8F9C",
  grey: "#8A857B",
};

export const F = {
  display: "'Archivo', 'Arial Narrow', sans-serif",
  body: "'IBM Plex Sans', 'Segoe UI', sans-serif",
  mono: "'JetBrains Mono', Consolas, monospace",
};

/** Loads the site's fonts (Archivo with its width axis, Plex, JetBrains Mono) before any frame renders. */
export function useFonts(): void {
  const [handle] = useState(() => delayRender("fonts"));
  useEffect(() => {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href =
      "https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@62..125,400..900&family=IBM+Plex+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600;700&display=block";
    link.onload = () => {
      const want = ["800 40px Archivo", "400 20px 'IBM Plex Sans'", "600 20px 'IBM Plex Sans'", "500 20px 'JetBrains Mono'", "700 20px 'JetBrains Mono'"];
      Promise.all(want.map((f) => document.fonts.load(f))).then(() => continueRender(handle));
    };
    link.onerror = () => continueRender(handle);
    document.head.appendChild(link);
  }, [handle]);
}

export const easeOut = Easing.bezier(0.22, 1, 0.36, 1);
export const easeInOut = Easing.bezier(0.65, 0, 0.35, 1);
export const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

/** 0 → 1 over `dur` frames starting at `at`, eased. */
export const rise = (frame: number, at: number, dur = 24, ease = easeOut) => interpolate(frame, [at, at + dur], [0, 1], { ...clamp, easing: ease });

/** Wide, heavy, all-caps poster type, as on the site. */
export const posterStyle = (size: number, color: string = C.ink): React.CSSProperties => ({
  fontFamily: F.display,
  fontWeight: 800,
  fontVariationSettings: "'wdth' 125",
  fontStretch: "125%",
  textTransform: "uppercase",
  letterSpacing: "-0.035em",
  lineHeight: 0.86,
  fontSize: size,
  color,
});

export const micro = (color: string = C.grey, size = 20): React.CSSProperties => ({
  fontFamily: F.mono,
  fontWeight: 500,
  fontSize: size,
  letterSpacing: "0.14em",
  textTransform: "uppercase",
  color,
});

/** A poster headline whose lines rise out of a mask, one after another. */
export function PosterLines({
  lines,
  at = 0,
  size = 170,
  color = C.ink,
  accent = C.violet,
  stagger = 6,
}: {
  lines: { text: string; accent?: boolean }[];
  at?: number;
  size?: number;
  color?: string;
  accent?: string;
  stagger?: number;
}) {
  const frame = useCurrentFrame();
  return (
    <div>
      {lines.map((l, i) => {
        const p = rise(frame, at + i * stagger, 30);
        return (
          <div key={i} style={{ overflow: "hidden", paddingBottom: size * 0.06, marginBottom: -size * 0.06 }}>
            <div style={{ ...posterStyle(size, l.accent ? accent : color), transform: `translateY(${(1 - p) * 110}%) rotate(${(1 - p) * 2.5}deg)`, transformOrigin: "0 100%" }}>
              {l.text}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** Corner marks, like a viewfinder. */
export function Corners({ inset = 40, size = 46, color = C.ink, width = 3, opacity = 1 }: { inset?: number; size?: number; color?: string; width?: number; opacity?: number }) {
  const mark = (style: React.CSSProperties, rot: number) => (
    <svg width={size} height={size} viewBox="0 0 40 40" style={{ position: "absolute", ...style, transform: `rotate(${rot}deg)`, opacity }}>
      <path d="M1 40 V1 H40" fill="none" stroke={color} strokeWidth={width * (40 / size)} />
    </svg>
  );
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      {mark({ left: inset, top: inset }, 0)}
      {mark({ right: inset, top: inset }, 90)}
      {mark({ right: inset, bottom: inset }, 180)}
      {mark({ left: inset, bottom: inset }, 270)}
    </AbsoluteFill>
  );
}

/** Paper grain over everything, alive (the seed moves every few frames). */
export function Grain({ opacity = 0.11 }: { opacity?: number }) {
  const frame = useCurrentFrame();
  const seed = Math.floor(frame / 3) % 9;
  return (
    <AbsoluteFill style={{ pointerEvents: "none", opacity, mixBlendMode: "multiply" }}>
      <svg width="100%" height="100%">
        <filter id={`g${seed}`}>
          <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves={3} seed={seed} stitchTiles="stitch" />
          <feColorMatrix values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 .55 0" />
        </filter>
        <rect width="100%" height="100%" filter={`url(#g${seed})`} />
      </svg>
    </AbsoluteFill>
  );
}

/** A band of words scrolling sideways, as on the site, used as a wipe between scenes. */
export function StripWipe({ at, items, tone = "ink", dur = 34 }: { at: number; items: string[]; tone?: "ink" | "violet"; dur?: number }) {
  const frame = useCurrentFrame();
  const p = interpolate(frame, [at, at + dur], [0, 1], clamp);
  if (p <= 0 || p >= 1) return null;
  const bg = tone === "violet" ? C.violet : C.ink;
  const y = interpolate(p, [0, 0.5, 1], [1200, 0, -1200], { easing: easeInOut });
  const drift = (frame - at) * 9;
  const run = [...items, ...items, ...items];
  return (
    <AbsoluteFill style={{ pointerEvents: "none", justifyContent: "center", transform: `translateY(${y}px) rotate(-3deg) scale(1.15)` }}>
      <div style={{ background: bg, height: 1500, display: "flex", flexDirection: "column", justifyContent: "center", gap: 40, overflow: "hidden" }}>
        {[0, 1, 2, 3, 4].map((row) => (
          <div key={row} style={{ display: "flex", gap: 48, whiteSpace: "nowrap", transform: `translateX(${-(drift * (row % 2 ? -1 : 1)) - 600}px)` }}>
            {run.map((t, i) => (
              <span key={i} style={{ ...posterStyle(110, row % 2 ? C.paper : tone === "violet" ? C.ink : C.paper), display: "inline-flex", alignItems: "center", gap: 48 }}>
                {t}
                <svg width={56} height={56} viewBox="0 0 20 20">
                  <path d="M10 0 L12 8 L20 10 L12 12 L10 20 L8 12 L0 10 L8 8 Z" fill={tone === "violet" ? C.ink : C.mint} />
                </svg>
              </span>
            ))}
          </div>
        ))}
      </div>
    </AbsoluteFill>
  );
}

/** Words that light up as the voice reaches them. Danger words go carmine, safety words mint. */
const RED = /^(fake|malware|stolen|steal|thief|theft|thefts|robbed|robbery|leak|q-day|quantum|threat|copies|gone|lost)$/i;
const SAFE = /^(refused|second|quantum-safe|safe|survived|nothing|owner|both|zero|eighteen|lock|locks|vault)$/i;

export function Subtitles({ words, dark = false }: { words: Word[]; dark?: boolean }) {
  const frame = useCurrentFrame();
  // group into lines of about 8 words, by sentence where possible
  const lines: Word[][] = [];
  let cur: Word[] = [];
  for (const w of words) {
    cur.push(w);
    if (cur.length >= 9 || (/[.!?:]$/.test(w.text) && cur.length >= 4)) {
      lines.push(cur);
      cur = [];
    }
  }
  if (cur.length) lines.push(cur);
  const line = lines.find((l, i) => frame >= l[0].from - 4 && (i === lines.length - 1 || frame < lines[i + 1][0].from - 4));
  if (!line) return null;
  const end = line[line.length - 1].to + 20;
  const show = interpolate(frame, [line[0].from - 4, line[0].from + 4, end, end + 8], [0, 1, 1, 0], clamp);
  return (
    <AbsoluteFill style={{ justifyContent: "flex-end", alignItems: "center", paddingBottom: 54, pointerEvents: "none" }}>
      <div
        style={{
          opacity: show,
          transform: `translateY(${(1 - show) * 10}px)`,
          maxWidth: 1500,
          padding: "16px 30px 18px",
          background: dark ? "rgba(236,231,220,0.94)" : "rgba(20,19,17,0.9)",
          backdropFilter: "blur(8px)",
          fontFamily: F.body,
          fontWeight: 600,
          fontSize: 38,
          lineHeight: 1.3,
          textAlign: "center",
          letterSpacing: "-0.005em",
        }}
      >
        {line.map((w, i) => {
          const lit = frame >= w.from - 2;
          const bare = w.text.replace(/[^\w-]/g, "");
          const color = RED.test(bare) ? (dark ? C.carmine : C.carmineTint) : SAFE.test(bare) ? (dark ? "#14844f" : C.mint) : dark ? C.ink : C.paper;
          return (
            <span key={i} style={{ color, opacity: lit ? 1 : 0.38, transition: "none" }}>
              {w.text}{" "}
            </span>
          );
        })}
      </div>
    </AbsoluteFill>
  );
}

/** A label that points at something on screen: a box around it and a tag above. */
export function Callout({
  at,
  until,
  box,
  label,
  tone = "violet",
  tagSide = "top",
}: {
  at: number;
  until?: number;
  /** x, y, w, h in film pixels. */
  box: [number, number, number, number];
  label: string;
  tone?: "violet" | "mint" | "carmine" | "ink";
  tagSide?: "top" | "bottom";
}) {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const end = until ?? durationInFrames;
  const p = rise(frame, at, 18);
  const out = interpolate(frame, [end - 10, end], [1, 0], clamp);
  const o = Math.min(p, out);
  if (o <= 0) return null;
  const color = { violet: C.violet, mint: C.mint, carmine: C.carmine, ink: C.ink }[tone];
  const fg = tone === "mint" ? C.ink : C.paper;
  const [x, y, w, h] = box;
  const draw = interpolate(frame, [at, at + 22], [0, 1], { ...clamp, easing: easeOut });
  const per = 2 * (w + h);
  return (
    <AbsoluteFill style={{ pointerEvents: "none", opacity: o }}>
      <svg width={1920} height={1080} style={{ position: "absolute", inset: 0 }}>
        <rect x={x} y={y} width={w} height={h} fill="none" stroke={color} strokeWidth={5} strokeDasharray={per} strokeDashoffset={per * (1 - draw)} rx={4} />
      </svg>
      <div
        style={{
          position: "absolute",
          left: x,
          top: tagSide === "top" ? y - 58 : y + h + 12,
          padding: "9px 16px",
          background: color,
          color: fg,
          fontFamily: F.mono,
          fontWeight: 700,
          fontSize: 24,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          whiteSpace: "nowrap",
          transform: `translateY(${(1 - p) * 12}px)`,
        }}
      >
        {label}
      </div>
    </AbsoluteFill>
  );
}

/** The chapter tag in the top-left corner of every site scene: "[04] // SCOREBOARD". */
export function ChapterTag({ n, label, dark = false }: { n: string; label: string; dark?: boolean }) {
  const frame = useCurrentFrame();
  const p = rise(frame, 4, 20);
  return (
    <div style={{ position: "absolute", left: 64, top: 30, display: "flex", alignItems: "center", gap: 16, opacity: p, transform: `translateX(${(1 - p) * -20}px)` }}>
      <span style={{ ...micro(dark ? C.mint : C.violet, 22), fontWeight: 700 }}>[{n}]</span>
      <span style={{ width: 70, height: 2, background: dark ? C.paper : C.ink, opacity: 0.5 }} />
      <span style={{ ...micro(dark ? C.paper : C.ink, 22), fontWeight: 700 }}>{label}</span>
    </div>
  );
}
