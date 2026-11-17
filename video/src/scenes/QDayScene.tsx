import React from "react";
import { AbsoluteFill, interpolate, random, useCurrentFrame, useVideoConfig } from "remotion";
import { C, FONT, H, W } from "../theme";
import { Key, Padlock } from "../components/Glyphs";
import { clamp, rise } from "../components/anim";

const COLS = 18;
const ROWS = 8;

/** Scene 2. A field of keys turns red in a wave as a lock cracks and Q-DAY lands. */
export const QDayScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { durationInFrames: T } = useVideoConfig();
  const waveStart = Math.round(T * 0.38);
  const waveLen = Math.round(T * 0.3);
  const titleAt = Math.round(T * 0.5);
  const lastAt = Math.round(T * 0.76);
  const crack = interpolate(frame, [waveStart - 12, waveStart + 10], [0, 1], clamp);

  return (
    <AbsoluteFill>
      {Array.from({ length: COLS * ROWS }, (_, i) => {
        const col = i % COLS;
        const row = Math.floor(i / COLS);
        const x = ((col + 0.5) / COLS) * W + (random(`kx${i}`) - 0.5) * 30;
        const y = ((row + 0.5) / ROWS) * H + (random(`ky${i}`) - 0.5) * 30;
        const turnAt = waveStart + (col / COLS) * waveLen + random(`kt${i}`) * 12;
        const red = interpolate(frame, [turnAt, turnAt + 10], [0, 1], clamp);
        const appear = interpolate(frame, [row * 3 + col * 2, row * 3 + col * 2 + 14], [0, 1], clamp);
        const color = red > 0.5 ? C.red : C.brassDeep;
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: x - 30,
              top: y - 15,
              opacity: appear * (0.35 + red * 0.5),
              transform: `rotate(${(random(`kr${i}`) - 0.5) * 40}deg) scale(${1 + red * 0.15})`,
            }}
          >
            <Key size={30} color={color} glow={red > 0.5} />
          </div>
        );
      })}
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
        <div style={{ position: "relative", opacity: interpolate(frame, [0, 12], [0, 1], clamp) }}>
          <Padlock size={150} color={crack > 0.5 ? C.red : C.brass} glow />
          <svg width={150} height={180} viewBox="0 0 40 48" style={{ position: "absolute", inset: 0 }}>
            <path
              d="M20 22 l-3 6 l5 4 l-4 7 l3 5"
              fill="none"
              stroke={C.bg}
              strokeWidth={2.2}
              strokeLinecap="round"
              strokeDasharray={40}
              strokeDashoffset={40 - crack * 40}
            />
          </svg>
        </div>
        <div
          style={{
            marginTop: 30,
            fontFamily: FONT.serif,
            fontSize: 150,
            letterSpacing: "0.08em",
            color: C.text,
            textShadow: `0 0 40px ${C.red}55`,
            ...rise(frame, titleAt, 20, 40),
          }}
        >
          Q-DAY
        </div>
        <div style={{ fontFamily: FONT.sans, fontSize: 32, color: C.muted, ...rise(frame, titleAt + 16) }}>
          The day a quantum computer arrives, keys like this stop being secret.
        </div>
        <div style={{ marginTop: 18, fontFamily: FONT.serif, fontSize: 44, color: C.red, ...rise(frame, lastAt) }}>
          A stolen key is not a bug. It is every key.
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
