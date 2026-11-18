/** The drain (a leaked key empties a wallet) and the title. */
import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { clamp, ease, fadeIn, rise } from "../components/anim";
import { Backdrop, Card, Eyebrow, Glitch, Logo, Statement } from "../components/kit";
import { C, FONT } from "../theme";

// ---------------------------------------------------------------- 1. incident

export const IncidentScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { durationInFrames: d } = useVideoConfig();
  const drainAt = Math.round(d * 0.4);
  const drainEnd = Math.round(d * 0.6);
  const balance = interpolate(frame, [drainAt, drainEnd], [48210.55, 0], { ...clamp, easing: ease });
  const drained = frame >= drainEnd;
  const flash = interpolate(frame, [drainEnd, drainEnd + 4, drainEnd + 16], [0, 0.22, 0], clamp);
  const typed = "transfer 48,210.55 → 0x9e1d…c07a";
  const shown = typed.slice(0, Math.max(0, Math.floor((frame - d * 0.25) / 1.2)));
  return (
    <AbsoluteFill>
      <Backdrop tone="red" density={0.6} />
      <div style={{ position: "absolute", left: 120, top: 96, display: "flex", gap: 14, alignItems: "center", opacity: fadeIn(frame, 0, 8) }}>
        <span style={{ width: 12, height: 12, borderRadius: 6, background: C.red, boxShadow: `0 0 16px ${C.red}`, opacity: frame % 30 < 18 ? 1 : 0.3 }} />
        <Eyebrow color={C.red}>Incident · any chain · any day · dramatization</Eyebrow>
      </div>
      <div style={{ position: "absolute", left: 120, top: 300, width: 900 }}>
        <Glitch at={8} style={{ font: `700 116px/1 ${FONT.display}`, letterSpacing: "-0.03em" }}>
          ONE LEAKED KEY.
        </Glitch>
        <Glitch at={drainEnd - 4} color={C.red} style={{ font: `700 116px/1 ${FONT.display}`, letterSpacing: "-0.03em", marginTop: 24 }}>
          THE MONEY IS GONE.
        </Glitch>
      </div>
      <div style={{ position: "absolute", right: 120, top: 270, ...rise(frame, 14, 20) }}>
        <Card glow={drained ? C.red : C.line} style={{ width: 620, padding: 40 }}>
          <Eyebrow color={C.muted}>Wallet 0x7f3a…91c2</Eyebrow>
          <div style={{ font: `700 92px ${FONT.display}`, marginTop: 18, color: drained ? C.red : C.text, letterSpacing: "-0.02em" }}>
            ${balance.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div style={{ marginTop: 28, padding: "18px 20px", borderRadius: 12, background: C.bg, border: `1px solid ${C.lineSoft}`, font: `500 22px ${FONT.mono}`, color: C.muted, minHeight: 92 }}>
            <div style={{ color: C.red }}>{shown}</div>
            {frame > drainAt ? <div style={{ marginTop: 8, color: C.faint }}>signature: valid · key: leaked</div> : null}
          </div>
        </Card>
      </div>
      <AbsoluteFill style={{ background: C.red, opacity: flash, mixBlendMode: "screen" }} />
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------- 3. title

const LEAD = 66;

export const TitleScene: React.FC = () => {
  const whole = useCurrentFrame();
  const frame = whole - LEAD;
  const draw = interpolate(frame, [4, 40], [0, 1], { ...clamp, easing: ease });
  const sweep = interpolate(frame, [40, 90], [-30, 130], clamp);
  return (
    <AbsoluteFill>
      <Backdrop density={0.8} />
      <div style={{ opacity: interpolate(whole, [LEAD - 12, LEAD], [1, 0], clamp) }}>
        <Statement at={6} top={460} lines={["So we built a vault that survives it."]} size={80} />
      </div>
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 40, opacity: frame < 0 ? 0 : 1 }}>
        <div style={{ transform: `scale(${interpolate(frame, [0, 40], [0.8, 1], { ...clamp, easing: ease })})` }}>
          <Logo size={230} draw={draw} />
        </div>
        <div style={{ position: "relative", font: `700 132px ${FONT.display}`, letterSpacing: "-0.035em", ...rise(frame, 26, 20) }}>
          Steal This{" "}
          <span style={{ background: `linear-gradient(95deg, ${C.primary}, ${C.safe})`, WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent" }}>Vault</span>
          <span
            style={{
              position: "absolute",
              inset: 0,
              background: `linear-gradient(100deg, transparent ${sweep - 12}%, rgba(255,255,255,0.35) ${sweep}%, transparent ${sweep + 12}%)`,
              mixBlendMode: "overlay",
            }}
          />
        </div>
        <div style={{ font: `500 38px ${FONT.sans}`, color: C.muted, ...rise(frame, 44, 18) }}>
          The private key is public. <span style={{ color: C.safe }}>The money stays.</span>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
