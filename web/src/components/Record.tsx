/** What the vaults have written down about themselves: why attempts failed, and the latest ones. */
import { explorer } from "@stv/core/chain";
import type { VaultEntry } from "@stv/core/evm";
import { REFUSAL_NAMES, REFUSAL_TEXT } from "@stv/core/refusal";
import { blocksAgo, plural, short } from "../lib/format";
import { useChain } from "../lib/useChain";
import { Ext, Reveal, Skeleton } from "./ui";

type Line = VaultEntry & { vault: "hybrid" | "classic" };

export function Record() {
  const { hybrid, classic, block } = useChain();
  const stats = hybrid?.stats;
  const reasons = REFUSAL_NAMES.filter((name) => name !== "None").map((name) => ({ name, count: stats?.refusedBy[name] ?? 0n }));
  const most = reasons.reduce((m, r) => (r.count > m ? r.count : m), 0n);

  const wall: Line[] = [
    ...(hybrid?.recent ?? []).map((e) => ({ ...e, vault: "hybrid" as const })),
    ...(classic?.recent ?? []).map((e) => ({ ...e, vault: "classic" as const })),
  ]
    .filter((e) => e.blockNumber > 0n)
    .sort((a, b) => (a.blockNumber < b.blockNumber ? 1 : a.blockNumber > b.blockNumber ? -1 : 0))
    .slice(0, 16);

  return (
    <section className="section" id="record">
      <div className="wrap">
        <Reveal className="section-head">
          <p className="eyebrow">The record</p>
          <h2>The vault keeps count.</h2>
          <p className="section-lead">
            Nothing below comes from this website. The vault writes every refusal into its own storage on the chain, where nobody can
            edit it, and this page reads it back every few seconds.
          </p>
        </Reveal>

        <div className="record">
          <Reveal className="panel">
            <h3>Why attempts on the two-lock vault failed</h3>
            {stats ? (
              <ul className="bars">
                {reasons.map(({ name, count }) => (
                  <li key={name} className={count === 0n ? "bar bar--zero" : "bar"}>
                    <div className="bar-label">
                      <span>{REFUSAL_TEXT[name].plain}</span>
                      <strong>{count.toString()}</strong>
                    </div>
                    <div className="bar-track" aria-hidden>
                      <div className="bar-fill" style={{ width: most > 0n ? `${Number((count * 100n) / most)}%` : "0%" }} />
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p>
                <Skeleton width="100%" />
              </p>
            )}
            <p className="panel-note">
              {stats
                ? `${plural(stats.refusedCount, "refusal")} in all. ${plural(stats.keyholderRefusedCount, "was", "were")} made with the published key itself.`
                : "Reading the chain."}
            </p>
          </Reveal>

          <Reveal className="panel" delay={100}>
            <h3>Latest attempts</h3>
            {hybrid === null || block === null ? (
              <p>
                <Skeleton width="100%" />
              </p>
            ) : wall.length === 0 ? (
              <p className="panel-note">No attempts recorded yet. Yours can be the first.</p>
            ) : (
              <ol className="wall">
                {wall.map((e, i) => (
                  <li key={`${e.vault}-${e.blockNumber}-${i}`} className={e.refusal !== "None" ? undefined : e.vault === "classic" ? "wall-robbed" : "wall-paid"}>
                    <span className="wall-when">{blocksAgo(e.blockNumber, block)}</span>
                    <span className="wall-what">
                      {e.refusal !== "None"
                        ? REFUSAL_TEXT[e.refusal].plain
                        : e.vault === "classic"
                          ? "Robbed. The one-lock vault paid out to the stolen key."
                          : "Paid out to the owner, who signed with both keys."}
                      <small>
                        {e.vault === "hybrid" ? "Two-lock vault" : "One-lock vault"} · from <span className="mono">{short(e.caller)}</span>
                        {e.keyholder ? " · with the published key" : ""} ·{" "}
                        <Ext href={explorer.block(e.blockNumber)}>block {e.blockNumber.toLocaleString("en-US")}</Ext>
                      </small>
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </Reveal>
        </div>
      </div>
    </section>
  );
}
