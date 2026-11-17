import React, { useMemo } from "react";
import { AbsoluteFill, random, useCurrentFrame } from "remotion";
import { C, FONT, H, W } from "../theme";

const HEX = "0123456789abcdef";

interface Column {
  x: number;
  speed: number;
  offset: number;
  chars: string;
  size: number;
  alpha: number;
}

/** A warm black field with a faint grid, slow hex rain and a vignette. Deterministic per frame. */
export const Background: React.FC = () => {
  const frame = useCurrentFrame();
  const columns = useMemo<Column[]>(() => {
    const out: Column[] = [];
    for (let i = 0; i < 46; i++) {
      const len = 8 + Math.floor(random(`len${i}`) * 12);
      let chars = "";
      for (let k = 0; k < len; k++) chars += HEX[Math.floor(random(`c${i}-${k}`) * 16)];
      out.push({
        x: random(`x${i}`) * W,
        speed: 0.6 + random(`s${i}`) * 1.4,
        offset: random(`o${i}`) * (H + 600),
        chars,
        size: 14 + Math.floor(random(`z${i}`) * 8),
        alpha: 0.05 + random(`a${i}`) * 0.08,
      });
    }
    return out;
  }, []);

  return (
    <AbsoluteFill style={{ background: C.bg, overflow: "hidden" }}>
      <AbsoluteFill
        style={{
          backgroundImage: `linear-gradient(${C.lineSoft} 1px, transparent 1px), linear-gradient(90deg, ${C.lineSoft} 1px, transparent 1px)`,
          backgroundSize: "96px 96px",
          opacity: 0.35,
          transform: `translateY(${(frame * 0.15) % 96}px)`,
        }}
      />
      {columns.map((col, i) => {
        const span = H + col.chars.length * col.size * 1.2;
        const y = ((frame * col.speed + col.offset) % span) - col.chars.length * col.size * 1.2;
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: col.x,
              top: y,
              fontFamily: FONT.mono,
              fontSize: col.size,
              lineHeight: 1.2,
              color: C.brass,
              opacity: col.alpha,
              whiteSpace: "pre",
              writingMode: "vertical-rl",
              textOrientation: "upright",
              letterSpacing: "0.1em",
            }}
          >
            {col.chars}
          </div>
        );
      })}
      <AbsoluteFill
        style={{
          background: `radial-gradient(ellipse at 50% 45%, rgba(11,11,14,0) 35%, rgba(11,11,14,0.85) 100%)`,
        }}
      />
    </AbsoluteFill>
  );
};
