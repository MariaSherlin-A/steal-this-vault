import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { C, FONT } from "../theme";
import { Coin } from "../components/Glyphs";
import { clamp, ease, rise } from "../components/anim";

const RINGS = [
  { r: 400, tone: C.brass, title: "The chain", text: "refuses any native transaction without the second signature" },
  { r: 290, tone: C.brass, title: "The window", text: "lets the owner's account reach only the two vaults, and only the owner can open it, with both keys" },
  { r: 180, tone: C.mint, title: "The vault", text: "verifies the ML-DSA-87 signature itself, through the chain's precompile" },
];

/** Scene 6. Three rings light up around the coin, outermost first. */
export const LayersScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { durationInFrames: T } = useVideoConfig();
  const ats = [0.14, 0.4, 0.64].map((f) => Math.round(T * f));
  const lastAt = Math.round(T * 0.86);
  const cx = 660;
  const cy = 560;
  return (
    <AbsoluteFill>
      <div style={{ position: "absolute", left: 100, top: 90, fontFamily: FONT.serif, fontSize: 60, color: C.text, ...rise(frame, 4) }}>Three layers.</div>
      <svg width={1920} height={1080} style={{ position: "absolute", inset: 0 }}>
        {RINGS.map((ring, i) => {
          const draw = interpolate(frame, [ats[i], ats[i] + 26], [0, 1], { ...clamp, easing: ease });
          const circ = 2 * Math.PI * ring.r;
          return (
            <g key={i}>
              <circle cx={cx} cy={cy} r={ring.r} fill="none" stroke={C.lineSoft} strokeWidth={2} />
              <circle
                cx={cx}
                cy={cy}
                r={ring.r}
                fill="none"
                stroke={ring.tone}
                strokeWidth={4}
                strokeDasharray={circ}
                strokeDashoffset={circ * (1 - draw)}
                transform={`rotate(-90 ${cx} ${cy})`}
                style={{ filter: `drop-shadow(0 0 10px ${ring.tone}66)` }}
              />
            </g>
          );
        })}
      </svg>
      <div style={{ position: "absolute", left: cx - 44, top: cy - 44, opacity: interpolate(frame, [0, 14], [0, 1], clamp) }}>
        <Coin size={88} />
      </div>
      <div style={{ position: "absolute", left: 1160, top: 250, width: 660, display: "flex", flexDirection: "column", gap: 54 }}>
        {RINGS.map((ring, i) => (
          <div key={i} style={{ ...rise(frame, ats[i] + 6, 18) }}>
            <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
              <div style={{ width: 16, height: 16, borderRadius: 8, background: ring.tone, boxShadow: `0 0 14px ${ring.tone}` }} />
              <div style={{ fontFamily: FONT.serif, fontSize: 50, color: C.text }}>{ring.title}</div>
            </div>
            <div style={{ fontFamily: FONT.sans, fontSize: 27, color: C.muted, marginTop: 8, lineHeight: 1.35 }}>{ring.text}</div>
          </div>
        ))}
      </div>
      <div style={{ position: "absolute", left: 100, bottom: 60, fontFamily: FONT.serif, fontSize: 40, color: C.mint, ...rise(frame, lastAt) }}>
        No fallback. A failed check is counted, and the money stays.
      </div>
    </AbsoluteFill>
  );
};
