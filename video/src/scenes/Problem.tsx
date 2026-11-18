/**
 * The problem act, told in pictures and big words (no narration):
 * a wallet is one key, keys leak, quantum computers will derive them, Q-Day.
 */
import React from "react";
import { AbsoluteFill, interpolate, random, useCurrentFrame, useVideoConfig } from "remotion";
import { clamp, ease, fadeIn, rise } from "../components/anim";
import { Backdrop, Card, Eyebrow, Glitch, KeyGlyph, LockGlyph, Statement } from "../components/kit";
import { C, FONT, alpha } from "../theme";

// ---------------------------------------------------------------- the wallet

export const WalletScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { durationInFrames: d } = useVideoConfig();
  const second = Math.round(d * 0.48);
  const link = interpolate(frame, [20, 50], [0, 1], { ...clamp, easing: ease });
  const owns = frame >= second;
  return (
    <AbsoluteFill>
      <Backdrop density={0.7} />
      <Statement at={8} top={150} lines={["On a blockchain,", "a wallet is one key."]} />
      <div style={{ position: "absolute", left: 360, top: 470, display: "flex", alignItems: "center", gap: 0 }}>
        <div style={{ textAlign: "center", ...rise(frame, 14, 18) }}>
          <div
            style={{
              width: 190,
              height: 190,
              borderRadius: "50%",
              display: "grid",
              placeItems: "center",
              border: `2px solid ${owns ? C.red : C.primary}`,
              boxShadow: `0 0 ${40 + 20 * Math.sin(frame / 8)}px ${alpha(owns ? C.red : C.primary, 0.55)}`,
              background: C.panel,
            }}
          >
            <KeyGlyph size={100} color={owns ? C.red : C.primary} />
          </div>
          <div style={{ font: `600 26px ${FONT.mono}`, color: C.muted, marginTop: 18, letterSpacing: "0.1em" }}>PRIVATE KEY</div>
        </div>
        <div style={{ width: 380 * link, height: 3, margin: "0 0 50px", background: `linear-gradient(90deg, ${owns ? C.red : C.primary}, ${C.safe})`, boxShadow: `0 0 16px ${alpha(C.primary, 0.7)}` }} />
        <div style={{ ...rise(frame, 40, 18) }}>
          <Card glow={owns ? C.red : C.line} style={{ width: 560, padding: 38, marginBottom: 50 }}>
            <Eyebrow color={C.muted}>Wallet · 0x7f3a…91c2</Eyebrow>
            <div style={{ font: `700 88px ${FONT.display}`, marginTop: 12, letterSpacing: "-0.03em" }}>$48,210.55</div>
            <div style={{ font: `500 24px ${FONT.sans}`, color: C.muted, marginTop: 6 }}>Savings, tokens, everything.</div>
          </Card>
        </div>
      </div>
      <Statement at={second} top={800} color={C.red} lines={["Whoever holds the key owns it all."]} size={64} />
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------- how keys leak

const LEAKS = [
  {
    tag: "Phishing",
    body: (
      <>
        <div style={{ font: `600 26px ${FONT.sans}` }}>Urgent: verify your wallet</div>
        <div style={{ font: `400 21px ${FONT.sans}`, color: C.muted, marginTop: 6 }}>Your account will be suspended in 24 hours.</div>
        <div style={{ marginTop: 18, display: "inline-block", padding: "10px 20px", borderRadius: 8, background: C.primary, font: `600 21px ${FONT.sans}` }}>
          Restore wallet
        </div>
      </>
    ),
  },
  {
    tag: "Malware",
    body: (
      <div style={{ font: `500 21px/1.6 ${FONT.mono}`, color: C.muted }}>
        <div>&gt; watching clipboard…</div>
        <div>&gt; wallet file found</div>
        <div style={{ color: C.red }}>&gt; key copied to 185.22.…</div>
      </div>
    ),
  },
  {
    tag: "One bad backup",
    body: (
      <div style={{ font: `500 22px/1.6 ${FONT.sans}`, color: C.muted }}>
        <div style={{ color: C.text }}>seed-phrase.png</div>
        <div>synced to cloud · shared link</div>
        <div style={{ color: C.red }}>opened by someone else</div>
      </div>
    ),
  },
] as const;

export const LeakScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { durationInFrames: d } = useVideoConfig();
  const converge = Math.round(d * 0.62);
  const t = interpolate(frame, [converge, converge + 24], [0, 1], { ...clamp, easing: ease });
  return (
    <AbsoluteFill>
      <Backdrop tone="red" density={0.6} />
      <Statement at={6} top={110} lines={["Keys leak every day."]} />
      <div style={{ position: "absolute", left: 120, top: 300, display: "flex", gap: 34 }}>
        {LEAKS.map((l, i) => {
          const at = Math.round(d * (0.14 + i * 0.14));
          const hit = frame > at + 26;
          return (
            <div key={l.tag} style={{ ...rise(frame, at, 16), transform: `${rise(frame, at, 16).transform ?? ""} translateY(${t * 30}px) scale(${1 - t * 0.06})` }}>
              <Card glow={hit ? C.red : C.line} style={{ width: 500, height: 290, padding: 32 }}>
                <Eyebrow color={hit ? C.red : C.muted}>{l.tag}</Eyebrow>
                <div style={{ marginTop: 18 }}>{l.body}</div>
              </Card>
            </div>
          );
        })}
      </div>
      <svg width={1920} height={1080} style={{ position: "absolute", inset: 0 }}>
        {[370, 904, 1438].map((x, i) => (
          <line key={x} x1={x} y1={640} x2={x + (960 - x) * t} y2={640 + 170 * t} stroke={alpha(C.red, 0.8 * t)} strokeWidth={3} strokeDasharray="10 8" strokeDashoffset={-frame * 2 + i * 5} />
        ))}
      </svg>
      <div style={{ position: "absolute", left: 960 - 60, top: 770, opacity: t, transform: `scale(${0.6 + 0.4 * t})` }}>
        <div style={{ width: 120, height: 120, borderRadius: "50%", display: "grid", placeItems: "center", background: alpha(C.red, 0.15), border: `2px solid ${C.red}`, boxShadow: `0 0 40px ${alpha(C.red, 0.6)}` }}>
          <KeyGlyph size={64} color={C.red} />
        </div>
      </div>
      <Statement at={converge + 20} top={850} color={C.red} size={52} lines={["One bad click, and the key is someone else's."]} />
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------- the quantum threat

const PUB = "02a7f3c91e5b8d4460fe2c7a19b03d58e6f14a92c07be35d1f88a6034c9e27b1d5";
const PRIV = "9b1e44c0d7a2f8136e5c09ab7d21f4e8c3a90b6d5e17f2c48a0d9e6b31c7f05a";

export const QuantumScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { durationInFrames: d } = useVideoConfig();
  const inAt = Math.round(d * 0.22);
  const outAt = Math.round(d * 0.5);
  const solved = Math.floor(interpolate(frame, [outAt, Math.round(d * 0.78)], [0, PRIV.length], clamp));
  const qx = 960;
  const qy = 560;
  return (
    <AbsoluteFill>
      <Backdrop density={0.6} tone={frame > outAt ? "red" : "blue"} />
      <Statement at={6} top={96} lines={["Soon, nobody will even need to steal it."]} size={64} />
      {/* public key in */}
      <div style={{ position: "absolute", left: 100, top: 400, width: 470, ...rise(frame, 20, 16) }}>
        <Card style={{ padding: 30 }}>
          <Eyebrow color={C.safe}>Your public key</Eyebrow>
          <div style={{ font: `500 22px/1.5 ${FONT.mono}`, color: C.muted, marginTop: 12, wordBreak: "break-all" }}>{PUB}</div>
          <div style={{ font: `400 20px ${FONT.sans}`, color: C.faint, marginTop: 12 }}>On the chain, for anyone to read.</div>
        </Card>
      </div>
      {/* the quantum computer */}
      <svg width={1920} height={1080} style={{ position: "absolute", inset: 0 }}>
        {Array.from({ length: 7 }, (_, r) =>
          Array.from({ length: 7 }, (_, c) => {
            const x = qx - 180 + c * 60;
            const y = qy - 180 + r * 60;
            const wave = 0.5 + 0.5 * Math.sin(frame / 6 - Math.hypot(c - 3, r - 3) * 1.1);
            const on = frame > inAt;
            return <circle key={`${r}-${c}`} cx={x} cy={y} r={5 + 5 * wave * (on ? 1 : 0.3)} fill={alpha(frame > outAt ? C.red : C.primary, 0.25 + 0.7 * wave * (on ? 1 : 0.3))} />;
          }),
        )}
        {[0, 1, 2].map((i) => (
          <ellipse
            key={i}
            cx={qx}
            cy={qy}
            rx={250}
            ry={80}
            fill="none"
            stroke={alpha(C.safe, 0.35)}
            strokeWidth={2}
            transform={`rotate(${frame * (0.8 + i * 0.3) + i * 60} ${qx} ${qy})`}
          />
        ))}
        {/* data streams */}
        {Array.from({ length: 10 }, (_, i) => {
          const p = ((frame - inAt) / 30 + i / 10) % 1;
          if (frame < inAt || frame > outAt + 20) return null;
          return <circle key={`in${i}`} cx={570 + (qx - 250 - 570) * p} cy={540 + (qy - 540) * p} r={6} fill={C.safe} opacity={0.9} />;
        })}
        {Array.from({ length: 10 }, (_, i) => {
          const p = ((frame - outAt) / 30 + i / 10) % 1;
          if (frame < outAt) return null;
          return <circle key={`out${i}`} cx={qx + 250 + (1350 - qx - 250) * p} cy={qy + (540 - qy) * p} r={6} fill={C.red} opacity={0.9} />;
        })}
      </svg>
      <div style={{ position: "absolute", left: qx - 200, top: qy + 230, width: 400, textAlign: "center", ...rise(frame, inAt, 14) }}>
        <div style={{ font: `700 30px ${FONT.display}` }}>Quantum computer</div>
        <div style={{ font: `500 20px ${FONT.mono}`, color: C.faint, marginTop: 4 }}>running Shor's algorithm</div>
      </div>
      {/* private key out */}
      <div style={{ position: "absolute", right: 100, top: 400, width: 470, ...rise(frame, outAt, 16) }}>
        <Card glow={C.red} style={{ padding: 30 }}>
          <Eyebrow color={C.red}>Your private key</Eyebrow>
          <div style={{ font: `500 22px/1.5 ${FONT.mono}`, marginTop: 12, wordBreak: "break-all" }}>
            {PRIV.split("").map((ch, i) => (
              <span key={i} style={{ color: i < solved ? C.red : C.lineSoft }}>
                {i < solved ? ch : "0123456789abcdef"[Math.floor(random(`q${i}-${Math.floor(frame / 2)}`) * 16)]}
              </span>
            ))}
          </div>
          <div style={{ font: `400 20px ${FONT.sans}`, color: C.faint, marginTop: 12 }}>Worked out. Never stolen.</div>
        </Card>
      </div>
      <Statement at={Math.round(d * 0.62)} top={850} color={C.red} size={46} lines={["It works out the private key from the public one."]} />
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------- Q-Day

const COLS = 28;
const ROWS = 12;

export const QDayScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { durationInFrames: d } = useVideoConfig();
  const waveAt = Math.round(d * 0.12);
  const dayAt = Math.round(d * 0.3);
  const radius = interpolate(frame, [waveAt, Math.round(d * 0.62)], [0, 14], clamp);
  return (
    <AbsoluteFill>
      <Backdrop tone="red" density={0.4} />
      <div style={{ position: "absolute", left: 120, top: 120, display: "grid", gridTemplateColumns: `repeat(${COLS}, 1fr)`, gap: 10, width: 1680, opacity: 0.85 }}>
        {Array.from({ length: COLS * ROWS }, (_, i) => {
          const c = i % COLS;
          const r = Math.floor(i / COLS);
          const dist = Math.hypot((c - COLS / 2) / 1.6, r - ROWS / 2) + random(`w${i}`) * 2;
          const red = dist < radius;
          const flick = red && dist > radius - 1.5 && frame % 4 < 2;
          return (
            <div
              key={i}
              style={{
                height: 50,
                borderRadius: 8,
                display: "grid",
                placeItems: "center",
                border: `1.5px solid ${red ? C.red : C.line}`,
                background: red ? alpha(C.red, flick ? 0.5 : 0.18) : C.panel,
                boxShadow: red ? `0 0 14px ${alpha(C.red, 0.4)}` : undefined,
              }}
            >
              <LockGlyph size={22} color={red ? C.red : C.faint} open={red} />
            </div>
          );
        })}
      </div>
      <AbsoluteFill style={{ background: `radial-gradient(ellipse at center, ${alpha(C.bg, 0.85)} 0%, ${alpha(C.bg, 0.4)} 45%, transparent 75%)` }} />
      <div style={{ position: "absolute", left: 0, right: 0, top: 330, textAlign: "center" }}>
        <Glitch at={dayAt} style={{ font: `700 220px/1 ${FONT.display}`, letterSpacing: "-0.04em", textShadow: `0 0 70px ${alpha(C.red, 0.6)}` }}>
          Q-DAY
        </Glitch>
        <div style={{ marginTop: 20, font: `600 44px ${FONT.display}`, color: C.text, ...rise(frame, dayAt + 24, 16) }}>Every exposed wallet. At once.</div>
        <div style={{ marginTop: 14, font: `400 26px ${FONT.sans}`, color: C.muted, opacity: fadeIn(frame, dayAt + 50, 16) }}>
          And public keys recorded today can be cracked later.
        </div>
      </div>
    </AbsoluteFill>
  );
};
