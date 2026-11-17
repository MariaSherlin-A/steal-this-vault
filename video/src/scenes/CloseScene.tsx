import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { C, FONT } from "../theme";
import data from "../data.json";
import { Key } from "../components/Glyphs";
import { Typewriter } from "../components/Typewriter";
import { clamp, rise } from "../components/anim";

/** Scene 8. The key, the tagline, the addresses. */
export const CloseScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { durationInFrames: T } = useVideoConfig();
  const line1At = Math.round(T * 0.22);
  const line2At = Math.round(T * 0.46);
  const linksAt = Math.round(T * 0.72);
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
      <div style={{ opacity: interpolate(frame, [0, 14], [0, 1], clamp), marginBottom: 40 }}>
        <Key size={52} glow />
      </div>
      <div style={{ fontFamily: FONT.serif, fontSize: 44, color: C.muted, ...rise(frame, 6) }}>Steal This Vault</div>
      <div style={{ fontFamily: FONT.serif, fontSize: 110, color: C.text, lineHeight: 1.15, textAlign: "center", marginTop: 20 }}>
        <div>
          <Typewriter text="The key is free." from={line1At} cps={18} cursor={false} />
        </div>
        <div style={{ color: C.brass }}>
          <Typewriter text="The money isn't." from={line2At} cps={18} cursor={false} />
        </div>
      </div>
      <div style={{ marginTop: 60, display: "flex", gap: 60, fontFamily: FONT.mono, fontSize: 28, color: C.muted, letterSpacing: "0.04em", ...rise(frame, linksAt) }}>
        <span>{data.site}</span>
        <span style={{ color: C.faint }}>·</span>
        <span>{data.repo}</span>
      </div>
      <div style={{ position: "absolute", bottom: 60, fontFamily: FONT.mono, fontSize: 18, color: C.faint, letterSpacing: "0.1em", ...rise(frame, linksAt + 10) }}>
        QORECHAIN TESTNET · BUILD BEFORE Q-DAY · MIT
      </div>
    </AbsoluteFill>
  );
};
