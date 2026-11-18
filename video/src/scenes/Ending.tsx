/** Scenes 8 to 10: the product, drill day, the close. */
import React from "react";
import {
  AbsoluteFill,
  Img,
  interpolate,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import data from "../data.json";
import { clamp, countUp, ease, fadeIn, rise } from "../components/anim";
import {
  Backdrop,
  Card,
  CheckGlyph,
  Eyebrow,
  KeyGlyph,
  Logo,
  ShieldGlyph,
} from "../components/kit";
import { C, FONT, alpha } from "../theme";

// ---------------------------------------------------------------- 8. product

const SHOTS = [
  {
    file: "overview.png",
    label: "Live from the chain",
    sub: "Balance, refusals and blocks, read as you watch",
    fx: 0.3,
    fy: 0.45,
  },
  {
    file: "replay.png",
    label: "Every attempt, played back",
    sub: "Real attempts from the vault's own record",
    fx: 0.3,
    fy: 0.75,
  },
  {
    file: "intruders.png",
    label: "Every thief profiled",
    sub: "Wallets, methods, and the stolen money followed",
    fx: 0.75,
    fy: 0.75,
  },
  {
    file: "lab.png",
    label: "The attack lab",
    sub: "18 real attacks, run from your browser",
    fx: 0.7,
    fy: 0.5,
  },
] as const;

export const ProductScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { durationInFrames: d } = useVideoConfig();
  const shotsEnd = Math.round(d * 0.76);
  const per = shotsEnd / SHOTS.length;
  const idx = Math.min(SHOTS.length - 1, Math.floor(frame / per));
  const local = frame - idx * per;
  const extrasAt = shotsEnd;
  const frameW = 1360;
  const frameH = 765;
  return (
    <AbsoluteFill>
      <Backdrop density={0.6} />
      <div
        style={{
          position: "absolute",
          left: 96,
          top: 80,
          ...rise(frame, 2, 14),
        }}
      >
        <Eyebrow>Live on the QoreChain testnet</Eyebrow>
      </div>
      {/* browser frame */}
      <div
        style={{
          position: "absolute",
          left: 96,
          top: 150,
          width: frameW,
          transform: `perspective(2400px) rotateY(${interpolate(frame, [0, d], [6, -2])}deg)`,
          opacity: fadeIn(frame, 0, 12),
        }}
      >
        <Card
          style={{ overflow: "hidden", borderRadius: 18 }}
          glow={C.primaryDeep}
        >
          <div
            style={{
              height: 50,
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "0 20px",
              background: C.bg2,
              borderBottom: `1px solid ${C.lineSoft}`,
            }}
          >
            {[C.red, "#ffb547", C.safe].map((c) => (
              <span
                key={c}
                style={{
                  width: 13,
                  height: 13,
                  borderRadius: 7,
                  background: c,
                  opacity: 0.8,
                }}
              />
            ))}
            <span
              style={{
                marginLeft: 20,
                padding: "6px 18px",
                borderRadius: 8,
                background: C.panel,
                font: `500 19px ${FONT.mono}`,
                color: C.muted,
              }}
            >
              {data.site}
            </span>
          </div>
          <div
            style={{
              position: "relative",
              height: frameH,
              overflow: "hidden",
              background: C.bg,
            }}
          >
            {SHOTS.map((s, i) => {
              const l = frame - i * per;
              const vis = i === idx || (i === idx - 1 && local < 10);
              if (!vis) return null;
              const zoom = interpolate(l, [0, per], [1.02, 1.14]);
              return (
                <Img
                  key={s.file}
                  src={staticFile(`shots/${s.file}`)}
                  style={{
                    position: "absolute",
                    inset: 0,
                    width: "100%",
                    height: "100%",
                    objectFit: "cover",
                    transformOrigin: `${s.fx * 100}% ${s.fy * 100}%`,
                    transform: `scale(${zoom})`,
                    opacity: i === idx ? fadeIn(l, 0, 10) : 1,
                  }}
                />
              );
            })}
          </div>
        </Card>
      </div>
      {/* callout */}
      {frame >= extrasAt ? null : (
        <div
          key={idx}
          style={{
            position: "absolute",
            left: 1500,
            top: 330,
            width: 340,
            ...rise(local, 6, 14),
          }}
        >
          <div
            style={{
              width: 60,
              height: 3,
              background: `linear-gradient(90deg, ${C.primary}, ${C.safe})`,
              marginBottom: 22,
            }}
          />
          <div
            style={{
              font: `600 20px ${FONT.mono}`,
              color: C.primary,
              letterSpacing: "0.14em",
            }}
          >
            {String(idx + 1).padStart(2, "0")} /{" "}
            {String(SHOTS.length).padStart(2, "0")}
          </div>
          <div
            style={{
              font: `700 50px/1.05 ${FONT.display}`,
              marginTop: 12,
              letterSpacing: "-0.02em",
            }}
          >
            {SHOTS[idx]!.label}
          </div>
          <div
            style={{
              font: `400 26px/1.4 ${FONT.sans}`,
              color: C.muted,
              marginTop: 14,
            }}
          >
            {SHOTS[idx]!.sub}
          </div>
        </div>
      )}
      {frame >= extrasAt ? (
        <AbsoluteFill
          style={{
            background: "rgba(5,7,15,0.78)",
            opacity: fadeIn(frame, extrasAt, 10),
          }}
        />
      ) : null}
      {frame >= extrasAt ? (
        <div
          style={{
            position: "absolute",
            left: 96,
            right: 96,
            top: 380,
            display: "flex",
            gap: 40,
            justifyContent: "center",
          }}
        >
          {[
            {
              icon: <KeyGlyph size={46} color={C.red} />,
              title: "Alerted the moment the key is used",
              sub: "Telegram or Discord, straight from the vault's log",
            },
            {
              icon: <ShieldGlyph size={46} />,
              title: "One command to move the funds out",
              sub: "Shut the side door, sign with both keys, move",
            },
          ].map((c, i) => (
            <div key={c.title} style={{ ...rise(frame, extrasAt + i * 8, 16) }}>
              <Card
                glow={i === 0 ? C.red : C.safe}
                style={{
                  width: 760,
                  padding: 44,
                  display: "flex",
                  gap: 28,
                  alignItems: "center",
                  background: `linear-gradient(180deg, ${C.panel2}, ${C.bg2})`,
                }}
              >
                {c.icon}
                <div>
                  <div style={{ font: `700 38px ${FONT.display}` }}>
                    {c.title}
                  </div>
                  <div
                    style={{
                      font: `400 25px ${FONT.sans}`,
                      color: C.muted,
                      marginTop: 8,
                    }}
                  >
                    {c.sub}
                  </div>
                </div>
              </Card>
            </div>
          ))}
        </div>
      ) : null}
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------- 9. drill day

export const DrillScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { durationInFrames: d } = useVideoConfig();
  const title = `${data.drill.date.toUpperCase()} · Q-DAY DRILL`;
  const typed = title.slice(0, Math.floor(frame / 1.4));
  const sweep = interpolate(
    frame,
    [Math.round(d * 0.08), Math.round(d * 0.55)],
    [0, 1],
    { ...clamp, easing: ease },
  );
  const hours = Math.floor(sweep * 24);
  const proofAt = Math.round(d * 0.58);
  const r = 190;
  const circ = 2 * Math.PI * r;
  return (
    <AbsoluteFill>
      <Backdrop density={0.5} />
      <div
        style={{
          position: "absolute",
          left: 120,
          top: 96,
          font: `700 34px ${FONT.mono}`,
          letterSpacing: "0.12em",
          color: C.primary,
        }}
      >
        {typed}
        <span style={{ opacity: frame % 20 < 10 ? 1 : 0 }}>_</span>
      </div>
      <div
        style={{
          position: "absolute",
          left: 160,
          top: 230,
          width: 460,
          height: 460,
        }}
      >
        <svg width={460} height={460} viewBox="0 0 460 460">
          <circle
            cx={230}
            cy={230}
            r={r}
            fill="none"
            stroke={C.lineSoft}
            strokeWidth={14}
          />
          <circle
            cx={230}
            cy={230}
            r={r}
            fill="none"
            stroke="url(#dg)"
            strokeWidth={14}
            strokeLinecap="round"
            strokeDasharray={circ}
            strokeDashoffset={circ * (1 - sweep)}
            transform="rotate(-90 230 230)"
          />
          <defs>
            <linearGradient id="dg" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor={C.red} />
              <stop offset="1" stopColor={C.primary} />
            </linearGradient>
          </defs>
        </svg>
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "grid",
            placeItems: "center",
            textAlign: "center",
          }}
        >
          <div>
            <div
              style={{
                font: `700 110px/1 ${FONT.display}`,
                letterSpacing: "-0.04em",
              }}
            >
              {String(hours).padStart(2, "0")}
              <span style={{ fontSize: 50, color: C.faint }}>h</span>
            </div>
            <div
              style={{
                font: `500 19px/1.3 ${FONT.mono}`,
                color: C.red,
                marginTop: 10,
                width: 230,
              }}
            >
              key in an attacker's hands
            </div>
          </div>
        </div>
      </div>
      <div
        style={{
          position: "absolute",
          left: 720,
          top: 250,
          display: "grid",
          gap: 26,
        }}
      >
        {[
          { label: "Coins the attacker moved", value: "0", tone: C.safe },
          {
            label: "Still in the vault",
            value: `${data.hybrid.holdsQor} QOR`,
            tone: C.text,
          },
        ].map((s, i) => (
          <div
            key={s.label}
            style={{ ...rise(frame, Math.round(d * 0.2) + i * 10, 16) }}
          >
            <div style={{ font: `500 24px ${FONT.sans}`, color: C.muted }}>
              {s.label}
            </div>
            <div
              style={{
                font: `700 92px/1.05 ${FONT.display}`,
                color: s.tone,
                letterSpacing: "-0.03em",
              }}
            >
              {s.value}
            </div>
          </div>
        ))}
      </div>
      {frame >= proofAt ? (
        <div
          style={{
            position: "absolute",
            left: 160,
            right: 160,
            top: 740,
            ...rise(frame, proofAt, 18),
          }}
        >
          <Card
            glow={C.safe}
            style={{
              padding: "30px 40px",
              display: "flex",
              alignItems: "center",
              gap: 34,
            }}
          >
            <CheckGlyph size={64} />
            <div style={{ flex: 1 }}>
              <Eyebrow color={C.safe}>
                Proof transaction · signed with both keys
              </Eyebrow>
              <div
                style={{
                  font: `500 27px ${FONT.mono}`,
                  marginTop: 10,
                  wordBreak: "break-all",
                }}
              >
                {data.drill.proofTx}
              </div>
              <div
                style={{
                  font: `400 22px ${FONT.sans}`,
                  color: C.muted,
                  marginTop: 6,
                }}
              >
                Block {data.drill.proofBlock.toLocaleString("en-US")} ·{" "}
                {data.drill.proofTime} · {data.drill.proofQor} QOR into the
                vault · accepted
              </div>
            </div>
          </Card>
        </div>
      ) : null}
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------- 10. close

export const CloseScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { durationInFrames: d } = useVideoConfig();
  const stats = [
    {
      value: Number(data.hybrid.holdsQor),
      dec: 3,
      unit: "QOR",
      label: "still in the vault",
    },
    {
      value: data.hybrid.refusedAttempts,
      dec: 0,
      unit: "",
      label: "theft attempts refused on chain",
    },
    {
      value: Number(data.hybrid.wouldHaveLostQor),
      dec: 3,
      unit: "QOR",
      label: "saved by the second lock alone",
    },
    {
      value: data.attacks.length + 1,
      dec: 0,
      unit: "",
      label: "attacks in the open lab",
    },
  ];
  const logoAt = Math.round(d * 0.22);
  return (
    <AbsoluteFill>
      <Backdrop />
      <div
        style={{
          position: "absolute",
          left: 120,
          right: 120,
          top: 130,
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: 26,
        }}
      >
        {stats.map((s, i) => (
          <div key={s.label} style={{ ...rise(frame, 4 + i * 6, 16) }}>
            <Card
              style={{ padding: "28px 30px" }}
              glow={i === 2 ? C.safe : undefined}
            >
              <div
                style={{
                  font: `700 66px ${FONT.display}`,
                  letterSpacing: "-0.03em",
                  color: i === 2 ? C.safe : C.text,
                }}
              >
                {countUp(frame, 4 + i * 6, 34, s.value).toFixed(s.dec)}
                {s.unit ? (
                  <span
                    style={{
                      font: `500 26px ${FONT.sans}`,
                      color: C.muted,
                      marginLeft: 10,
                    }}
                  >
                    {s.unit}
                  </span>
                ) : null}
              </div>
              <div
                style={{
                  font: `500 22px ${FONT.sans}`,
                  color: C.muted,
                  marginTop: 6,
                }}
              >
                {s.label}
              </div>
            </Card>
          </div>
        ))}
      </div>
      <AbsoluteFill
        style={{
          alignItems: "center",
          justifyContent: "center",
          flexDirection: "column",
          gap: 26,
          paddingTop: 210,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 30,
            ...rise(frame, logoAt, 18),
          }}
        >
          <Logo
            size={120}
            draw={interpolate(frame, [logoAt, logoAt + 30], [0, 1], {
              ...clamp,
              easing: ease,
            })}
          />
          <div
            style={{
              font: `700 96px ${FONT.display}`,
              letterSpacing: "-0.035em",
            }}
          >
            Steal This{" "}
            <span
              style={{
                background: `linear-gradient(95deg, ${C.primary}, ${C.safe})`,
                WebkitBackgroundClip: "text",
                backgroundClip: "text",
                color: "transparent",
              }}
            >
              Vault
            </span>
          </div>
        </div>
        <div
          style={{
            font: `600 40px ${FONT.mono}`,
            color: C.text,
            ...rise(frame, logoAt + 14, 16),
          }}
        >
          {data.site}
        </div>
        <div
          style={{
            font: `500 24px ${FONT.sans}`,
            color: C.faint,
            ...rise(frame, logoAt + 22, 16),
          }}
        >
          Build Before Q-Day · QoreChain Developer Fest · testnet figures as of{" "}
          {data.asOf}
        </div>
      </AbsoluteFill>
      <AbsoluteFill
        style={{ boxShadow: `inset 0 0 200px ${alpha(C.primary, 0.15)}` }}
      />
    </AbsoluteFill>
  );
};
