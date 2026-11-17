import React from "react";
import { AbsoluteFill, interpolate, random, useCurrentFrame, useVideoConfig } from "remotion";
import { C, FONT } from "../theme";
import { Vault } from "../components/Vault";
import { Coin } from "../components/Glyphs";
import { Stamp } from "../components/Stamp";
import { clamp, fadeIn, rise } from "../components/anim";

interface Attempt {
  title: string;
  by: string;
  reason: string;
}

/** The eighteen attempts, in the order the runner makes them; wording from the site. */
const ATTEMPTS: Attempt[] = [
  { title: "Send the owner's coins to my wallet", by: "chain", reason: "second signature required" },
  { title: "Add a second key of my own", by: "chain", reason: "not the key on record" },
  { title: "Swap the owner's second lock for mine", by: "chain", reason: "needs both current keys" },
  { title: "Unlock the side door myself", by: "chain", reason: "needs both keys" },
  { title: "Give my own account permission to spend", by: "chain", reason: "needs both keys" },
  { title: "Let my contract take over the account", by: "chain", reason: "needs both keys" },
  { title: "Send the coins the way MetaMask would", by: "door", reason: "not an allowed target" },
  { title: "Approve my wallet to spend the owner's tokens", by: "door", reason: "not an allowed target" },
  { title: "Deploy my own contract as the owner", by: "door", reason: "no allowed target" },
  { title: "Turn the owner's account into my contract", by: "door", reason: "needs hybrid consent" },
  { title: "Move the coins into the weak vault, then rob that", by: "vault", reason: "owner cannot deposit" },
  { title: "Ask the vault for everything", by: "vault", reason: "no second signature" },
  { title: "Hand it a fake second signature", by: "vault", reason: "signature invalid" },
  { title: "Sign with a second key of my own", by: "vault", reason: "not the owner's key" },
  { title: "Send it through someone else", by: "vault", reason: "not authorised" },
  { title: "Replay the owner's last real withdrawal", by: "vault", reason: "already used" },
  { title: "Reuse the owner's real signature for my withdrawal", by: "vault", reason: "signature covers recipient and amount" },
  { title: "Rob the vault with one lock", by: "control", reason: "one lock gave way" },
];

const VISIBLE = 7;
const ROW_H = 96;

/** Scene 4. The feed: 17 refusals slam in, then the one-lock vault is robbed. */
export const AttacksScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { durationInFrames: T } = useVideoConfig();
  const feedStart = Math.round(T * 0.1);
  const feedEnd = Math.round(T * 0.86);
  const step = (feedEnd - feedStart) / ATTEMPTS.length;
  const stampDelay = Math.min(10, Math.round(step * 0.45));

  const shown = Math.min(ATTEMPTS.length, Math.max(0, Math.floor((frame - feedStart) / step) + 1));
  const refused = Math.min(17, Math.max(0, Math.floor((frame - feedStart - stampDelay) / step) + 1));
  const robbedAt = feedStart + 17 * step + stampDelay;
  const robbed = frame >= robbedAt;
  const open = interpolate(frame, [robbedAt, robbedAt + 22], [0, 1], clamp);

  // the two-lock door rattles for a moment after each refusal
  const lastStamp = feedStart + (Math.min(refused, 17) - 1) * step + stampDelay;
  const shake = refused > 0 ? interpolate(frame, [lastStamp, lastStamp + 14], [1, 0], clamp) : 0;

  const scroll = Math.max(0, shown - VISIBLE) * ROW_H;

  return (
    <AbsoluteFill style={{ padding: "90px 100px" }}>
      <div style={{ fontFamily: FONT.serif, fontSize: 60, color: C.text, ...rise(frame, 4) }}>Eighteen ways to steal.</div>
      <div style={{ display: "flex", marginTop: 40, gap: 80, height: 760 }}>
        <div style={{ width: 480, display: "flex", flexDirection: "column", justifyContent: "space-between", alignItems: "center", opacity: fadeIn(frame, 10, 16) }}>
          <Vault size={250} locks={2} shake={shake} glowSecond label="Two locks" />
          <div style={{ position: "relative" }}>
            <Vault size={250} locks={1} open={open} label="One lock" sublabel="the control" />
            {robbed
              ? Array.from({ length: 9 }, (_, i) => {
                  const t = (frame - robbedAt - i * 2) / 30;
                  if (t < 0) return null;
                  const vx = 120 + random(`cx${i}`) * 220;
                  const vy = -(260 + random(`cy${i}`) * 200);
                  const x = vx * t;
                  const y = vy * t + 520 * t * t;
                  return (
                    <div key={i} style={{ position: "absolute", left: 140 + x, top: 110 + y, opacity: interpolate(t, [0.9, 1.4], [1, 0], clamp) }}>
                      <Coin size={30} />
                    </div>
                  );
                })
              : null}
          </div>
        </div>
        <div style={{ flex: 1, overflow: "hidden", position: "relative", maskImage: "linear-gradient(to bottom, transparent 0, black 40px, black 92%, transparent 100%)" }}>
          <div style={{ transform: `translateY(${-scroll}px)`, transition: "none" }}>
            {ATTEMPTS.slice(0, shown).map((a, i) => {
              const at = feedStart + i * step;
              const isControl = a.by === "control";
              return (
                <div key={i} style={{ height: ROW_H, display: "flex", alignItems: "center", gap: 28, borderBottom: `1px solid ${C.lineSoft}`, ...rise(frame, at, 10, 16) }}>
                  <div style={{ width: 54, fontFamily: FONT.mono, fontSize: 22, color: C.faint }}>{String(i + 1).padStart(2, "0")}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontFamily: FONT.sans, fontSize: 30, color: C.text, fontWeight: 500 }}>{a.title}</div>
                    <div style={{ fontFamily: FONT.mono, fontSize: 19, color: isControl ? C.brass : C.muted, marginTop: 4, letterSpacing: "0.04em", opacity: frame >= at + stampDelay ? 1 : 0 }}>
                      {isControl ? "paid out to the stolen key" : `refused by the ${a.by}: ${a.reason}`}
                    </div>
                  </div>
                  <div style={{ width: 230, textAlign: "right" }}>
                    <Stamp text={isControl ? "Robbed" : "Refused"} tone={isControl ? "brass" : "red"} at={at + stampDelay} size={26} tilt={-5} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
      <div style={{ position: "absolute", right: 100, bottom: 60, display: "flex", gap: 48, fontFamily: FONT.mono, fontSize: 26, letterSpacing: "0.08em", opacity: fadeIn(frame, feedStart, 10) }}>
        <span style={{ color: C.red }}>{refused} refused</span>
        <span style={{ color: C.brass }}>{robbed ? 1 : 0} robbed</span>
      </div>
      <div style={{ position: "absolute", left: 660, bottom: 60, fontFamily: FONT.serif, fontSize: 40, color: C.text, ...rise(frame, robbedAt + 28) }}>
        One lock gave way. Two locks held.
      </div>
    </AbsoluteFill>
  );
};
