import React from "react";
import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { C, FONT } from "../theme";
import { clamp } from "./anim";

export type Tone = "red" | "brass" | "mint";

export const TONE: Record<Tone, string> = { red: C.red, brass: C.brass, mint: C.mint };

/** A rubber stamp that slams onto the frame at `at`. */
export const Stamp: React.FC<{ text: string; tone: Tone; at: number; size?: number; tilt?: number }> = ({
  text,
  tone,
  at,
  size = 40,
  tilt = -6,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  if (frame < at) return null;
  const s = spring({ frame: frame - at, fps, config: { damping: 13, stiffness: 280, mass: 0.6 } });
  const scale = interpolate(s, [0, 1], [2.4, 1]);
  const opacity = interpolate(s, [0, 0.35], [0, 1], clamp);
  const color = TONE[tone];
  return (
    <div
      style={{
        display: "inline-block",
        padding: `${size * 0.1}px ${size * 0.4}px`,
        border: `${Math.max(2, size * 0.075)}px solid ${color}`,
        color,
        fontFamily: FONT.mono,
        fontWeight: 500,
        fontSize: size,
        lineHeight: 1.1,
        letterSpacing: "0.14em",
        textTransform: "uppercase",
        borderRadius: size * 0.16,
        transform: `rotate(${tilt}deg) scale(${scale})`,
        opacity,
        boxShadow: `0 0 ${size}px ${color}44`,
        background: "rgba(11,11,14,0.6)",
        whiteSpace: "nowrap",
      }}
    >
      {text}
    </div>
  );
};
