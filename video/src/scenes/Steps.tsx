/** Scenes 4 to 7: the four steps. Every figure comes from src/data.json, read from the chain. */
import React from "react";
import { AbsoluteFill, interpolate, random, useCurrentFrame, useVideoConfig } from "remotion";
import data from "../data.json";
import { clamp, countUp, ease, fadeIn, rise } from "../components/anim";
import { Backdrop, Card, Chapter, CheckGlyph, CrossGlyph, Eyebrow, KeyGlyph, LockGlyph, Logo, ShieldGlyph } from "../components/kit";
import { Statement } from "../components/kit";
import { C, FONT, alpha } from "../theme";

const qor = (s: string) => Number(s);
const decimals = (s: string) => (s.includes(".") ? s.split(".")[1]!.length : 0);

// ---------------------------------------------------------------- 4. the dare

export const DareScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { durationInFrames: d } = useVideoConfig();
  const groups = data.owner.publishedKey.slice(2).match(/.{4}/g)!;
  const typed = Math.floor(interpolate(frame, [16, 16 + groups.length * 3], [0, groups.length], clamp));
  const stampAt = Math.round(d * 0.42);
  const stamp = interpolate(frame, [stampAt, stampAt + 8], [2.2, 1], { ...clamp, easing: ease });
  const blockNow = data.block + Math.floor(frame / 42);
  const shift = (frame % 42) / 42;
  return (
    <AbsoluteFill>
      <Backdrop />
      <Chapter step="STEP 01" title="The dare" />
      <div style={{ position: "absolute", left: 120, top: 210, ...rise(frame, 6, 20) }}>
        <Card glow={C.primaryDeep} style={{ width: 980, padding: 46, position: "relative" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <KeyGlyph size={30} color={C.primary} />
            <Eyebrow>The owner's private key</Eyebrow>
          </div>
          <div style={{ marginTop: 30, display: "grid", gridTemplateColumns: "repeat(4, 1fr)", rowGap: 18, font: `500 54px ${FONT.mono}`, letterSpacing: "0.04em" }}>
            {groups.map((g, i) => (
              <span key={i} style={{ opacity: i < typed ? 1 : 0.08, color: i === typed - 1 ? C.safe : C.text }}>
                {g}
              </span>
            ))}
          </div>
          {frame >= stampAt ? (
            <div
              style={{
                position: "absolute",
                right: 40,
                top: 34,
                transform: `rotate(-8deg) scale(${stamp})`,
                padding: "10px 22px",
                border: `3px solid ${C.red}`,
                borderRadius: 10,
                color: C.red,
                font: `700 28px ${FONT.mono}`,
                letterSpacing: "0.1em",
                boxShadow: `0 0 30px ${alpha(C.red, 0.4)}`,
                opacity: fadeIn(frame, stampAt, 4),
              }}
            >
              PUBLISHED ON PURPOSE
            </div>
          ) : null}
        </Card>
      </div>
      <div style={{ position: "absolute", left: 1240, top: 150, width: 600, font: `700 44px/1.1 ${FONT.display}`, letterSpacing: "-0.02em", ...rise(frame, Math.round(d * 0.45), 18) }}>
        The real key. In full. <span style={{ color: C.primary }}>Anyone can take it.</span>
      </div>
      <div style={{ position: "absolute", right: 120, top: 320, width: 560, ...rise(frame, Math.round(d * 0.55), 20) }}>
        <Card glow={C.safe} style={{ padding: 40 }}>
          <Eyebrow color={C.safe}>Guarded by that key</Eyebrow>
          <div style={{ font: `700 104px ${FONT.display}`, marginTop: 14, letterSpacing: "-0.03em" }}>
            {countUp(frame, Math.round(d * 0.55), 40, qor(data.hybrid.holdsQor)).toFixed(decimals(data.hybrid.holdsQor))}
            <span style={{ font: `500 36px ${FONT.sans}`, color: C.muted, marginLeft: 14 }}>QOR</span>
          </div>
          <div style={{ font: `500 24px ${FONT.mono}`, color: C.muted, marginTop: 8 }}>
            vault {data.hybrid.address.slice(0, 8)}…{data.hybrid.address.slice(-4)}
          </div>
        </Card>
      </div>
      {/* the chain, ticking */}
      <div style={{ position: "absolute", left: 120, right: 120, top: 770, display: "flex", alignItems: "center", gap: 28, opacity: fadeIn(frame, 30, 20) }}>
        <div style={{ flex: "none" }}>
          <div style={{ font: `600 26px ${FONT.display}` }}>QoreChain testnet</div>
          <div style={{ font: `400 20px ${FONT.mono}`, color: C.faint }}>chain id 9800 · live</div>
        </div>
        <div style={{ flex: 1, overflow: "hidden", display: "flex", justifyContent: "flex-end", maskImage: "linear-gradient(90deg, transparent, #000 25%)", WebkitMaskImage: "linear-gradient(90deg, transparent, #000 25%)" }}>
          <div style={{ display: "flex", gap: 26, transform: `translateX(${(1 - shift) * 0}px)` }}>
            {Array.from({ length: 7 }, (_, i) => blockNow - 6 + i).map((b, i) => (
              <div
                key={b}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: "12px 20px",
                  borderRadius: 10,
                  border: `1.5px solid ${i === 6 ? C.primary : C.line}`,
                  background: C.panel,
                  font: `500 22px ${FONT.mono}`,
                  color: i === 6 ? C.text : C.muted,
                  boxShadow: i === 6 ? `0 0 26px ${alpha(C.primary, 0.6)}` : undefined,
                  opacity: i === 6 ? fadeIn(frame % 42, 0, 8) : 1,
                }}
              >
                <span style={{ width: 12, height: 12, transform: "rotate(45deg)", background: `linear-gradient(135deg, ${C.primary}, ${C.safe})`, borderRadius: 2 }} />#
                {b.toLocaleString("en-US")}
              </div>
            ))}
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------- 5. two locks

/** A pulse that travels from (x1,y1) to (x2,y2) between frames a and b. */
const Pulse: React.FC<{ x1: number; y1: number; x2: number; y2: number; a: number; b: number; color: string }> = ({ x1, y1, x2, y2, a, b, color }) => {
  const frame = useCurrentFrame();
  const t = interpolate(frame, [a, b], [0, 1], { ...clamp, easing: ease });
  if (frame < a || frame > b + 6) return null;
  return <circle cx={x1 + (x2 - x1) * t} cy={y1 + (y2 - y1) * t} r={11} fill={color} style={{ filter: `drop-shadow(0 0 12px ${color})` }} />;
};

export const LocksScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { durationInFrames: d } = useVideoConfig();
  const A = Math.round(d * 0.3); // owner signs with both
  const B = Math.round(d * 0.62); // thief signs with one
  const owner = frame >= A + 24 && frame < B;
  const thief = frame >= B + 24;
  const centre = { x: 960, y: 520 };
  const left = { x: 420, y: 520 };
  const right = { x: 1500, y: 520 };
  const node = (x: number, at: number, state: "idle" | "ok" | "fail", tag: string, title: string, sub: string, tone: string) => (
    <div style={{ position: "absolute", left: x - 230, top: 400, width: 460, ...rise(frame, at, 18) }}>
      <Card glow={state === "ok" ? C.safe : state === "fail" ? C.red : tone} style={{ padding: 30 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <Eyebrow color={tone}>{tag}</Eyebrow>
          {state === "ok" ? <CheckGlyph size={34} /> : state === "fail" ? <CrossGlyph size={34} /> : null}
        </div>
        <div style={{ font: `700 38px ${FONT.display}`, marginTop: 10 }}>{title}</div>
        <div style={{ font: `500 22px ${FONT.mono}`, color: C.muted, marginTop: 8 }}>{sub}</div>
      </Card>
    </div>
  );
  const lock2State = owner ? "ok" : thief ? "fail" : "idle";
  const lock1State = owner || thief ? "ok" : "idle";
  return (
    <AbsoluteFill>
      <Backdrop />
      <Chapter step="STEP 02" title="Two locks" />
      <svg width={1920} height={1080} style={{ position: "absolute", inset: 0 }}>
        <line x1={left.x + 230} y1={left.y} x2={centre.x - 140} y2={centre.y} stroke={alpha(C.primary, 0.5)} strokeWidth={2} strokeDasharray="8 10" strokeDashoffset={-frame} />
        <line x1={right.x - 230} y1={right.y} x2={centre.x + 140} y2={centre.y} stroke={alpha(C.safe, 0.5)} strokeWidth={2} strokeDasharray="8 10" strokeDashoffset={-frame} />
        <line x1={centre.x} y1={centre.y + 140} x2={centre.x} y2={770} stroke={alpha(C.muted, 0.4)} strokeWidth={2} strokeDasharray="6 8" strokeDashoffset={-frame} />
        <Pulse x1={left.x + 230} y1={left.y} x2={centre.x - 140} y2={centre.y} a={A} b={A + 24} color={C.primary} />
        <Pulse x1={right.x - 230} y1={right.y} x2={centre.x + 140} y2={centre.y} a={A} b={A + 24} color={C.safe} />
        <Pulse x1={left.x + 230} y1={left.y} x2={centre.x - 140} y2={centre.y} a={B} b={B + 24} color={C.red} />
      </svg>
      {node(left.x, 10, lock1State, "Lock 1", "Ordinary key", "secp256k1 · the key that leaked", C.primary)}
      {node(right.x, 24, lock2State, "Lock 2", "Quantum-safe key", "ML-DSA-87 · NIST FIPS 204", C.safe)}
      <div style={{ position: "absolute", left: centre.x - 130, top: centre.y - 130, transform: `scale(${1 + 0.04 * Math.sin(frame / 10)})` }}>
        <Logo size={260} />
      </div>
      <div style={{ position: "absolute", left: 0, right: 0, top: 160, textAlign: "center", font: `700 54px ${FONT.display}`, letterSpacing: "-0.02em" }}>
        {owner ? (
          <span style={{ color: C.safe, ...rise(frame, A + 24, 12) }}>Both signatures: the vault pays.</span>
        ) : thief ? (
          <span style={{ color: C.red, ...rise(frame, B + 24, 12) }}>One key alone: refused.</span>
        ) : (
          <span style={{ ...rise(frame, 30, 16) }}>A withdrawal needs both.</span>
        )}
      </div>
      <div style={{ position: "absolute", left: centre.x - 330, top: 770, width: 660, ...rise(frame, 40, 18) }}>
        <Card style={{ padding: "20px 28px", display: "flex", alignItems: "center", gap: 18 }}>
          <ShieldGlyph size={40} color={C.primary} />
          <div>
            <div style={{ font: `600 28px ${FONT.display}` }}>Checked by the chain itself</div>
            <div style={{ font: `500 20px ${FONT.mono}`, color: C.faint }}>PQC verify precompile 0x…0A01</div>
          </div>
        </Card>
      </div>
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------- 6. the attacks

export const AttacksScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { durationInFrames: d } = useVideoConfig();
  const list = data.attacks;
  const start = Math.round(d * 0.12);
  const end = Math.round(d * 0.74);
  const every = (end - start) / list.length;
  const shown = Math.max(0, Math.min(list.length, Math.floor((frame - start) / every) + 1));
  const rowH = 64;
  const visible = 9;
  const scroll = Math.max(0, shown - visible) * rowH;
  const controlAt = Math.round(d * 0.8);
  const lastAt = start + (shown - 1) * every;
  const ring = interpolate(frame - lastAt, [0, 16], [0, 1], clamp);
  return (
    <AbsoluteFill>
      <Backdrop />
      <Chapter step="STEP 03" title="Attack it" />
      <div style={{ position: "absolute", left: 120, top: 200, width: 1040, height: visible * rowH, overflow: "hidden" }}>
        <div style={{ transform: `translateY(${-interpolate(frame, [0, 1], [scroll, scroll])}px)`, transition: "none" }}>
          {list.slice(0, shown).map((title, i) => {
            const at = start + i * every;
            return (
              <div
                key={title}
                style={{
                  height: rowH - 10,
                  marginBottom: 10,
                  display: "flex",
                  alignItems: "center",
                  gap: 22,
                  padding: "0 22px",
                  borderRadius: 12,
                  background: C.panel,
                  border: `1px solid ${C.lineSoft}`,
                  opacity: fadeIn(frame, at, 6),
                  transform: `translateX(${interpolate(frame, [at, at + 8], [-40, 0], { ...clamp, easing: ease })}px)`,
                }}
              >
                <span style={{ font: `600 22px ${FONT.mono}`, color: C.faint, width: 40 }}>{String(i + 1).padStart(2, "0")}</span>
                <KeyGlyph size={26} color={C.red} />
                <span style={{ flex: 1, font: `500 27px ${FONT.sans}` }}>{title}</span>
                <span
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    font: `700 20px ${FONT.mono}`,
                    letterSpacing: "0.1em",
                    color: C.safe,
                    padding: "6px 12px",
                    border: `1.5px solid ${C.safe}`,
                    borderRadius: 8,
                    opacity: fadeIn(frame, at + 7, 4),
                  }}
                >
                  <ShieldGlyph size={20} /> REFUSED
                </span>
              </div>
            );
          })}
        </div>
      </div>
      <div style={{ position: "absolute", right: 120, top: 220, width: 520, textAlign: "center", ...rise(frame, 10, 18) }}>
        <div style={{ position: "relative", width: 300, height: 300, margin: "0 auto" }}>
          <div
            style={{
              position: "absolute",
              inset: -40 * ring,
              borderRadius: "50%",
              border: `3px solid ${C.safe}`,
              opacity: shown > 0 ? 1 - ring : 0,
            }}
          />
          <Logo size={300} />
        </div>
        <div style={{ font: `700 140px/1 ${FONT.display}`, marginTop: 30, letterSpacing: "-0.04em" }}>
          {shown}
          <span style={{ color: C.faint, fontSize: 70 }}> / {list.length}</span>
        </div>
        <div style={{ font: `600 30px ${FONT.mono}`, color: C.safe, letterSpacing: "0.14em", marginTop: 6 }}>REFUSED</div>
        <div style={{ font: `500 26px/1.35 ${FONT.sans}`, color: C.muted, marginTop: 22 }}>Real attacks, signed with the real stolen key, each one counted by the vault on chain.</div>
      </div>
      {frame >= controlAt ? (
        <div style={{ position: "absolute", left: 120, top: 200 + visible * rowH + 20, width: 1040, ...rise(frame, controlAt, 14) }}>
          <div style={{ display: "flex", alignItems: "center", gap: 22, padding: "16px 22px", borderRadius: 12, border: `1.5px solid ${C.red}`, background: alpha(C.red, 0.08) }}>
            <span style={{ font: `600 22px ${FONT.mono}`, color: C.red, width: 40 }}>18</span>
            <span style={{ flex: 1, font: `600 27px ${FONT.sans}` }}>{data.control_attack} · the control</span>
            <span style={{ font: `700 20px ${FONT.mono}`, letterSpacing: "0.1em", color: C.red }}>ROBBED</span>
          </div>
        </div>
      ) : null}
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------- 7. the control

const Coins: React.FC<{ at: number }> = ({ at }) => {
  const frame = useCurrentFrame();
  const t = frame - at;
  if (t < 0) return null;
  return (
    <>
      {Array.from({ length: 22 }, (_, i) => {
        const ang = random(`a${i}`) * Math.PI * 2;
        const sp = 6 + random(`s${i}`) * 10;
        const x = Math.cos(ang) * sp * t;
        const y = Math.sin(ang) * sp * t + 0.35 * t * t;
        return (
          <span
            key={i}
            style={{
              position: "absolute",
              left: "50%",
              top: "50%",
              width: 22,
              height: 22,
              marginLeft: -11,
              marginTop: -11,
              borderRadius: "50%",
              background: `radial-gradient(circle at 35% 35%, #ffd1d6, ${C.red} 60%, ${C.redDeep})`,
              transform: `translate(${x}px, ${y}px)`,
              opacity: interpolate(t, [0, 40], [1, 0], clamp),
            }}
          />
        );
      })}
    </>
  );
};

export const ControlScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { durationInFrames: d } = useVideoConfig();
  const hit = Math.round(d * 0.34);
  const flyT = interpolate(frame, [Math.round(d * 0.12), hit], [0, 1], { ...clamp, easing: ease });
  const after = frame >= hit;
  const vault = (side: "one" | "two") => {
    const one = side === "one";
    const glow = after ? (one ? C.red : C.safe) : C.line;
    return (
      <Card glow={glow} style={{ width: 720, padding: 42, position: "relative" }}>
        <Eyebrow color={one ? C.muted : C.safe}>{one ? "One lock · the control" : "Two locks · the vault"}</Eyebrow>
        <div style={{ position: "relative", height: 300, marginTop: 20, borderRadius: 16, background: C.bg, border: `1px solid ${C.lineSoft}`, display: "grid", placeItems: "center", overflow: "hidden" }}>
          <div style={{ display: "flex", gap: 30 }}>
            <LockGlyph size={110} color={after ? (one ? C.red : C.primary) : C.muted} open={after && one} />
            {one ? null : <ShieldGlyph size={110} color={C.safe} />}
          </div>
          {one ? <Coins at={hit} /> : null}
          {!one && after ? (
            <div
              style={{
                position: "absolute",
                width: 240,
                height: 240,
                borderRadius: "50%",
                border: `3px solid ${C.safe}`,
                transform: `scale(${interpolate((frame - hit) % 40, [0, 40], [0.6, 1.8])})`,
                opacity: interpolate((frame - hit) % 40, [0, 40], [0.9, 0]),
              }}
            />
          ) : null}
        </div>
        <div style={{ marginTop: 26, font: `700 64px ${FONT.display}`, color: after ? (one ? C.red : C.safe) : C.text, letterSpacing: "-0.02em" }}>
          {after ? (one ? "ROBBED" : "REFUSED") : "…"}
        </div>
        <div style={{ marginTop: 8, font: `500 26px ${FONT.sans}`, color: C.muted, minHeight: 72, opacity: fadeIn(frame, hit + 20, 14) }}>
          {one ? (
            <>
              <b style={{ color: C.text }}>{data.control.takenQor} QOR</b> taken with the published key, every time it was tried.
            </>
          ) : (
            <>
              <b style={{ color: C.text }}>{data.hybrid.holdsQor} QOR</b> still inside. {data.hybrid.wouldHaveLostQor} QOR saved by the second lock alone.
            </>
          )}
        </div>
      </Card>
    );
  };
  return (
    <AbsoluteFill>
      <Backdrop />
      <Chapter step="STEP 04" title="The control" tone="red" />
      <div style={{ position: "absolute", left: 0, right: 0, top: 170, textAlign: "center", font: `600 40px ${FONT.display}`, color: C.muted, ...rise(frame, 6, 16) }}>
        Same key. Same code. One difference.
      </div>
      <div style={{ position: "absolute", left: 960 - 22, top: interpolate(flyT, [0, 1], [240, 420]), opacity: flyT < 1 ? fadeIn(frame, Math.round(d * 0.12), 6) : 0 }}>
        <KeyGlyph size={44} color={C.red} />
      </div>
      <div style={{ position: "absolute", left: 120, top: 270, ...rise(frame, 10, 18) }}>{vault("one")}</div>
      <div style={{ position: "absolute", right: 120, top: 270, ...rise(frame, 18, 18) }}>{vault("two")}</div>
    </AbsoluteFill>
  );
};
