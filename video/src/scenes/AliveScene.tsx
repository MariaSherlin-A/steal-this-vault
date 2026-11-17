import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { C, FONT } from "../theme";
import { Stamp } from "../components/Stamp";
import { Padlock } from "../components/Glyphs";
import { rise } from "../components/anim";

const CARDS = [
  { title: "Keeper", text: "renews the window on a schedule and proves the vault is alive with a real withdrawal" },
  { title: "Drill mode", text: "empties the control vault and shuts the door for the fest's Q-Day drill; nothing left to take" },
  { title: "Tests", text: "contracts run against a real ML-DSA-87 implementation at the precompile addresses" },
  { title: "Audited twice", text: "QCAI AI Security Auditor, two stages, every finding assessed in the repository" },
];

/** Scene 7. The vault pays its owner; then the four things that keep it honest. */
export const AliveScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { durationInFrames: T } = useVideoConfig();
  const paidAt = Math.round(T * 0.16);
  const cardsAt = Math.round(T * 0.46);
  return (
    <AbsoluteFill style={{ padding: "90px 100px" }}>
      <div style={{ fontFamily: FONT.serif, fontSize: 60, color: C.text, ...rise(frame, 4) }}>A vault that refuses everyone is just a hole.</div>
      <div style={{ marginTop: 50, display: "flex", alignItems: "center", gap: 36, border: `1px solid ${C.mintDeep}`, borderRadius: 16, background: C.panel, padding: "30px 40px", ...rise(frame, paidAt - 12, 14) }}>
        <div style={{ display: "flex", gap: 10 }}>
          <Padlock size={46} color={C.mint} open={1} glow />
          <Padlock size={46} color={C.mint} open={1} glow />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: FONT.sans, fontSize: 34, color: C.text, fontWeight: 500 }}>Paid out to the owner, who signed with both keys.</div>
          <div style={{ fontFamily: FONT.mono, fontSize: 20, color: C.muted, marginTop: 6, letterSpacing: "0.04em" }}>withdraw · hybrid vault · both signatures checked on chain</div>
        </div>
        <Stamp text="Paid" tone="mint" at={paidAt} size={30} tilt={-5} />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 28, marginTop: 44 }}>
        {CARDS.map((c, i) => (
          <div key={i} style={{ border: `1px solid ${C.line}`, borderRadius: 16, background: C.panel, padding: "28px 34px", ...rise(frame, cardsAt + i * 9, 16, 24) }}>
            <div style={{ fontFamily: FONT.serif, fontSize: 44, color: C.brass }}>{c.title}</div>
            <div style={{ fontFamily: FONT.sans, fontSize: 26, color: C.muted, marginTop: 10, lineHeight: 1.35 }}>{c.text}</div>
          </div>
        ))}
      </div>
    </AbsoluteFill>
  );
};
