import React from "react";
import { useCurrentFrame } from "remotion";
import { C, FONT } from "../theme";
import { Padlock } from "./Glyphs";

/**
 * A round vault door with its locks underneath. `open` (0..1) swings the door out on its
 * hinge; `shake` (0..1) rattles it in place; `glowSecond` lights the second lock.
 */
export const Vault: React.FC<{
  size?: number;
  locks: 1 | 2;
  open?: number;
  shake?: number;
  glowSecond?: boolean;
  label?: string;
  sublabel?: string;
  style?: React.CSSProperties;
}> = ({ size = 320, locks, open = 0, shake = 0, glowSecond = false, label, sublabel, style }) => {
  const frame = useCurrentFrame();
  const dx = Math.sin(frame * 2.6) * shake * size * 0.02;
  const stroke = size * 0.014;
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: size * 0.07, ...style }}>
      <div style={{ position: "relative", width: size, height: size, transform: `translateX(${dx}px)` }}>
        {/* the frame and the dark inside, seen when the door opens */}
        <svg width={size} height={size} viewBox="0 0 200 200" style={{ position: "absolute", inset: 0 }}>
          <circle cx={100} cy={100} r={94} fill="#07070a" stroke={C.brassDeep} strokeWidth={3} />
          <circle cx={100} cy={100} r={80} fill="none" stroke={C.lineSoft} strokeWidth={2} />
        </svg>
        <div
          style={{
            position: "absolute",
            inset: 0,
            transformOrigin: "6% 50%",
            transform: `perspective(${size * 2.6}px) rotateY(${-open * 100}deg)`,
          }}
        >
          <svg width={size} height={size} viewBox="0 0 200 200">
            <defs>
              <radialGradient id="door" cx="40%" cy="35%" r="75%">
                <stop offset="0%" stopColor={C.panel2} />
                <stop offset="100%" stopColor={C.bg2} />
              </radialGradient>
            </defs>
            <circle cx={100} cy={100} r={92} fill="url(#door)" stroke={C.brass} strokeWidth={stroke * (200 / size) * 1.2} />
            <circle cx={100} cy={100} r={74} fill="none" stroke={C.brassDeep} strokeWidth={2.2} />
            {Array.from({ length: 8 }, (_, i) => {
              const a = (i / 8) * Math.PI * 2;
              return <circle key={i} cx={100 + Math.cos(a) * 83} cy={100 + Math.sin(a) * 83} r={3.2} fill={C.brass} />;
            })}
            {Array.from({ length: 6 }, (_, i) => {
              const a = (i / 6) * Math.PI * 2 + frame * 0.004;
              return (
                <line
                  key={i}
                  x1={100}
                  y1={100}
                  x2={100 + Math.cos(a) * 56}
                  y2={100 + Math.sin(a) * 56}
                  stroke={C.brass}
                  strokeWidth={3.4}
                  strokeLinecap="round"
                />
              );
            })}
            <circle cx={100} cy={100} r={58} fill="none" stroke={C.brass} strokeWidth={3} />
            <circle cx={100} cy={100} r={13} fill={C.bg} stroke={C.brass} strokeWidth={3} />
            <circle cx={100} cy={100} r={4} fill={C.brass} />
          </svg>
        </div>
      </div>
      <div style={{ display: "flex", gap: size * 0.06, alignItems: "flex-end", height: size * 0.17 }}>
        <Padlock size={size * 0.13} color={C.brass} />
        {locks === 2 ? <Padlock size={size * 0.13} color={glowSecond ? C.mint : C.brass} glow={glowSecond} /> : null}
      </div>
      {label ? (
        <div style={{ textAlign: "center" }}>
          <div style={{ fontFamily: FONT.serif, fontSize: size * 0.12, color: C.text, lineHeight: 1.1 }}>{label}</div>
          {sublabel ? (
            <div style={{ fontFamily: FONT.mono, fontSize: size * 0.05, color: C.muted, marginTop: size * 0.03, letterSpacing: "0.08em" }}>
              {sublabel}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
};
