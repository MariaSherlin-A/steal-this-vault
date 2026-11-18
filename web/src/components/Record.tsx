/** What the vaults have written down about themselves: why attempts failed, and the latest ones. */
import { explorer } from "@stv/core/chain";
import { sortAttempts } from "@stv/core/history";
import { REFUSAL_NAMES, REFUSAL_TEXT } from "@stv/core/refusal";
import { blocksAgo, plural, qor, short } from "../lib/format";
import { useChain } from "../lib/useChain";
import { useHistory } from "../lib/useHistory";
import { scene } from "./Theatre";
import { Ext, Reveal, Skeleton } from "./ui";

const WALL_CLASS = { refused: undefined, owner: "wall-paid", reset: "wall-reset", rehearsal: "wall-reset", robbed: "wall-robbed" } as const;

export function Record() {
  const { hybrid, block } = useChain();
  const { attempts, status } = useHistory();
  const stats = hybrid?.stats;
  const reasons = REFUSAL_NAMES.filter((name) => name !== "None").map((name) => ({ name, count: stats?.refusedBy[name] ?? 0n }));
  const most = reasons.reduce((m, r) => (r.count > m ? r.count : m), 0n);

  const wall = sortAttempts(attempts).reverse().slice(0, 16).map(scene);

  return (
    <section className="section" id="record">
      <div className="wrap">
        <Reveal className="section-head">
          <p className="eyebrow">Threat log</p>
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
            {status !== "live" || block === null ? (
              <p>{status === "offline" ? "The record could not be read just now." : <Skeleton width="100%" />}</p>
            ) : wall.length === 0 ? (
              <p className="panel-note">No attempts recorded yet. Yours can be the first.</p>
            ) : (
              <ol className="wall">
                {wall.map((s) => (
                  <li key={`${s.attempt.txHash}-${s.attempt.logIndex}`} className={WALL_CLASS[s.verdict]}>
                    <span className="wall-when">{blocksAgo(s.attempt.blockNumber, block)}</span>
                    <span className="wall-what">
                      {s.head}
                      <small>
                        {s.vault === "hybrid" ? "Two-lock vault" : "One-lock vault"} · {qor(s.attempt.amount)} QOR to{" "}
                        <span className="mono">{short(s.wallet)}</span> ({s.who})
                        {s.attempt.keyholder ? " · with the published key" : ""} ·{" "}
                        <Ext href={explorer.tx(s.attempt.txHash)}>block {s.attempt.blockNumber.toLocaleString("en-US")}</Ext>
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
