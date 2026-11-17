import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { C, FONT } from "../theme";
import data from "../data.json";
import { countUp, fadeIn, rise } from "../components/anim";

const BLOCKS = 16;

function fmt(n: number, decimals: number): string {
  return n.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

/** Scene 5. A chain of blocks slides past; the real figures count up, dated. */
export const RecordScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { durationInFrames: T } = useVideoConfig();
  const tilesAt = Math.round(T * 0.22);
  const countLen = Math.round(T * 0.35);
  const tiles = [
    { label: "the two-lock vault holds", value: Number(data.hybrid.holdsQor), decimals: 3, unit: "QOR", tone: C.mint },
    { label: `it would have lost, over ${data.hybrid.wouldHaveLostAttempts} attempts the second lock stopped`, value: Number(data.hybrid.wouldHaveLostQor), decimals: 3, unit: "QOR", tone: C.red },
    { label: "attempts it refused and counted", value: data.hybrid.refusedAttempts, decimals: 0, unit: "", tone: C.text },
    { label: "times the one-lock vault paid a thief", value: data.control.robbedTimes, decimals: 0, unit: "", tone: C.brass },
  ];
  return (
    <AbsoluteFill style={{ padding: "90px 100px" }}>
      <div style={{ fontFamily: FONT.serif, fontSize: 60, color: C.text, ...rise(frame, 4) }}>The record is public.</div>
      <div style={{ position: "relative", height: 110, marginTop: 36, overflow: "hidden", opacity: fadeIn(frame, 10, 16) }}>
        <div style={{ position: "absolute", top: 54, left: 0, right: 0, height: 2, background: C.line }} />
        {Array.from({ length: BLOCKS }, (_, i) => {
          // the newest block sits at the right edge and the strip eases in from the right; no number goes past the one read
          const spacing = 150;
          const slide = interpolate(frame, [0, Math.round(T * 0.45)], [420, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
          const x = 1720 - (BLOCKS - 1 - i) * spacing + slide;
          const n = data.block - (BLOCKS - 1 - i);
          return (
            <div key={i} style={{ position: "absolute", left: x, top: 16, width: 120, height: 76, border: `1.5px solid ${C.brassDeep}`, borderRadius: 10, background: C.panel, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 4, opacity: fadeIn(frame, 10 + (BLOCKS - 1 - i) * 3, 12) }}>
              <div style={{ fontFamily: FONT.mono, fontSize: 13, color: C.faint, letterSpacing: "0.1em" }}>BLOCK</div>
              <div style={{ fontFamily: FONT.mono, fontSize: 18, color: C.brass }}>{n.toLocaleString("en-US")}</div>
            </div>
          );
        })}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 28, marginTop: 40 }}>
        {tiles.map((t, i) => {
          const at = tilesAt + i * 10;
          const v = countUp(frame, at, countLen, t.value);
          return (
            <div key={i} style={{ border: `1px solid ${C.line}`, borderRadius: 16, background: C.panel, padding: "30px 36px", ...rise(frame, at, 16, 24) }}>
              <div style={{ fontFamily: FONT.serif, fontSize: 84, color: t.tone, lineHeight: 1 }}>
                {fmt(v, t.decimals)}
                {t.unit ? <span style={{ fontSize: 36, color: C.muted, marginLeft: 14 }}>{t.unit}</span> : null}
              </div>
              <div style={{ fontFamily: FONT.sans, fontSize: 26, color: C.muted, marginTop: 14 }}>{t.label}</div>
            </div>
          );
        })}
      </div>
      <div style={{ position: "absolute", left: 100, bottom: 60, fontFamily: FONT.mono, fontSize: 20, color: C.faint, letterSpacing: "0.06em", opacity: fadeIn(frame, tilesAt + 30, 16) }}>
        read from the chain at block {data.block.toLocaleString("en-US")} on {data.asOf} · live figures on the site · every attempt on the explorer
      </div>
      <div style={{ position: "absolute", left: 100, bottom: 112, fontFamily: FONT.sans, fontSize: 28, color: C.muted, opacity: interpolate(frame, [tilesAt + 40, tilesAt + 56], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }) }}>
        Run the attacks yourself, from the site or the command line.
      </div>
    </AbsoluteFill>
  );
};
