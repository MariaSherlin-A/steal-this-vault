import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { C, FONT } from "../theme";
import data from "../data.json";
import { Typewriter } from "../components/Typewriter";
import { Key } from "../components/Glyphs";
import { clamp, rise } from "../components/anim";

/** Scene 1. A line is typed, then the real published key appears alone. */
export const KeyScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { durationInFrames: T, fps } = useVideoConfig();
  const keyAt = Math.round(T * 0.42);
  const pulse = 0.75 + 0.25 * Math.sin((frame - keyAt) / 9);
  const keyOpacity = interpolate(frame, [keyAt, keyAt + fps * 0.8], [0, 1], clamp);
  const publicAt = Math.round(T * 0.72);
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", padding: 120 }}>
      <div style={{ fontFamily: FONT.serif, fontSize: 64, color: C.text, textAlign: "center", lineHeight: 1.2 }}>
        <Typewriter text="This is a private key." from={Math.round(T * 0.06)} cps={20} />
      </div>
      <div
        style={{
          marginTop: 56,
          display: "flex",
          alignItems: "center",
          gap: 28,
          opacity: keyOpacity,
          transform: `scale(${interpolate(keyOpacity, [0, 1], [0.96, 1])})`,
        }}
      >
        <Key size={34} glow />
        <div
          style={{
            fontFamily: FONT.mono,
            fontSize: 36,
            color: C.brass,
            letterSpacing: "0.02em",
            textShadow: `0 0 ${18 * pulse}px ${C.brass}88`,
          }}
        >
          {data.owner.publishedKey}
        </div>
      </div>
      <div
        style={{
          marginTop: 48,
          fontFamily: FONT.sans,
          fontSize: 30,
          color: C.muted,
          textAlign: "center",
          ...rise(frame, publicAt),
        }}
      >
        It controls a vault with real coins in it. And it is public. We put it there.
      </div>
    </AbsoluteFill>
  );
};
