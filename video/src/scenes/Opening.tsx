/** Scenes 1 to 3: the incident, the threat, the title. */
import React from "react";
import { AbsoluteFill, interpolate, random, useCurrentFrame, useVideoConfig } from "remotion";
import { clamp, ease, fadeIn, rise } from "../components/anim";
import { Backdrop, Card, Eyebrow, Glitch, KeyGlyph, LockGlyph, Logo } from "../components/kit";
import { C, FONT, alpha } from "../theme";

// ---------------------------------------------------------------- 1. incident

export const IncidentScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { durationInFrames: d } = useVideoConfig();
  const drainAt = Math.round(d * 0.4);
  const drainEnd = Math.round(d * 0.6);
  const balance = interpolate(frame, [drainAt, drainEnd], [48210.55, 0], { ...clamp, easing: ease });
  const drained = frame >= drainEnd;
  const flash = interpolate(frame, [drainEnd, drainEnd + 4, drainEnd + 16], [0, 0.35, 0], clamp);
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

// ---------------------------------------------------------------- 2. threat

const HEX = "02a7f3c91e5b8d4460fe2c7a19b03d58e6f14a92c07be35d1f88a6034c9e27b1d5";

export const ThreatScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { durationInFrames: d } = useVideoConfig();
  const qAt = Math.round(d * 0.3);
  const crackAt = Math.round(d * 0.52);
  const dayAt = Math.round(d * 0.58);
  const crack = interpolate(frame, [crackAt, crackAt + 14], [0, 1], { ...clamp, easing: ease });
  const strike = (at: number) => interpolate(frame, [at + 14, at + 26], [0, 100], clamp);
  return (
    <AbsoluteFill>
      <Backdrop tone={frame > crackAt ? "red" : "blue"} />
      <div style={{ position: "absolute", left: 120, top: 200, display: "grid", gap: 18 }}>
        {[
          ["Phishing", 6],
          ["Malware", Math.round(d * 0.12)],
        ].map(([label, at]) => (
          <div key={label as string} style={{ position: "relative", font: `700 76px ${FONT.display}`, color: C.faint, ...rise(frame, at as number, 14) }}>
            {label}
            <span style={{ position: "absolute", left: 0, top: "52%", height: 6, width: `${strike(at as number)}%`, background: C.muted }} />
          </div>
        ))}
        <div style={{ font: `700 76px ${FONT.display}`, ...rise(frame, qAt, 18) }}>
          <span style={{ background: `linear-gradient(90deg, ${C.primary}, ${C.safe})`, WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent" }}>Quantum computers.</span>
        </div>
      </div>

      {/* the public key under attack */}
      <div style={{ position: "absolute", right: 140, top: 190, width: 660, ...rise(frame, qAt + 6, 18) }}>
        <Eyebrow color={C.muted}>Public key · on chain for everyone</Eyebrow>
        <div style={{ marginTop: 16, font: `500 30px/1.5 ${FONT.mono}`, color: C.muted, wordBreak: "break-all" }}>
          {HEX.split("").map((ch, i) => {
            const solved = frame > qAt + 20 + i * 1.6;
            return (
              <span key={i} style={{ color: solved ? C.red : C.muted, textShadow: solved ? `0 0 12px ${alpha(C.red, 0.7)}` : undefined }}>
                {solved && frame < crackAt ? "0123456789abcdef"[Math.floor(random(`h${i}${Math.floor(frame / 3)}`) * 16)] : ch}
              </span>
            );
          })}
        </div>
        <div style={{ marginTop: 34, display: "flex", alignItems: "center", gap: 24 }}>
          <div style={{ position: "relative", width: 120, height: 120 }}>
            <div style={{ position: "absolute", inset: 0, clipPath: "inset(0 50% 0 0)", transform: `translate(${-30 * crack}px, ${20 * crack}px) rotate(${-14 * crack}deg)` }}>
              <LockGlyph size={120} color={frame > crackAt ? C.red : C.text} />
            </div>
            <div style={{ position: "absolute", inset: 0, clipPath: "inset(0 0 0 50%)", transform: `translate(${30 * crack}px, ${26 * crack}px) rotate(${16 * crack}deg)` }}>
              <LockGlyph size={120} color={frame > crackAt ? C.red : C.text} />
            </div>
          </div>
          <div style={{ font: `600 30px ${FONT.display}`, color: frame > crackAt ? C.red : C.text }}>
            {frame > crackAt ? (
              <span style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <KeyGlyph size={36} color={C.red} /> Private key derived
              </span>
            ) : (
              "Today's signatures (ECDSA)"
            )}
          </div>
        </div>
      </div>

      <div style={{ position: "absolute", left: 0, right: 0, top: 640, textAlign: "center" }}>
        <Glitch at={dayAt} color={C.text} style={{ font: `700 190px/1 ${FONT.display}`, letterSpacing: "-0.04em", textShadow: `0 0 60px ${alpha(C.red, 0.5)}` }}>
          Q-DAY
        </Glitch>
        <div style={{ marginTop: 14, font: `500 34px ${FONT.sans}`, color: C.muted, ...rise(frame, dayAt + 18, 16) }}>Every exposed wallet becomes a leaked key.</div>
      </div>
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------- 3. title

export const TitleScene: React.FC = () => {
  const frame = useCurrentFrame();
  const draw = interpolate(frame, [4, 40], [0, 1], { ...clamp, easing: ease });
  const sweep = interpolate(frame, [40, 90], [-30, 130], clamp);
  return (
    <AbsoluteFill>
      <Backdrop density={0.8} />
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 40 }}>
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
