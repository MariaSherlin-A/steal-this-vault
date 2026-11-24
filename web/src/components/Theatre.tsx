/**
 * The replay: the latest real attempts from the vaults' own record, played back
 * one by one. The key flies at the vault, each lock answers, the verdict lands.
 * Nothing here is invented: every step comes from an attempt logged on chain.
 */
import { explorer } from "@stv/core/chain";
import { worthAlerting } from "@stv/core/alerts";
import { fingerprint, labelFor, sortAttempts, type Attempt } from "@stv/core/history";
import { REFUSAL_TEXT } from "@stv/core/refusal";
import { useEffect, useMemo, useState } from "react";
import { blocksAgo, qor, short } from "../lib/format";
import { useChain } from "../lib/useChain";
import { KNOWN, useHistory } from "../lib/useHistory";
import { KeyIcon, LockIcon, LockShieldIcon } from "./icons";
import { Head } from "./Poster";
import { Ext, Live, Skeleton } from "./ui";

const same = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();
const REEL = 14;
/** When each phase starts, in ms: the key flies in, lock one answers, lock two answers, the verdict. */
const PHASES = [0, 450, 900, 1350];
const STEP = 2700;

type LockState = "idle" | "pass" | "fail";
type Verdict = "refused" | "owner" | "reset" | "rehearsal" | "robbed";

export interface Scene {
  attempt: Attempt;
  vault: "hybrid" | "classic";
  lock1: LockState;
  lock2: LockState;
  verdict: Verdict;
  head: string;
  who: string;
  wallet: string;
}

export function scene(a: Attempt): Scene {
  const vault = same(a.vault, KNOWN.hybrid) ? "hybrid" : "classic";
  const wallet = fingerprint(a, KNOWN);
  const lock1: LockState = a.keyholder ? "pass" : "fail";
  let lock2: LockState = "idle";
  if (vault === "hybrid") {
    if (a.kind === "paid") lock2 = "pass";
    else if (a.refusal.startsWith("Pq")) lock2 = "fail";
  }
  let verdict: Verdict;
  let head: string;
  if (a.kind === "refused") {
    verdict = "refused";
    head = `Refused. ${REFUSAL_TEXT[a.refusal].plain}`;
  } else if (vault === "hybrid") {
    verdict = "owner";
    head = "Paid to the owner, who signed with both keys.";
  } else if (same(wallet, KNOWN.owner)) {
    verdict = "reset";
    head = "The owner took the bait money back. Not a theft.";
  } else if (same(wallet, KNOWN.deployer)) {
    verdict = "rehearsal";
    head = "Robbed in a rehearsal, by the project's own test account.";
  } else {
    verdict = "robbed";
    head = "Robbed. One lock was not enough.";
  }
  return { attempt: a, vault, lock1, lock2, verdict, head, who: labelFor(wallet, KNOWN) ?? "a stranger", wallet };
}

function Lock({ label, state, shield }: { label: string; state: LockState; shield?: boolean }) {
  return (
    <li className="th-lock" data-state={state}>
      <span className="th-lock-icon">{shield ? <LockShieldIcon size={18} /> : <LockIcon size={18} />}</span>
      <span className="th-lock-label">{label}</span>
      <span className="th-lock-state">{state === "pass" ? "key fits" : state === "fail" ? "holds" : ""}</span>
    </li>
  );
}

function VaultStage({
  kind,
  balance,
  current,
  phase,
}: {
  kind: "hybrid" | "classic";
  balance: string | null;
  current: Scene | null;
  phase: number;
}) {
  const active = current?.vault === kind ? current : null;
  const l1 = active && phase >= 1 ? active.lock1 : "idle";
  const l2 = active && phase >= 2 ? active.lock2 : "idle";
  const verdict = active && phase >= 3 ? active.verdict : null;
  return (
    <div className={`th-vault th-vault--${kind}`} data-active={active ? "yes" : "no"} data-verdict={verdict ?? "none"}>
      <div className="th-vault-head">
        <span className="eyebrow">{kind === "hybrid" ? "Two locks" : "One lock"}</span>
        <h3>{kind === "hybrid" ? "The vault" : "Its one-lock twin"}</h3>
      </div>
      <div className="th-door" aria-hidden>
        <div className="th-dial" />
        {active ? (
          <span className="th-key" data-phase={phase} key={`${active.attempt.txHash}-${active.attempt.logIndex}`}>
            <KeyIcon size={20} />
          </span>
        ) : null}
        {verdict ? (
          <span className={`th-stamp th-stamp--${verdict === "refused" ? "held" : verdict === "owner" || verdict === "reset" ? "owner" : "robbed"}`}>
            {verdict === "refused" ? "Refused" : verdict === "owner" ? "Paid to owner" : verdict === "reset" ? "Owner took it back" : "Robbed"}
          </span>
        ) : null}
        <span className="th-coins">
          <i />
          <i />
          <i />
          <i />
          <i />
        </span>
      </div>
      <ul className="th-locks">
        <Lock label="Ordinary key" state={l1} />
        {kind === "hybrid" ? <Lock label="Quantum-safe key" state={l2} shield /> : null}
      </ul>
      <p className="th-balance">
        Holds now <strong><Live value={balance} width="5ch" /></strong> QOR
      </p>
    </div>
  );
}

export function Theatre() {
  const { hybrid, classic, block } = useChain();
  const { attempts, status } = useHistory();
  // Only break-in attempts: the owner's own withdrawals and bait clean-ups are not attacks (the same rule the alerts use).
  const reel = useMemo(() => sortAttempts(attempts).filter((a) => worthAlerting(a, KNOWN)).slice(-REEL).map(scene), [attempts]);
  const [index, setIndex] = useState(0);
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    if (reel.length === 0) return;
    const timers = PHASES.map((at, p) => window.setTimeout(() => setPhase(p), at));
    timers.push(window.setTimeout(() => setIndex((i) => (i + 1) % reel.length), STEP));
    return () => timers.forEach((t) => window.clearTimeout(t));
  }, [index, reel.length]);

  const current = reel.length > 0 ? reel[index % reel.length]! : null;
  const a = current?.attempt;

  return (
    <section className="sec sec--ink theatre" id="replay">
      <Head
        n="03"
        file="REPLAY.LOG"
        lines={["Watch them", <em key="f">fail.</em>]}
        lead="Real break-in attempts on both vaults, replayed from the record the vaults keep on the chain. The stolen key opens the first lock every time. The second lock refuses it."
      />
      <div className="th-wrap">
        <p className="th-target" aria-live="polite">
          {current ? (
            <>
              <span className="micro">Now attacking</span>
              <b>{current.vault === "hybrid" ? "The vault · two locks" : "The one-lock twin · comparison"}</b>
              <span aria-hidden>{current.vault === "hybrid" ? "←" : "→"}</span>
            </>
          ) : (
            <span className="micro">Waiting for the record</span>
          )}
        </p>
        <div className="th-stage">
          <VaultStage kind="hybrid" balance={hybrid ? qor(hybrid.stats.balance) : null} current={current} phase={phase} />
          <VaultStage kind="classic" balance={classic ? qor(classic.stats.balance) : null} current={current} phase={phase} />
        </div>

        <div className="th-caption" aria-live="polite">
          {current && a && block !== null ? (
            <div className="th-caption-body" key={`${a.txHash}-${a.logIndex}`} data-verdict={phase >= 3 ? current.verdict : "pending"}>
              <p className="th-head">{phase >= 3 ? current.head : `Someone tries the ${current.vault === "hybrid" ? "vault" : "one-lock twin"}...`}</p>
              <p className="th-meta">
                Wanted {qor(a.amount)} QOR, to <span className="mono">{short(current.wallet)}</span> ({current.who})
                {a.keyholder ? ", holding the published key" : ""} · {blocksAgo(a.blockNumber, block)} ·{" "}
                <Ext href={explorer.tx(a.txHash)}>see it on the explorer</Ext>
              </p>
            </div>
          ) : status === "offline" ? (
            <p className="th-head">The record could not be read just now.</p>
          ) : status === "live" ? (
            <p className="th-head">No attempts yet. Yours could be the first.</p>
          ) : (
            <p className="th-head">
              <Skeleton width="60%" />
            </p>
          )}
          {reel.length > 0 ? (
            <div className="th-progress">
              <ol aria-label={`Attempt ${index + 1} of ${reel.length}`}>
                {reel.map((s, n) => (
                  <li key={`${s.attempt.txHash}-${s.attempt.logIndex}`} data-on={n === index ? "yes" : "no"} data-verdict={s.verdict} />
                ))}
              </ol>
              <span>
                Replay of the {reel.length} latest real break-in attempts · <a href="#lab">try your own</a>
              </span>
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
