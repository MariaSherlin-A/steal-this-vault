/**
 * 04: the scoreboard. The same key against two vaults, side by side, then why
 * each attempt failed and the latest ones. Every figure is read from the two
 * contracts' own storage and logs.
 */
import { explorer } from "@stv/core/chain";
import { sortAttempts } from "@stv/core/history";
import { REFUSAL_NAMES, REFUSAL_TEXT } from "@stv/core/refusal";
import { useRef } from "react";
import { VAULTS } from "../lib/clients";
import { blocksAgo, plural, qor, short } from "../lib/format";
import { useRise } from "../lib/motion";
import { useChain } from "../lib/useChain";
import { useHistory } from "../lib/useHistory";
import { Action, Head, Micro } from "./Poster";
import { scene } from "./Theatre";
import { Addr, Ext, Live, Skeleton } from "./ui";

const LIST_CLASS = { refused: "rec--held", owner: "rec--owner", reset: "rec--owner", rehearsal: "rec--robbed", robbed: "rec--robbed" } as const;

function Endings() {
  const { hybrid, classic, block } = useChain();
  const h = hybrid?.stats;
  const c = classic?.stats;
  const ref = useRef<HTMLDivElement>(null);
  useRise(ref);
  return (
    <div className="endings" ref={ref}>
      <article className="ending ending--one" data-rise>
        <header>
          <Micro>VAULT_B // ONE LOCK</Micro>
          <h3>The twin</h3>
        </header>
        <p className="ending-verdict">{c ? (c.paidCount > 0n ? `Robbed ${plural(c.paidCount, "time")}` : "Not robbed yet") : <Skeleton width="8ch" />}</p>
        <dl className="ending-figs">
          <div>
            <dt>Taken with the stolen key</dt>
            <dd>
              <Live value={c ? qor(c.paidTotal) : null} /> <small>QOR</small>
            </dd>
          </div>
          <div>
            <dt>Last robbed</dt>
            <dd className="is-text">{c && block !== null ? blocksAgo(c.lastPaidAt, block) : <Skeleton width="6ch" />}</dd>
          </div>
        </dl>
        <p className="ending-note">
          Same code, same owner, same published key, but it checks that key and nothing else. It is topped up with small amounts so
          the next visitor can rob it too. <Addr value={VAULTS.classic} />
        </p>
      </article>

      <div className="ending-vs" aria-hidden>
        <span>same key</span>
      </div>

      <article className="ending ending--two" data-rise>
        <header>
          <Micro>VAULT_A // TWO LOCKS</Micro>
          <h3>The vault</h3>
        </header>
        <p className="ending-verdict">{h ? (h.balance > 0n ? "Still full" : "Empty") : <Skeleton width="8ch" />}</p>
        <dl className="ending-figs">
          <div>
            <dt>Holding</dt>
            <dd>
              <Live value={h ? qor(h.balance) : null} /> <small>QOR</small>
            </dd>
          </div>
          <div>
            <dt>Thefts refused</dt>
            <dd>
              <Live value={h ? h.refusedCount.toString() : null} width="2ch" />
            </dd>
          </div>
        </dl>
        <p className="ending-note">
          {h && h.paidCount > 0n
            ? `It has paid out ${plural(h.paidCount, "time")}, each time to the owner signing with both keys. `
            : "It pays only when the owner signs with both keys. "}
          <Addr value={VAULTS.hybrid} />
        </p>
      </article>
    </div>
  );
}

export function Score() {
  const { hybrid, block } = useChain();
  const { attempts, status } = useHistory();
  const h = hybrid?.stats;
  const reasons = REFUSAL_NAMES.filter((n) => n !== "None").map((name) => ({ name, count: h?.refusedBy[name] ?? 0n }));
  const most = reasons.reduce((m, r) => (r.count > m ? r.count : m), 0n);
  const latest = sortAttempts(attempts).reverse().slice(0, 7).map(scene);
  const board = useRef<HTMLDivElement>(null);
  useRise(board, [h !== undefined, latest.length]);

  return (
    <section className="sec sec--paper score" id="score">
      <Head
        n="04"
        file="SCOREBOARD.DAT"
        lines={["Same key.", <em key="t">Two endings.</em>]}
        lead="Two vaults built from the same code and guarded by the same published key. One has a single lock, the way wallets work almost everywhere. The other has two."
      />
      <Endings />

      <div className="cf" data-rise>
        <Micro>WHAT ONE LOCK WOULD HAVE COST</Micro>
        <p className="cf-big">
          <Live value={h ? qor(h.counterfactualLoss) : null} width="5ch" />
          <small>QOR</small>
        </p>
        <p className="cf-text">
          {h ? (
            <>
              In {plural(h.counterfactualThefts, "attempt")} the stolen key fitted the first lock. A one-lock vault would have paid out
              this much. The vault keeps this count itself, on the chain.
            </>
          ) : (
            "Reading the vault's own counter."
          )}
        </p>
      </div>

      <div className="board" ref={board}>
        <div className="board-col" data-rise>
          <Micro>// WHY THEY FAILED</Micro>
          {h ? (
            <ul className="bars">
              {reasons.map(({ name, count }) => (
                <li key={name} className={count === 0n ? "bar bar--zero" : "bar"}>
                  <span className="bar-n">{count.toString().padStart(2, "0")}</span>
                  <span className="bar-label">{REFUSAL_TEXT[name].plain}</span>
                  <span className="bar-track" aria-hidden>
                    <span style={{ transform: `scaleX(${most > 0n ? Number(count) / Number(most) : 0})` }} />
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <Skeleton width="100%" />
          )}
        </div>
        <div className="board-col" data-rise>
          <Micro>// LATEST ATTEMPTS</Micro>
          {status !== "live" || block === null ? (
            <p className="muted">{status === "offline" ? "The record could not be read just now." : <Skeleton width="100%" />}</p>
          ) : latest.length === 0 ? (
            <p className="muted">No attempts recorded yet. Yours can be the first.</p>
          ) : (
            <ol className="recs">
              {latest.map((s) => (
                <li key={`${s.attempt.txHash}-${s.attempt.logIndex}`} className={`rec ${LIST_CLASS[s.verdict]}`}>
                  <span className="rec-when">{blocksAgo(s.attempt.blockNumber, block)}</span>
                  <span className="rec-what">
                    {s.head}
                    <small>
                      {s.vault === "hybrid" ? "Two-lock vault" : "One-lock twin"} · {qor(s.attempt.amount)} QOR to{" "}
                      <span className="mono">{short(s.wallet)}</span> ({s.who}) ·{" "}
                      <Ext href={explorer.tx(s.attempt.txHash)}>block {s.attempt.blockNumber.toLocaleString("en-US")}</Ext>
                    </small>
                  </span>
                </li>
              ))}
            </ol>
          )}
          <div className="board-more">
            <Action href="#intruders" tone="line">
              Who they were
            </Action>
          </div>
        </div>
      </div>
    </section>
  );
}
