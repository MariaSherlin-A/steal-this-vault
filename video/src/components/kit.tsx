/** Shared pieces of the film: backdrop, grain, chapter card, captions, logo, icons, glitch text. */
import React from "react";
import { AbsoluteFill, interpolate, random, useCurrentFrame, useVideoConfig } from "remotion";
import { C, FONT, H, W, alpha } from "../theme";
import { clamp, ease, fadeIn, rise } from "./anim";

// ---------------------------------------------------------------- backdrop

const NODES = Array.from({ length: 70 }, (_, i) => ({
  x: random(`x${i}`) * W,
  y: random(`y${i}`) * H,
  vx: (random(`vx${i}`) - 0.5) * 0.6,
  vy: (random(`vy${i}`) - 0.5) * 0.6,
  r: random(`r${i}`) * 1.8 + 0.8,
}));

/** A slow drifting chain network, a perspective grid and two moving glows. `tone` tints it for danger. */
export const Backdrop: React.FC<{ tone?: "blue" | "red"; density?: number }> = ({ tone = "blue", density = 1 }) => {
  const frame = useCurrentFrame();
  const glow = tone === "red" ? C.red : C.primary;
  const nodes = NODES.slice(0, Math.round(NODES.length * density)).map((n) => ({
    x: (((n.x + n.vx * frame) % W) + W) % W,
    y: (((n.y + n.vy * frame) % H) + H) % H,
    r: n.r,
  }));
  const links: React.ReactNode[] = [];
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const a = nodes[i]!;
      const b = nodes[j]!;
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      if (d < 190) links.push(<line key={`${i}-${j}`} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={alpha(glow, 0.14 * (1 - d / 190))} strokeWidth={1} />);
    }
  }
  const gx = 960 + Math.sin(frame / 90) * 380;
  const gy = 380 + Math.cos(frame / 110) * 160;
  return (
    <AbsoluteFill style={{ background: C.bg, overflow: "hidden" }}>
      <AbsoluteFill
        style={{
          background: `radial-gradient(900px 600px at ${gx}px ${gy}px, ${alpha(glow, 0.16)}, transparent 70%), radial-gradient(800px 500px at ${1920 - gx}px ${1080 - gy / 2}px, ${alpha(C.safe, 0.07)}, transparent 70%)`,
        }}
      />
      <AbsoluteFill
        style={{
          transform: `perspective(900px) rotateX(62deg) translateY(${220 + (frame % 80)}px)`,
          transformOrigin: "50% 100%",
          backgroundImage: `linear-gradient(${alpha(glow, 0.12)} 1px, transparent 1px), linear-gradient(90deg, ${alpha(glow, 0.12)} 1px, transparent 1px)`,
          backgroundSize: "80px 80px",
          maskImage: "linear-gradient(to top, #000 0%, transparent 60%)",
          WebkitMaskImage: "linear-gradient(to top, #000 0%, transparent 60%)",
          top: "40%",
          height: "120%",
        }}
      />
      <svg width={W} height={H} style={{ position: "absolute", inset: 0 }}>
        {links}
        {nodes.map((n, i) => (
          <circle key={i} cx={n.x} cy={n.y} r={n.r} fill={alpha(i % 7 === 0 ? C.safe : glow, 0.7)} />
        ))}
      </svg>
      <AbsoluteFill style={{ background: "radial-gradient(ellipse at center, transparent 50%, rgba(0,0,0,0.65) 100%)" }} />
    </AbsoluteFill>
  );
};

/** Film grain and a faint scanline, laid over everything. */
export const Grain: React.FC = () => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{ pointerEvents: "none", mixBlendMode: "overlay", opacity: 0.22 }}>
      <svg width={W} height={H}>
        <filter id="grain">
          <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed={frame % 30} />
          <feColorMatrix type="saturate" values="0" />
        </filter>
        <rect width={W} height={H} filter="url(#grain)" />
      </svg>
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------- type

/** "STEP 01  THE DARE" in the top-left corner, sliding in. */
export const Chapter: React.FC<{ step: string; title: string; tone?: "blue" | "red" | "safe" }> = ({ step, title, tone = "blue" }) => {
  const frame = useCurrentFrame();
  const color = tone === "red" ? C.red : tone === "safe" ? C.safe : C.primary;
  const w = interpolate(frame, [4, 22], [0, 1], { ...clamp, easing: ease });
  return (
    <div style={{ position: "absolute", left: 96, top: 80, display: "flex", alignItems: "center", gap: 20, ...rise(frame, 2, 16, 14) }}>
      <span
        style={{
          font: `700 22px ${FONT.mono}`,
          letterSpacing: "0.12em",
          color: C.bg,
          background: color,
          padding: "6px 12px",
          borderRadius: 6,
          boxShadow: `0 0 30px ${alpha(color, 0.6)}`,
        }}
      >
        {step}
      </span>
      <span style={{ font: `700 40px ${FONT.display}`, letterSpacing: "0.02em", textTransform: "uppercase", color: C.text }}>{title}</span>
      <span style={{ width: 260 * w, height: 2, background: `linear-gradient(90deg, ${color}, transparent)` }} />
    </div>
  );
};

/** Captions at the bottom, the narration split into short phrases timed across the scene. */
export const Captions: React.FC<{ text: string }> = ({ text }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const words = text.split(/\s+/);
  const chunks: string[][] = [];
  let cur: string[] = [];
  for (const w of words) {
    cur.push(w);
    if (cur.length >= 9 || (/[.,:!?]$/.test(w) && cur.length >= 4)) {
      chunks.push(cur);
      cur = [];
    }
  }
  if (cur.length) chunks.push(cur);
  const usable = durationInFrames - 20;
  const total = words.length;
  let acc = 0;
  const spans = chunks.map((c) => {
    const start = 6 + (acc / total) * usable;
    acc += c.length;
    return { c, start, end: 6 + (acc / total) * usable };
  });
  const now = spans.find((s) => frame >= s.start && frame < s.end) ?? null;
  if (!now) return null;
  const local = frame - now.start;
  return (
    <div style={{ position: "absolute", left: 0, right: 0, bottom: 54, display: "flex", justifyContent: "center" }}>
      <div
        style={{
          padding: "10px 22px",
          borderRadius: 10,
          background: "rgba(5,7,15,0.62)",
          backdropFilter: "blur(6px)",
          font: `500 32px ${FONT.sans}`,
          color: C.text,
          opacity: fadeIn(local, 0, 5),
          maxWidth: 1500,
          textAlign: "center",
        }}
      >
        {now.c.join(" ")}
      </div>
    </div>
  );
};

/** Text that arrives with a brief RGB split, for the hard-hitting lines. */
export const Glitch: React.FC<{ children: string; at: number; style?: React.CSSProperties; color?: string }> = ({ children, at, style, color = C.text }) => {
  const frame = useCurrentFrame();
  const t = frame - at;
  if (t < 0) return null;
  const jitter = t < 10 ? (random(`g${frame}`) - 0.5) * 18 : 0;
  const split = t < 12 ? 8 * (1 - t / 12) : 0;
  return (
    <div style={{ position: "relative", ...style, transform: `translateX(${jitter}px) scale(${interpolate(t, [0, 8], [1.12, 1], clamp)})`, opacity: fadeIn(t, 0, 3) }}>
      {split > 0 ? (
        <>
          <span style={{ position: "absolute", inset: 0, color: C.red, transform: `translateX(${split}px)`, opacity: 0.8 }}>{children}</span>
          <span style={{ position: "absolute", inset: 0, color: C.safe, transform: `translateX(${-split}px)`, opacity: 0.8 }}>{children}</span>
        </>
      ) : null}
      <span style={{ position: "relative", color }}>{children}</span>
    </div>
  );
};

// ---------------------------------------------------------------- marks and icons

/** The two-ring logo; `draw` from 0 to 1 traces the outlines in. */
export const Logo: React.FC<{ size: number; draw?: number }> = ({ size, draw = 1 }) => (
  <svg width={size} height={size} viewBox="0 0 32 32" style={{ filter: `drop-shadow(0 0 ${size / 6}px ${alpha(C.primary, 0.6)})` }}>
    <defs>
      <linearGradient id="lg" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor={C.primary} />
        <stop offset="1" stopColor={C.safe} />
      </linearGradient>
    </defs>
    <path d="M16 1.8 28.3 8.9v14.2L16 30.2 3.7 23.1V8.9z" fill="none" stroke="url(#lg)" strokeWidth="1.8" strokeLinejoin="round" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - draw} />
    <path
      d="M16 7.6 23.3 11.8v8.4L16 24.4 8.7 20.2v-8.4z"
      fill={alpha(C.primary, 0.14 * draw)}
      stroke={C.safe}
      strokeWidth="1.2"
      strokeLinejoin="round"
      pathLength={1}
      strokeDasharray={1}
      strokeDashoffset={1 - Math.min(1, draw * 1.3)}
    />
    <g opacity={Math.max(0, draw * 2 - 1)}>
      <circle cx="16" cy="14.6" r="2.3" fill={C.text} />
      <path d="M14.9 15.8h2.2l.7 4.2h-3.6z" fill={C.text} />
    </g>
  </svg>
);

const stroke = { fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round", strokeLinejoin: "round" } as const;

export const KeyGlyph: React.FC<{ size?: number; color?: string }> = ({ size = 32, color = C.text }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" style={{ color }}>
    <circle cx="7.5" cy="15.5" r="4.5" {...stroke} />
    <path d="M10.7 12.3 20 3m-3.5 3.5 2.5 2.5M14 9l2 2" {...stroke} />
  </svg>
);

export const LockGlyph: React.FC<{ size?: number; color?: string; open?: boolean }> = ({ size = 32, color = C.text, open = false }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" style={{ color }}>
    <rect x="4.5" y="10.5" width="15" height="10" rx="2" {...stroke} />
    <path d={open ? "M8 10.5V7a4 4 0 0 1 7.6-1.8" : "M8 10.5V7a4 4 0 0 1 8 0v3.5"} {...stroke} />
    <circle cx="12" cy="15.5" r="1.3" fill="currentColor" />
  </svg>
);

export const ShieldGlyph: React.FC<{ size?: number; color?: string }> = ({ size = 32, color = C.safe }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" style={{ color }}>
    <path d="M12 2.8 19.5 5.6v6.1c0 4.6-3.2 8.2-7.5 9.5-4.3-1.3-7.5-4.9-7.5-9.5V5.6z" {...stroke} />
    <path d="m8.6 12 2.4 2.4 4.4-4.6" {...stroke} />
  </svg>
);

export const CheckGlyph: React.FC<{ size?: number; color?: string }> = ({ size = 24, color = C.safe }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" style={{ color }}>
    <path d="m5 12.5 4.5 4.5L19 7.5" {...stroke} strokeWidth={2.4} />
  </svg>
);

export const CrossGlyph: React.FC<{ size?: number; color?: string }> = ({ size = 24, color = C.red }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" style={{ color }}>
    <path d="m6 6 12 12M18 6 6 18" {...stroke} strokeWidth={2.4} />
  </svg>
);

/** A glowing card, the basic surface of the explainer scenes. */
export const Card: React.FC<{ children: React.ReactNode; style?: React.CSSProperties; glow?: string }> = ({ children, style, glow }) => (
  <div
    style={{
      background: `linear-gradient(180deg, ${C.panel}, ${C.bg2})`,
      border: `1.5px solid ${glow ?? C.line}`,
      borderRadius: 22,
      boxShadow: glow ? `0 0 0 1px ${alpha(glow, 0.25)}, 0 30px 90px -30px ${alpha(glow, 0.7)}` : "0 30px 80px -40px rgba(0,0,0,0.9)",
      ...style,
    }}
  >
    {children}
  </div>
);

/** Small uppercase label. */
export const Eyebrow: React.FC<{ children: React.ReactNode; color?: string; style?: React.CSSProperties }> = ({ children, color = C.primary, style }) => (
  <div style={{ font: `600 20px ${FONT.mono}`, letterSpacing: "0.16em", textTransform: "uppercase", color, ...style }}>{children}</div>
);
