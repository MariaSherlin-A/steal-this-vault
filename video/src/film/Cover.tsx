/**
 * The project's cover image (16:9), in the site's Paper & Ink look: the hero's poster line,
 * the published key on its slip, and the experiment's result in two tags.
 *   npx remotion still src/index.ts Cover ../docs/cover.png
 */
import React from "react";
import { AbsoluteFill } from "remotion";
import { PUBLISHED_KEY } from "../../../core/src/published";
import { C, Corners, F, micro, posterStyle, useFonts } from "./kit";

function Logo({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32">
      <rect x={1.5} y={1.5} width={29} height={29} fill="none" stroke={C.ink} strokeWidth={2.2} />
      <rect x={6} y={6} width={20} height={20} fill={C.violet} />
      <circle cx={16} cy={12.6} r={2.6} fill={C.paper} />
      <path d="M14.7 14.2h2.6l.9 6h-4.4z" fill={C.paper} />
      <rect x={22.5} y={22.5} width={3.5} height={3.5} fill={C.mint} />
    </svg>
  );
}

function Tag({ text, color }: { text: string; color: string }) {
  return (
    <span style={{ ...micro(C.paper, 22), fontWeight: 700, background: color, padding: "12px 18px", color: color === C.mint ? C.ink : C.paper }}>
      {text}
    </span>
  );
}

export function Cover() {
  useFonts();
  const groups = PUBLISHED_KEY.slice(2).match(/.{4}/g) ?? [];
  return (
    <AbsoluteFill style={{ background: C.paper, color: C.ink }}>
      <Corners inset={44} size={44} color={C.ink} width={3} />

      {/* brand */}
      <div style={{ position: "absolute", left: 110, top: 96, display: "flex", alignItems: "center", gap: 22 }}>
        <Logo size={64} />
        <span style={{ ...posterStyle(40, C.ink), letterSpacing: "-0.01em" }}>Steal This Vault</span>
      </div>
      <span style={{ position: "absolute", right: 110, top: 118, ...micro(C.grey, 20) }}>QoreChain testnet · chain 9800</span>

      {/* the hero line */}
      <div style={{ position: "absolute", left: 104, top: 214, lineHeight: 0.86 }}>
        <div style={{ ...posterStyle(178, C.ink), lineHeight: 0.86 }}>Here&rsquo;s</div>
        <div style={{ ...posterStyle(178, C.ink), lineHeight: 0.86 }}>the key.</div>
        <div style={{ ...posterStyle(178, C.violet), lineHeight: 0.86 }}>Good</div>
        <div style={{ ...posterStyle(178, C.violet), lineHeight: 0.86 }}>luck.</div>
      </div>

      {/* the key slip */}
      <div style={{ position: "absolute", right: 110, top: 300, width: 660, background: C.ink, color: C.paper, padding: "30px 34px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", paddingBottom: 18, borderBottom: "1px dashed rgba(236,231,220,0.25)" }}>
          <span style={micro("rgba(236,231,220,0.66)", 17)}>Owner_private.key</span>
          <span style={micro(C.mint, 17)}>&lt;public on purpose&gt;</span>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "6px 16px", padding: "24px 0 22px", fontFamily: F.mono, fontSize: 27, fontWeight: 500, letterSpacing: "0.04em" }}>
          <span style={{ color: C.violetTint }}>0x</span>
          {groups.map((g, i) => (
            <span key={i}>{g}</span>
          ))}
        </div>
        <div style={{ borderTop: "1px solid rgba(236,231,220,0.18)", paddingTop: 18, fontFamily: F.body, fontSize: 22, color: "rgba(236,231,220,0.75)", lineHeight: 1.4 }}>
          The real key, in full. The money is still inside: a second, quantum-safe lock keeps the vault shut.
        </div>
      </div>

      {/* the result */}
      <div style={{ position: "absolute", right: 110, top: 730, display: "flex", gap: 16 }}>
        <Tag text="One lock: robbed" color={C.carmine} />
        <Tag text="Two locks: still full" color={C.mint} />
      </div>

      <div style={{ position: "absolute", left: 110, bottom: 96, right: 110, display: "flex", justifyContent: "space-between" }}>
        <span style={{ ...posterStyle(46, C.ink) }}>
          The key is free. <span style={{ color: C.violet }}>The money isn&rsquo;t.</span>
        </span>
        <span style={{ ...micro(C.grey, 20), alignSelf: "flex-end" }}>Build Before Q-Day · ML-DSA-87</span>
      </div>
    </AbsoluteFill>
  );
}
