/** Scene 11: the close. The takeaway as a poster, then the name, the tagline, and the credits. */
import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { C, Corners, F, PosterLines, clamp, easeInOut, micro, posterStyle, rise } from "./kit";
import { cue } from "./timing";

const at = {
  answer: cue("close", /^answer$/),
  steal: cue("close", /^Steal$/),
  key: cue("close", /^key$/),
  money: cue("close", /^money$/),
};

function Logo({ size = 150 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32">
      <rect x={1.5} y={1.5} width={29} height={29} fill="none" stroke={C.paper} strokeWidth={2.2} />
      <rect x={6} y={6} width={20} height={20} fill={C.violet} />
      <circle cx={16} cy={12.6} r={2.6} fill={C.paper} />
      <path d="M14.7 14.2h2.6l.9 6h-4.4z" fill={C.paper} />
      <rect x={22.5} y={22.5} width={3.5} height={3.5} fill={C.mint} />
    </svg>
  );
}

export function Close() {
  const frame = useCurrentFrame();
  const posterOut = interpolate(frame, [at.steal - 16, at.steal], [0, 1], { ...clamp, easing: easeInOut });
  const brand = rise(frame, at.steal - 6, 24);
  return (
    <AbsoluteFill style={{ background: C.ink }}>
      <AbsoluteFill style={{ justifyContent: "center", paddingLeft: 140, opacity: 1 - posterOut, transform: `translateY(${-posterOut * 60}px)` }}>
        <PosterLines at={2} size={160} color={C.paper} lines={[{ text: "Keys will leak." }]} />
        <div style={{ height: 34 }} />
        {frame >= at.answer - 8 ? <PosterLines at={at.answer - 6} size={160} color={C.paper} accent={C.mint} lines={[{ text: "Add a second", accent: true }, { text: "lock.", accent: true }]} /> : null}
      </AbsoluteFill>

      <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", opacity: brand }}>
        <Corners inset={70} color={C.paper} opacity={0.6} />
        <div style={{ display: "flex", alignItems: "center", gap: 44, transform: `scale(${0.92 + 0.08 * brand})` }}>
          <Logo size={140} />
          <span style={{ ...posterStyle(124, C.paper), letterSpacing: "-0.04em", whiteSpace: "nowrap" }}>Steal This Vault</span>
        </div>
        <div style={{ marginTop: 56, display: "flex", gap: 26, alignItems: "baseline" }}>
          <span style={{ ...posterStyle(64, C.paper), opacity: rise(frame, at.key - 4, 16) }}>The key is free.</span>
          <span style={{ ...posterStyle(64, C.mint), opacity: rise(frame, at.money - 6, 16) }}>The money isn&rsquo;t.</span>
        </div>
        <div style={{ marginTop: 70, display: "flex", gap: 34, opacity: rise(frame, at.money + 20, 20) }}>
          <span style={micro(C.violetTint, 22)}>Built on QoreChain</span>
          <span style={micro("rgba(236,231,220,0.6)", 22)}>Build Before Q-Day · QoreChain Developer Fest</span>
          <span style={micro("rgba(236,231,220,0.6)", 22)}>github.com/MariaSherlin-A/steal-this-vault</span>
        </div>
        <p style={{ position: "absolute", bottom: 120, fontFamily: F.mono, fontSize: 15, letterSpacing: "0.08em", color: "rgba(236,231,220,0.45)", opacity: rise(frame, at.money + 30, 20), textAlign: "center" }}>
          Testnet only · site recorded live · photo: IBM Research, CC BY 2.0 · statistic: Chainalysis via The Block · voice: Microsoft Edge neural voice · music: original, made in code
        </p>
      </AbsoluteFill>
    </AbsoluteFill>
  );
}
