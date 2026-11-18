/**
 * The attack lab. Every button runs the same runner the command-line tool uses
 * (`@stv/core/attacks`), with the published key, against the live testnet.
 */
import { ATTACKS, GROUPS, type AttackGroup, type AttackInfo } from "@stv/core/attack-list";
import type { AttackResult } from "@stv/core/attacks";
import { useCallback, useRef, useState } from "react";
import { loadLab } from "../lib/clients";
import { explain, modeLabel, recordsLeft, tally } from "../lib/explain";
import { qor } from "../lib/format";
import { useChain } from "../lib/useChain";
import { useWallet } from "../lib/useWallet";
import { BugIcon, CheckIcon, CrossIcon, DoorIcon, InfoIcon, KeyIcon, ReloadIcon, VaultIcon, WarnShieldIcon } from "./icons";
import { Ext, Reveal } from "./ui";

const ORDER: AttackGroup[] = ["native", "evm", "vault", "control"];
const GROUP_ICON = { native: KeyIcon, evm: DoorIcon, vault: VaultIcon, control: BugIcon } as const;
/** Attempts that reach a vault. Recording them on chain spends the owner's fee allowance. */
const RECORDED_PER_RUN = ATTACKS.filter((a) => a.group === "vault" || a.group === "control").length;

type Busy = { id: string | null; done: number; total: number };

function Row({
  info,
  result,
  running,
  disabled,
  onTry,
}: {
  info: AttackInfo;
  result: AttackResult | undefined;
  running: boolean;
  disabled: boolean;
  onTry: () => void;
}) {
  const told = result ? explain(result, info) : null;
  const mode = result ? modeLabel(result.mode) : null;
  return (
    <li className={`attack ${told ? `attack--${told.tone}` : ""} ${running ? "attack--running" : ""}`}>
      <div className="attack-main">
        <div className="attack-text">
          <h4>{info.title}</h4>
          <p>{info.plain}</p>
        </div>
        <div className="attack-side">
          {told && (
            <span className={`stamp stamp--${told.tone}`}>
              {told.tone === "held" ? <CheckIcon size={13} /> : told.tone === "skipped" ? <InfoIcon size={13} /> : <CrossIcon size={13} />}
              {told.stamp}
            </span>
          )}
          <button type="button" className="btn btn--ghost btn--small" onClick={onTry} disabled={disabled}>
            {running ? "Trying" : result ? "Again" : "Try it"}
          </button>
        </div>
      </div>
      {running && <div className="attack-progress" aria-hidden />}
      {result && told && mode && (
        <div className="attack-result">
          <p className="attack-plain">
            <strong>{told.who}.</strong> {told.plain}
          </p>
          <p className="attack-mode">
            {mode.short}
            {result.txHash && result.explorerUrl && (
              <>
                {" · "}
                <Ext href={result.explorerUrl}>see the transaction</Ext>
              </>
            )}
          </p>
          <details>
            <summary>Details</summary>
            <dl className="kv">
              <dt>What was sent</dt>
              <dd>{info.technical}</dd>
              <dt>The answer, word for word</dt>
              <dd className="mono">{result.detail}</dd>
              {result.code && (
                <>
                  <dt>Code</dt>
                  <dd className="mono">{result.code}</dd>
                </>
              )}
              <dt>How it was checked</dt>
              <dd>{mode.long}</dd>
              {result.note && (
                <>
                  <dt>Note</dt>
                  <dd>{result.note}</dd>
                </>
              )}
              <dt>Time taken</dt>
              <dd>{(result.ms / 1000).toFixed(1)} s</dd>
            </dl>
          </details>
        </div>
      )}
    </li>
  );
}

export function Lab() {
  const chain = useChain();
  const { wallet } = useWallet();
  const [results, setResults] = useState<Record<string, AttackResult>>({});
  const [busy, setBusy] = useState<Busy | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [choice, setChoice] = useState<boolean | null>(null);
  const [before, setBefore] = useState<bigint | null>(null);
  const stop = useRef(false);

  const room = recordsLeft(chain.door);
  const canRecord = room >= 1;
  const record = canRecord && (choice ?? room >= RECORDED_PER_RUN);

  const run = useCallback(
    async (ids: string[]) => {
      if (busy) return;
      stop.current = false;
      setFailure(null);
      setBusy({ id: null, done: 0, total: ids.length });
      if (ids.length > 1) setBefore(chain.hybrid?.stats.balance ?? null);
      try {
        const lab = await loadLab();
        const ctx = lab.attackContext(wallet?.evm ?? lab.throwawayAddress(), record);
        for (const [i, id] of ids.entries()) {
          if (stop.current) break;
          setBusy({ id, done: i, total: ids.length });
          const result = await lab.runAttack(ctx, id);
          setResults((prev) => ({ ...prev, [id]: result }));
        }
      } catch {
        setFailure("The thief’s tools did not load. Check your connection and try again.");
      } finally {
        setBusy(null);
        chain.refresh();
      }
    },
    [busy, chain, record, wallet],
  );

  const done = ATTACKS.filter((a) => results[a.id]);
  const score = tally(done.map((a) => explain(results[a.id]!, a).tone));
  const now = chain.hybrid?.stats.balance ?? null;

  return (
    <section className="section section--lab" id="lab">
      <div className="wrap">
        <Reveal className="section-head">
          <p className="eyebrow">Attack lab</p>
          <h2>You have the key. Go on, then.</h2>
          <p className="section-lead">
            These are {ATTACKS.length} things a thief can do with a stolen key. Each button really does it: your browser signs with the
            published key and sends the attempt to the live network. Nothing here is a recording.
          </p>
        </Reveal>

        <div className="lab-bar">
          <div className="lab-actions">
            {busy ? (
              <button type="button" className="btn btn--primary" onClick={() => (stop.current = true)}>
                Stop after this one ({busy.done}/{busy.total})
              </button>
            ) : (
              <button type="button" className="btn btn--primary" onClick={() => void run(ATTACKS.map((a) => a.id))}>
                <ReloadIcon size={16} /> {done.length ? "Run all again" : `Run all ${ATTACKS.length}`}
              </button>
            )}
            <span className="lab-hint">Takes about two minutes. Or try them one at a time.</span>
          </div>
          <label className={`switch ${canRecord ? "" : "switch--off"}`}>
            <input type="checkbox" checked={record} disabled={!canRecord || busy !== null} onChange={(e) => setChoice(e.target.checked)} />
            <span className="switch-track" aria-hidden />
            <span className="switch-text">
              <strong>Write my attempts into the public record</strong>
              <small>
                {chain.door === null
                  ? "Checking whether the side door is open."
                  : canRecord
                    ? `Room for about ${room} more right now. When off, the vault is still asked for real, but nothing is written.`
                    : chain.door.open
                      ? "The owner’s fee allowance is used up for now, so attempts are checked live without being written."
                      : "The side door is shut right now, so attempts are checked live without being written."}
              </small>
            </span>
          </label>
        </div>

        {failure && (
          <p className="notice notice--alarm" role="alert">
            <WarnShieldIcon size={16} /> {failure}
          </p>
        )}

        {done.length > 0 && (
          <div className={`scorecard ${score.alarms ? "scorecard--alarm" : ""}`} role="status">
            <div>
              <strong>{score.held}</strong>
              <span>{score.held === 1 ? "theft" : "thefts"} refused</span>
            </div>
            <div>
              <strong>{score.robbed}</strong>
              <span>{score.robbed === 1 ? "time" : "times"} the one-lock vault gave way</span>
            </div>
            <div>
              <strong>{score.alarms}</strong>
              <span>got into the two-lock vault</span>
            </div>
            <p>
              {before !== null && now !== null
                ? `The two-lock vault held ${qor(before)} QOR before your run. It holds ${qor(now)} QOR now.`
                : now !== null
                  ? `The two-lock vault holds ${qor(now)} QOR.`
                  : ""}
              {score.skipped > 0 && ` ${score.skipped} could not be tried just now; each says why.`}
            </p>
          </div>
        )}

        {ORDER.map((group) => {
          const Icon = GROUP_ICON[group];
          return (
            <Reveal key={group} className="group">
              <div className="group-head">
                <span className="group-icon" aria-hidden>
                  <Icon size={18} />
                </span>
                <div>
                  <h3>{GROUPS[group].title}</h3>
                  <p>{GROUPS[group].plain}</p>
                </div>
              </div>
              <ul className="attacks">
                {ATTACKS.filter((a) => a.group === group).map((info) => (
                  <Row
                    key={info.id}
                    info={info}
                    result={results[info.id]}
                    running={busy?.id === info.id}
                    disabled={busy !== null}
                    onTry={() => void run([info.id])}
                  />
                ))}
              </ul>
            </Reveal>
          );
        })}
      </div>
    </section>
  );
}
