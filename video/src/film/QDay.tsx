/**
 * Scene 2: Q-Day. A real quantum computer (photo: IBM Research, CC BY 2.0), then public data
 * on the ledger turning into stolen keys, one after another, then the poster.
 */
import React from "react";
import { AbsoluteFill, Img, interpolate, staticFile, useCurrentFrame } from "remotion";
import { C, F, PosterLines, clamp, easeInOut, micro, rise } from "./kit";
import { cue } from "./timing";

const at = {
  quantum: cue("qday", /^quantum$/),
  publicW: cue("qday", /^public\.$/),
  name: cue("qday", /^Q-Day\.$/),
  every: cue("qday", /^every$/),
};

function KeyIcon({ size = 44, color = C.carmine }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48">
      <circle cx={14} cy={24} r={10} fill="none" stroke={color} strokeWidth={5} />
      <path d="M24 24 H44 M36 24 V32 M42 24 V30" stroke={color} strokeWidth={5} fill="none" />
    </svg>
  );
}

export function QDay() {
  const frame = useCurrentFrame();
  const photo = interpolate(frame, [0, at.publicW], [1.04, 1.16]);
  const photoOut = interpolate(frame, [at.publicW - 30, at.publicW], [1, 0], { ...clamp, easing: easeInOut });
  const crack = interpolate(frame, [at.publicW - 20, at.name - 10], [0, 1], clamp);
  const poster = frame >= at.name - 6;
  const flash = interpolate(frame, [at.name - 4, at.name, at.name + 14], [0, 0.9, 0], clamp);

  const rows = 9;
  const cols = 6;
  return (
    <AbsoluteFill style={{ background: C.ink }}>
      {/* the quantum computer, tinted into the palette */}
      <AbsoluteFill style={{ opacity: photoOut }}>
        <Img src={staticFile("images/ibm-q-system-one.jpg")} style={{ width: "100%", height: "100%", objectFit: "cover", transform: `scale(${photo})`, filter: "grayscale(1) contrast(1.15) brightness(0.8)" }} />
        <AbsoluteFill style={{ background: C.violet, mixBlendMode: "color", opacity: 0.55 }} />
        <AbsoluteFill style={{ background: "linear-gradient(90deg, rgba(20,19,17,0.85) 0%, rgba(20,19,17,0.2) 60%)" }} />
        <div style={{ position: "absolute", left: 120, top: 360, width: 900 }}>
          <span style={{ ...micro(C.violetTint, 24), fontWeight: 700, opacity: rise(frame, at.quantum - 10, 18) }}>A real quantum computer</span>
          <div style={{ marginTop: 22 }}>
            <PosterLines at={at.quantum} size={104} color={C.paper} accent={C.violetTint} lines={[{ text: "Works out" }, { text: "private keys", accent: true }, { text: "from public data." }]} />
          </div>
        </div>
        <span style={{ ...micro("rgba(236,231,220,0.55)", 15), position: "absolute", right: 40, bottom: 130 }}>
          Photo: IBM Quantum System One · IBM Research · CC BY 2.0
        </span>
      </AbsoluteFill>

      {/* public data turning into keys */}
      <AbsoluteFill style={{ opacity: crack > 0 && !poster ? 1 : 0, justifyContent: "center", alignItems: "center" }}>
        <div style={{ ...micro(C.mint, 22), fontWeight: 700, position: "absolute", top: 140, left: 120 }}>Already public on the chain</div>
        <div style={{ display: "grid", gridTemplateColumns: `repeat(${cols}, 250px)`, gap: "22px 26px" }}>
          {Array.from({ length: rows * cols }, (_, i) => {
            const turn = crack * rows * cols > ((i * 17) % (rows * cols));
            return (
              <div key={i} style={{ height: 44, display: "flex", alignItems: "center", gap: 10 }}>
                {turn ? (
                  <>
                    <KeyIcon size={40} />
                    <span style={{ fontFamily: F.mono, fontSize: 18, color: C.carmineTint }}>key found</span>
                  </>
                ) : (
                  <span style={{ fontFamily: F.mono, fontSize: 18, color: "rgba(236,231,220,0.45)" }}>
                    0x{((i * 2654435761) >>> 0).toString(16).slice(0, 10)}…
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </AbsoluteFill>

      {/* the poster */}
      {poster ? (
        <AbsoluteFill style={{ background: C.ink, justifyContent: "center", paddingLeft: 140 }}>
          <span style={{ ...micro(C.carmineTint, 26), fontWeight: 700, marginBottom: 24 }}>The day every ordinary key leaks</span>
          <PosterLines at={at.name - 4} size={330} color={C.paper} lines={[{ text: "Q-Day." }]} />
          <div style={{ marginTop: 40, opacity: rise(frame, at.every, 18), display: "flex", gap: 18, flexWrap: "wrap", maxWidth: 1500 }}>
            {Array.from({ length: 14 }, (_, i) => (
              <div key={i} style={{ opacity: rise(frame, at.every + i * 3, 10) }}>
                <KeyIcon size={70} />
              </div>
            ))}
          </div>
        </AbsoluteFill>
      ) : null}
      <AbsoluteFill style={{ background: C.carmine, opacity: flash, mixBlendMode: "screen", pointerEvents: "none" }} />
    </AbsoluteFill>
  );
}
