/**
 * The intruder file: one card per wallet that came for the money, built from
 * every attempt the vaults ever logged, with the stolen money followed on chain.
 */
import { explorer } from "@stv/core/chain";
import type { Intruder, Method } from "@stv/core/history";
import { REFUSAL_TEXT } from "@stv/core/refusal";
import { useEffect, useState } from "react";
import { loadLab } from "../lib/clients";
import type { Trail } from "../lib/lab";
import { blocksAgo, plural, qor, short, uqorToQor } from "../lib/format";
import { useChain } from "../lib/useChain";
import { useHistory } from "../lib/useHistory";
import { Addr, Ext, Reveal, Skeleton } from "./ui";

function methodText(method: Method): string {
  return method === "Robbed" ? "Robbed the one-lock vault." : REFUSAL_TEXT[method].plain;
}

/** A qor1... address with its plain name when it is one the project knows. */
function Who({ address, names }: { address: string; names: Record<string, string> }) {
  const name = names[address];
  return (
    <>
      <Ext href={explorer.address(address)} className="mono">
        {short(address, 8, 5)}
      </Ext>
      {name ? <span className="who-name"> ({name})</span> : <span className="who-name"> (a stranger)</span>}
    </>
  );
}

function MoneyTrail({ intruder }: { intruder: Intruder }) {
  const [trail, setTrail] = useState<Trail | null | "failed">(null);
  const [names, setNames] = useState<Record<string, string>>({});

  useEffect(() => {
    let gone = false;
    loadLab()
      .then(async (lab) => {
        setNames(lab.KNOWN_NATIVE);
        return lab.followTrail(intruder.address, intruder.firstBlock);
      })
      .then((t) => {
        if (!gone) setTrail(t);
      })
      .catch(() => {
        if (!gone) setTrail("failed");
      });
    return () => {
      gone = true;
    };
  }, [intruder.address, intruder.firstBlock, intruder.lastBlock]);

  if (trail === null) {
    return (
      <p className="trail-note">
        <Skeleton width="100%" />
      </p>
    );
  }
  if (trail === "failed") return <p className="trail-note">The money trail could not be read just now.</p>;

  return (
    <ol className="trail">
      <li>
        <span className="trail-step">Funded by</span>
        <span>
          {trail.funding ? (
            <>
              <Who address={trail.funding.from} names={names} />, {uqorToQor(trail.funding.uqor)} QOR at{" "}
              <Ext href={explorer.tx(trail.funding.hash)}>block {trail.funding.height.toLocaleString("en-US")}</Ext>
            </>
          ) : (
            "nobody yet. This wallet has never received anything."
          )}
        </span>
      </li>
      {trail.hops.map((hop) => (
        <li key={hop.hash + hop.to}>
          <span className="trail-step">Then paid</span>
          <span>
            {uqorToQor(hop.uqor)} QOR to <Who address={hop.to} names={names} /> at{" "}
            <Ext href={explorer.tx(hop.hash)}>block {hop.height.toLocaleString("en-US")}</Ext>
          </span>
        </li>
      ))}
      <li>
        <span className="trail-step">{trail.hops.length === 0 ? "Still there" : trail.cut ? "Trail cut" : "Ends at"}</span>
        <span>
          {trail.hops.length === 0 ? (
            <>The money has not left this wallet, which holds {uqorToQor(trail.holdsUqor)} QOR now.</>
          ) : (
            <>
              <Who address={trail.endsAt} names={names} /> holds {uqorToQor(trail.holdsUqor)} QOR now.
            </>
          )}
        </span>
      </li>
    </ol>
  );
}

function IntruderCard({ intruder, block, delay }: { intruder: Intruder; block: bigint; delay: number }) {
  const methods = Object.entries(intruder.methods) as [Method, number][];
  const stranger = intruder.label === null;
  return (
    <Reveal className={intruder.robbed > 0 ? "panel intruder intruder--robbed" : "panel intruder"} delay={delay}>
      <header className="intruder-head">
        <div>
          <p className="eyebrow">{stranger ? "Stranger" : "Known"}</p>
          <h3>
            <Addr value={intruder.address} />
          </h3>
          <p className="intruder-sub">{intruder.label ?? "Where this intruder wanted the money sent."}</p>
        </div>
        <div className="intruder-count">
          <strong>{intruder.attempts.length}</strong>
          <span>{plural(intruder.attempts.length, "attempt").replace(/^\d+ /, "")}</span>
        </div>
      </header>

      <dl className="kv">
        <dt>Seen</dt>
        <dd>
          {blocksAgo(intruder.firstBlock, block) === blocksAgo(intruder.lastBlock, block)
            ? blocksAgo(intruder.lastBlock, block)
            : `${blocksAgo(intruder.firstBlock, block)} to ${blocksAgo(intruder.lastBlock, block)}`}
        </dd>
        <dt>Wanted</dt>
        <dd>{intruder.refused > 0 ? `${qor(intruder.wantedWei)} QOR over ${plural(intruder.refused, "refused attempt")}` : "nothing was refused"}</dd>
        <dt>Took</dt>
        <dd className={intruder.robbed > 0 ? "took" : undefined}>
          {intruder.robbed > 0 ? `${qor(intruder.tookWei)} QOR from the one-lock vault, ${plural(intruder.robbed, "robbery", "robberies")}` : "nothing"}
        </dd>
        <dt>Published key</dt>
        <dd>{intruder.withPublishedKey > 0 ? `used in ${plural(intruder.withPublishedKey, "attempt")}` : "not used"}</dd>
        <dt>Sent from</dt>
        <dd>
          {intruder.callers.map((c, i) => (
            <span key={c}>
              {i > 0 ? ", " : ""}
              <Addr value={c} />
            </span>
          ))}
        </dd>
      </dl>

      <h4>Methods</h4>
      <ul className="methods">
        {methods.map(([m, n]) => (
          <li key={m} className={m === "Robbed" ? "method method--robbed" : "method"}>
            <span>{methodText(m)}</span>
            <strong>{n}</strong>
          </li>
        ))}
      </ul>

      {stranger ? (
        <>
          <h4>The money</h4>
          <MoneyTrail intruder={intruder} />
        </>
      ) : (
        <p className="trail-note">One of the project's own accounts, used in rehearsals. Nothing to follow.</p>
      )}
    </Reveal>
  );
}

export function Intruders() {
  const { block } = useChain();
  const { status, file, upTo } = useHistory();
  const strangers = file?.intruders.filter((i) => i.label === null).length ?? 0;

  return (
    <section className="section" id="intruders">
      <div className="wrap">
        <Reveal className="section-head">
          <p className="eyebrow">The intruder file</p>
          <h2>Every thief leaves a trail.</h2>
          <p className="section-lead">
            A stolen key is not just a loss. Each attempt tells the vault where the thief wanted the money sent, and the chain
            remembers who funded that wallet and where the money went next. This page reads all of it back, from the day the
            vaults were built.
          </p>
        </Reveal>

        {file === null || block === null ? (
          <Reveal className="panel">
            <p>
              {status === "offline" ? "The attempt history could not be read just now." : <Skeleton width="100%" />}
            </p>
          </Reveal>
        ) : file.intruders.length === 0 ? (
          <Reveal className="panel">
            <p className="panel-note">Nobody has come for the money yet. Your attempt in the lab above would open the first file.</p>
          </Reveal>
        ) : (
          <>
            <Reveal className="file-summary">
              <p>
                <strong>{plural(file.intruders.length, "wallet")}</strong> came for the money, {strangers === file.intruders.length ? "all" : strangers} of them
                strangers. The owner's own {plural(file.ownerWithdrawals, "withdrawal")} from the two-lock vault and{" "}
                {plural(file.ownerCleanouts, "clean-out")} of the bait money are not thefts and are left out.
                {upTo ? <span className="file-upto"> Complete to block {upTo.toLocaleString("en-US")}.</span> : null}
              </p>
            </Reveal>
            <div className="intruders">
              {file.intruders.map((i, n) => (
                <IntruderCard key={i.address} intruder={i} block={block} delay={Math.min(n, 3) * 80} />
              ))}
            </div>
          </>
        )}

        <Reveal className="file-note">
          <h3>What this can and cannot tell you</h3>
          <p>
            Everything here comes from the chain and can be checked on the explorer. It shows wallets, amounts and times. It never
            shows a person: a wallet address is not a name, and the trail stops where the money does. Treat it as leads for an
            investigator, the kind a vault with one lock could never give you, because that vault would simply be empty.
          </p>
        </Reveal>
      </div>
    </section>
  );
}
