import React from "react";
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { C, FONT } from "../theme";
import { Vault } from "../components/Vault";
import { Key } from "../components/Glyphs";
import { clamp, rise } from "../components/anim";

/** Scene 3. Two vaults, same owner. The second lock lights up, then the key drops in. */
export const VaultsScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { durationInFrames: T, fps } = useVideoConfig();
  const leftAt = Math.round(T * 0.1);
  const rightAt = Math.round(T * 0.3);
  const glowAt = Math.round(T * 0.5);
  const keyAt = Math.round(T * 0.8);
  const drop = spring({ frame: frame - keyAt, fps, config: { damping: 9, stiffness: 120, mass: 0.9 } });
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
      <div style={{ position: "absolute", top: 110, fontFamily: FONT.serif, fontSize: 60, color: C.text, ...rise(frame, 4) }}>
        Same owner. Same leaked key. Two vaults.
      </div>
      <div style={{ display: "flex", gap: 360, alignItems: "flex-start", marginTop: 60 }}>
        <div style={rise(frame, leftAt, 20, 40)}>
          <Vault size={340} locks={1} label="One lock" sublabel="checks the classical signature" />
        </div>
        <div style={rise(frame, rightAt, 20, 40)}>
          <Vault size={340} locks={2} glowSecond={frame >= glowAt} label="Two locks" sublabel={frame >= glowAt ? "and ML-DSA-87, checked on chain" : "checks the classical signature"} />
        </div>
      </div>
      <div
        style={{
          position: "absolute",
          top: 430 + interpolate(drop, [0, 1], [-520, 0]),
          opacity: frame >= keyAt ? 1 : 0,
          transform: `rotate(${interpolate(drop, [0, 1], [-40, 8])}deg)`,
        }}
      >
        <Key size={70} glow />
      </div>
      <div
        style={{
          position: "absolute",
          bottom: 110,
          fontFamily: FONT.sans,
          fontSize: 32,
          color: C.muted,
          ...rise(frame, keyAt + 14),
        }}
      >
        And then we handed out the key.
      </div>
      <div style={{ position: "absolute", bottom: 60, fontFamily: FONT.mono, fontSize: 20, color: C.faint, letterSpacing: "0.1em", opacity: interpolate(frame, [leftAt, leftAt + 20], [0, 1], clamp) }}>
        QORECHAIN TESTNET · CHAIN 9800
      </div>
    </AbsoluteFill>
  );
};
