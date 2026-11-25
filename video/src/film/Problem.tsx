/**
 * Scene 1: the problem. Three everyday ways a private key leaks, each emptying a wallet,
 * then the public ledger that never forgets, then last year's figure with its source.
 * Every drawing here is made in code; the wallet amounts are illustrations, labelled as such.
 */
import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { C, F, PosterLines, clamp, easeInOut, easeOut, micro, posterStyle, rise } from "./kit";
import { cue } from "./timing";

const at = {
  key: cue("problem", /^key\.$/),
  fake: cue("problem", /^fake$/),
  malware: cue("problem", /^Malware$/),
  backup: cue("problem", /^backup$/),
  whoever: cue("problem", /^Whoever$/),
  blockchain: cue("problem", /^blockchain$/),
  last: cue("problem", /^Last$/),
};

/** A wallet balance that drains to zero, turning carmine as it goes. */
function Drain({ start, from }: { start: number; from: number }) {
  const frame = useCurrentFrame();
  const p = interpolate(frame, [start, start + 54], [0, 1], { ...clamp, easing: easeInOut });
  const v = from * (1 - p);
  const gone = p >= 1;
  return (
    <div style={{ display: "grid", gap: 8, width: 360 }}>
      <span style={micro(C.grey, 17)}>Wallet balance · illustration</span>
      <span style={{ fontFamily: F.display, fontWeight: 800, fontVariationSettings: "'wdth' 110", fontSize: 64, lineHeight: 1, color: p > 0 ? C.carmine : C.ink, fontVariantNumeric: "tabular-nums" }}>
        ${v.toLocaleString("en-US", { maximumFractionDigits: 0 })}
      </span>
      <div style={{ height: 8, background: "rgba(20,19,17,0.12)" }}>
        <div style={{ height: 8, width: `${(1 - p) * 100}%`, background: p > 0 ? C.carmine : C.ink }} />
      </div>
      <span style={{ ...micro(C.carmine, 17), opacity: gone ? 1 : 0, fontWeight: 700 }}>Gone. No undo.</span>
    </div>
  );
}

function Phone({ start }: { start: number }) {
  const frame = useCurrentFrame();
  const pop = rise(frame, start + 10, 16);
  const tap = rise(frame, start + 34, 8);
  return (
    <svg width={300} height={520} viewBox="0 0 300 520">
      <rect x={6} y={6} width={288} height={508} rx={40} fill={C.ink} />
      <rect x={20} y={40} width={260} height={440} rx={14} fill={C.paper} />
      <rect x={110} y={18} width={80} height={12} rx={6} fill="#000" />
      {/* the fake address bar */}
      <rect x={34} y={56} width={232} height={32} rx={16} fill={C.paper2} />
      <text x={150} y={77} textAnchor="middle" fontFamily="JetBrains Mono" fontSize={13} fill={C.carmine}>
        wallet-verify-secure.co
      </text>
      {/* the pop-up */}
      <g transform={`translate(150 260) scale(${0.85 + pop * 0.15}) translate(-150 -260)`} opacity={pop}>
        <rect x={40} y={150} width={220} height={220} rx={12} fill={C.ink} />
        <text x={150} y={190} textAnchor="middle" fontFamily="IBM Plex Sans" fontWeight={700} fontSize={19} fill={C.paper}>
          Verify your wallet
        </text>
        <text x={150} y={218} textAnchor="middle" fontFamily="IBM Plex Sans" fontSize={13} fill="rgba(236,231,220,0.75)">
          Enter your recovery phrase
        </text>
        <text x={150} y={236} textAnchor="middle" fontFamily="IBM Plex Sans" fontSize={13} fill="rgba(236,231,220,0.75)">
          to avoid losing access.
        </text>
        {[0, 1, 2].map((r) => (
          <rect key={r} x={60} y={256 + r * 20} width={180} height={12} rx={3} fill="rgba(236,231,220,0.16)" />
        ))}
        <rect x={60} y={322} width={180} height={34} rx={17} fill={tap > 0.5 ? C.carmine : C.violet} />
        <text x={150} y={344} textAnchor="middle" fontFamily="JetBrains Mono" fontWeight={700} fontSize={13} fill={C.paper}>
          VERIFY NOW
        </text>
      </g>
      {/* a fingertip */}
      <circle cx={150} cy={339} r={22 - tap * 6} fill="rgba(91,61,245,0.25)" opacity={tap} />
    </svg>
  );
}

function Laptop({ start }: { start: number }) {
  const frame = useCurrentFrame();
  const crawl = interpolate(frame, [start, start + 60], [0, 1], clamp);
  const lines = 9;
  return (
    <svg width={460} height={360} viewBox="0 0 460 360">
      <rect x={40} y={10} width={380} height={250} rx={14} fill={C.ink} />
      <rect x={56} y={26} width={348} height={218} rx={4} fill="#0b0a09" />
      {Array.from({ length: lines }, (_, i) => (
        <rect key={i} x={72} y={42 + i * 21} width={80 + ((i * 53) % 180)} height={9} rx={2} fill={i === 4 ? C.carmine : "rgba(61,220,151,0.55)"} opacity={i === 4 ? 0.4 + 0.6 * Math.abs(Math.sin(frame / 6)) : 0.8} />
      ))}
      <text x={72} y={236} fontFamily="JetBrains Mono" fontSize={13} fill={C.carmine} opacity={crawl > 0.5 ? 1 : 0}>
        &gt; copying wallet key… sent
      </text>
      <path d="M10 270 H450 L430 300 H30 Z" fill={C.ink} />
      {/* the bug */}
      <g transform={`translate(${70 + crawl * 300} ${120 + Math.sin(crawl * 12) * 30})`}>
        <ellipse cx={0} cy={0} rx={18} ry={24} fill={C.carmine} />
        <circle cx={0} cy={-26} r={10} fill={C.carmine} />
        {[-1, 1].map((s) => [0, 1, 2].map((k) => <line key={`${s}${k}`} x1={0} y1={-10 + k * 12} x2={s * 30} y2={-16 + k * 14} stroke={C.carmine} strokeWidth={4} />))}
      </g>
    </svg>
  );
}

function StickyNote({ start }: { start: number }) {
  const frame = useCurrentFrame();
  const flash = interpolate(frame, [start + 30, start + 34, start + 46], [0, 1, 0], clamp);
  const words = ["lumen", "orbit", "maple", "tide", "velvet", "ember", "quill", "harbor", "sable", "drift", "cobalt", "fern"];
  return (
    <div style={{ position: "relative", width: 380, height: 380 }}>
      <div style={{ position: "absolute", inset: 0, background: "#EADFA8", transform: "rotate(-4deg)", boxShadow: "8px 10px 0 rgba(20,19,17,0.15)", padding: "34px 30px" }}>
        <div style={{ ...micro(C.ink, 15), fontWeight: 700, marginBottom: 14 }}>My wallet words!!</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px 20px", fontFamily: F.mono, fontSize: 21, color: "#2b2a26" }}>
          {words.map((w, i) => (
            <span key={w}>
              {i + 1}. {w}
            </span>
          ))}
        </div>
      </div>
      <div style={{ position: "absolute", left: 170, top: -12, width: 34, height: 34, borderRadius: 17, background: C.carmine }} />
      {/* a phone camera flash: the note ends up in someone's photo backup */}
      <div style={{ position: "absolute", inset: -30, background: "white", opacity: flash * 0.8, borderRadius: 8 }} />
    </div>
  );
}

function Vignette({ start, label, children, amount }: { start: number; label: string; children: React.ReactNode; amount: number }) {
  const frame = useCurrentFrame();
  const p = rise(frame, start - 8, 22);
  return (
    <div style={{ display: "grid", justifyItems: "center", gap: 26, opacity: p, transform: `translateY(${(1 - p) * 60}px)` }}>
      <div style={{ height: 500, display: "grid", alignItems: "center" }}>{children}</div>
      <span style={{ ...micro(C.ink, 22), fontWeight: 700, padding: "8px 14px", border: `2px solid ${C.ink}` }}>{label}</span>
      <Drain start={start + 40} from={amount} />
    </div>
  );
}

/** The public ledger: rows of transactions scrolling forever, all visible to anyone. */
function Ledger({ start }: { start: number }) {
  const frame = useCurrentFrame();
  const p = rise(frame, start, 30);
  const scroll = (frame - start) * 2.2;
  const rows = Array.from({ length: 26 }, (_, i) => {
    const h = ((i * 2654435761) >>> 0).toString(16).padStart(8, "0");
    return `0x${h}${h.split("").reverse().join("")}…  →  0x${(h + "a9").slice(2, 10)}…   ${(((i * 37) % 900) / 10 + 0.1).toFixed(2)}`;
  });
  return (
    <div style={{ position: "absolute", right: 90, top: 150, width: 760, height: 640, opacity: p, background: C.ink, display: "flex", flexDirection: "column" }}>
      <div style={{ ...micro(C.mint, 18), fontWeight: 700, padding: "22px 30px 14px", borderBottom: "1px solid rgba(236,231,220,0.15)", background: C.ink, position: "relative", zIndex: 1 }}>
        Public ledger · anyone can read it · forever
      </div>
      <div style={{ flex: 1, overflow: "hidden", padding: "10px 30px" }}>
      <div style={{ transform: `translateY(${-scroll % 400}px)` }}>
        {[...rows, ...rows].map((r, i) => (
          <div key={i} style={{ fontFamily: F.mono, fontSize: 20, lineHeight: "36px", color: "rgba(236,231,220,0.72)", whiteSpace: "nowrap" }}>
            {r}
          </div>
        ))}
      </div>
      </div>
    </div>
  );
}

export function Problem() {
  const frame = useCurrentFrame();
  // act a: the three leaks; act b: who owns the money, the ledger; act c: the figure
  const leaksOut = interpolate(frame, [at.whoever - 6, at.whoever + 16], [0, 1], { ...clamp, easing: easeInOut });
  const statIn = rise(frame, at.last - 4, 26);
  const ledgerOut = interpolate(frame, [at.last - 6, at.last + 14], [0, 1], { ...clamp, easing: easeInOut });
  const intro = interpolate(frame, [0, 16, at.fake - 18, at.fake - 4], [0, 1, 1, 0], clamp);

  return (
    <AbsoluteFill style={{ background: C.paper }}>
      {/* the opening line: one key guards it all */}
      <AbsoluteFill style={{ justifyContent: "center", paddingLeft: 140, opacity: intro }}>
        <span style={{ ...micro(C.violet, 24), fontWeight: 700, marginBottom: 26 }}>How crypto is guarded today</span>
        <PosterLines at={6} size={150} lines={[{ text: "One key." }, { text: "Your whole", accent: true }, { text: "wallet.", accent: true }]} />
      </AbsoluteFill>

      {/* three leaks */}
      <AbsoluteFill
        style={{
          flexDirection: "row",
          justifyContent: "space-evenly",
          alignItems: "center",
          paddingBottom: 150,
          paddingTop: 20,
          opacity: 1 - leaksOut,
          transform: `translateX(${-leaksOut * 300}px) scale(${1.02 - leaksOut * 0.1})`,
        }}
      >
        {frame >= at.fake - 10 ? (
          <Vignette start={at.fake} label="Phishing" amount={18400}>
            <Phone start={at.fake} />
          </Vignette>
        ) : null}
        {frame >= at.malware - 10 ? (
          <Vignette start={at.malware} label="Malware" amount={52700}>
            <Laptop start={at.malware} />
          </Vignette>
        ) : null}
        {frame >= at.backup - 10 ? (
          <Vignette start={at.backup} label="Careless backup" amount={9300}>
            <StickyNote start={at.backup} />
          </Vignette>
        ) : null}
      </AbsoluteFill>

      {/* whoever holds the key owns the money; the ledger cannot undo it */}
      <AbsoluteFill style={{ opacity: (frame >= at.whoever - 6 ? 1 : 0) * (1 - ledgerOut) }}>
        <div style={{ position: "absolute", left: 110, top: 230, width: 960 }}>
          <PosterLines at={at.whoever} size={92} lines={[{ text: "Whoever holds" }, { text: "the key owns" }, { text: "the money.", accent: true }]} />
          <div style={{ marginTop: 44, opacity: rise(frame, at.blockchain, 18) }}>
            <span style={{ ...posterStyle(64, C.carmine) }}>No undo.</span>
            <p style={{ fontFamily: F.body, fontSize: 30, color: "rgba(20,19,17,0.72)", marginTop: 14, maxWidth: 640 }}>
              A blockchain is public and permanent. A theft is final.
            </p>
          </div>
        </div>
        {frame >= at.whoever ? <Ledger start={at.whoever + 6} /> : null}
      </AbsoluteFill>

      {/* the figure, with its source */}
      <AbsoluteFill style={{ background: C.ink, opacity: statIn, justifyContent: "center", paddingLeft: 140 }}>
        <span style={{ ...micro(C.carmineTint, 26), fontWeight: 700, marginBottom: 20 }}>Stolen from crypto in 2025</span>
        <div style={{ ...posterStyle(300, C.carmine), transform: `scale(${0.94 + 0.06 * statIn})`, transformOrigin: "0 50%" }}>
          ${interpolate(frame, [at.last, at.last + 70], [0, 3.4], { ...clamp, easing: easeOut }).toFixed(1)}B
        </div>
        <p style={{ fontFamily: F.body, fontSize: 34, color: "rgba(236,231,220,0.8)", marginTop: 30, maxWidth: 1100 }}>
          More than three billion dollars, and attacks on individual wallets rose.
        </p>
        <p style={{ ...micro("rgba(236,231,220,0.6)", 19), marginTop: 40 }}>
          Source: Chainalysis, Dec 2025, reported by The Block · theblock.co/post/382477
        </p>
      </AbsoluteFill>
    </AbsoluteFill>
  );
}
