/** Two vaults, one difference. Every number is read from the two contracts. */
import type { VaultStats } from "@stv/core/evm";
import { VAULTS } from "../lib/clients";
import { blocksAgo, plural, qor } from "../lib/format";
import { useChain } from "../lib/useChain";
import { Addr, Live, Reveal } from "./ui";

function VaultDoor({ two }: { two: boolean }) {
  const ticks = Array.from({ length: 36 }, (_, i) => (i * 10 * Math.PI) / 180);
  return (
    <svg viewBox="0 0 200 200" className={`door ${two ? "door--two" : "door--one"}`} aria-hidden>
      <circle cx="100" cy="100" r="94" className="door-rim" />
      <circle cx="100" cy="100" r="78" className="door-face" />
      {ticks.map((a, i) => (
        <line
          key={i}
          className="door-tick"
          x1={100 + 82 * Math.cos(a)}
          y1={100 + 82 * Math.sin(a)}
          x2={100 + (i % 3 === 0 ? 90 : 87) * Math.cos(a)}
          y2={100 + (i % 3 === 0 ? 90 : 87) * Math.sin(a)}
        />
      ))}
      <g className="door-wheel">
        {[0, 60, 120].map((deg) => (
          <line key={deg} x1="62" y1="100" x2="138" y2="100" transform={`rotate(${deg} 100 100)`} className="door-spoke" />
        ))}
        <circle cx="100" cy="100" r="24" className="door-hub" />
        <circle cx="100" cy="100" r="5" className="door-pin" />
      </g>
      <g className="door-lock door-lock--a">
        <circle cx="100" cy="36" r="9" />
        <path d="M100 33.5a2.2 2.2 0 0 1 1.2 4l.8 3h-4l.8-3a2.2 2.2 0 0 1 1.2-4Z" />
      </g>
      {two && (
        <g className="door-lock door-lock--b">
          <circle cx="100" cy="164" r="9" />
          <path d="M100 161.5a2.2 2.2 0 0 1 1.2 4l.8 3h-4l.8-3a2.2 2.2 0 0 1 1.2-4Z" />
        </g>
      )}
    </svg>
  );
}

function Stat({ label, value, unit }: { label: string; value: string | null; unit?: string }) {
  return (
    <div className="stat">
      <dt>{label}</dt>
      <dd>
        <Live value={value} /> {unit && <small>{unit}</small>}
      </dd>
    </div>
  );
}

function last(stats: VaultStats | undefined, block: bigint | null, at: "lastPaidAt" | "lastRefusedAt"): string | null {
  if (!stats || block === null) return null;
  return blocksAgo(stats[at], block);
}

export function Experiment() {
  const { hybrid, classic, block } = useChain();
  const h = hybrid?.stats;
  const c = classic?.stats;
  return (
    <section className="section" id="experiment">
      <div className="wrap">
        <Reveal className="section-head">
          <p className="eyebrow">Live comparison</p>
          <h2>Two vaults. One key. One difference.</h2>
          <p className="section-lead">
            Both vaults run the same code, belong to the same owner, and are guarded by the same published key. The one on the left
            checks that key and nothing else, the way vaults work on other chains. The one on the right also asks for a quantum-safe
            signature, which the thief does not have.
          </p>
        </Reveal>

        <div className="vaults">
          <Reveal className="vault vault--one">
            <div className="vault-top">
              <VaultDoor two={false} />
              <div>
                <p className="vault-kind">One lock</p>
                <h3>The control vault</h3>
                <p className={`verdict ${c && c.paidCount > 0n ? "verdict--robbed" : ""}`}>
                  {c ? (c.paidCount > 0n ? `Robbed ${plural(c.paidCount, "time")}` : "Not robbed yet") : "Reading the chain"}
                </p>
              </div>
            </div>
            <dl className="stats">
              <Stat label="Taken with the stolen key" value={c ? qor(c.paidTotal) : null} unit="QOR" />
              <Stat label="Left inside" value={c ? qor(c.balance) : null} unit="QOR" />
              <Stat label="Last robbed" value={last(c, block, "lastPaidAt")} />
            </dl>
            <p className="vault-note">
              It is topped up with small amounts so the next visitor can rob it too. <Addr value={VAULTS.classic} />
            </p>
          </Reveal>

          <div className="versus" aria-hidden>
            <span>same key</span>
          </div>

          <Reveal className="vault vault--two" delay={120}>
            <div className="vault-top">
              <VaultDoor two />
              <div>
                <p className="vault-kind">Two locks</p>
                <h3>The hybrid vault</h3>
                <p className="verdict verdict--held">
                  {h ? (h.balance > 0n ? "Still full" : "Empty") : "Reading the chain"}
                </p>
              </div>
            </div>
            <dl className="stats">
              <Stat label="Holding" value={h ? qor(h.balance) : null} unit="QOR" />
              <Stat label="Refused with the stolen key" value={h ? plural(h.keyholderRefusedCount, "attempt") : null} />
              <Stat label="Last attempt refused" value={last(h, block, "lastRefusedAt")} />
            </dl>
            <p className="vault-note">
              {h && h.paidCount > 0n
                ? `Paid out ${plural(h.paidCount, "time")}, ${qor(h.paidTotal)} QOR in all, each time to the owner signing with both keys. `
                : "It pays only when the owner signs with both keys. "}
              <Addr value={VAULTS.hybrid} />
            </p>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
