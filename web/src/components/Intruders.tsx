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
import { Head } from "./Poster";

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

/** The card's opening line: what this wallet did, in one plain sentence. */
function story(i: Intruder): string {
  const tries = plural(i.attempts.length, "time");
  const key = i.withPublishedKey === i.attempts.length ? ", every time with the published key" : i.withPublishedKey > 0 ? `, ${i.withPublishedKey} of them with the published key` : "";
  const who = i.label === null ? "A stranger" : "The project's own test account";
  const refused = i.refused > 0 ? ` The vaults refused ${i.refused === i.attempts.length ? "every one" : plural(i.refused, "try", "tries")}.` : "";
  const took =
    i.robbed > 0
      ? ` The only thing taken was ${qor(i.tookWei)} QOR, from the unprotected one-lock twin; the two-lock vault gave nothing.`
      : " Nothing was taken.";
  return `${who} tried ${tries}${key}.${refused}${took}`;
}

function IntruderCard({ intruder, block, delay }: { intruder: Intruder; block: bigint; delay: number }) {
  const methods = Object.entries(intruder.methods) as [Method, number][];
  const stranger = intruder.label === null;
  return (
    <Reveal className={intruder.robbed > 0 ? "panel intruder intruder--robbed" : "panel intruder"} delay={delay}>
      <header className="intruder-head">
        <span className={`intruder-tag ${stranger ? "intruder-tag--stranger" : ""}`}>{stranger ? "Stranger" : "Known"}</span>
        <Addr value={intruder.address} />
      </header>

      <p className="intruder-story">{story(intruder)}</p>

      <dl className="intruder-tally">
        <div>
          <dt>Tries</dt>
          <dd>{intruder.attempts.length}</dd>
        </div>
        <div className="is-held">
          <dt>Refused</dt>
          <dd>{intruder.refused}</dd>
        </div>
        <div className={intruder.robbed > 0 ? "is-took" : undefined}>
          <dt>Taken</dt>
          <dd>
            {intruder.robbed > 0 ? qor(intruder.tookWei) : "0"} <small>QOR</small>
          </dd>
          {intruder.robbed > 0 ? <p>from the one-lock twin, not the vault</p> : null}
        </div>
      </dl>

      {stranger ? (
        <>
          <h4>Where the money went</h4>
          <MoneyTrail intruder={intruder} />
        </>
      ) : (
        <p className="trail-note">Used by the project in rehearsals, so there is no money to follow.</p>
      )}

      <details className="intruder-details">
        <summary>Details</summary>
        <dl className="kv">
          <dt>Seen</dt>
          <dd>
            {blocksAgo(intruder.firstBlock, block) === blocksAgo(intruder.lastBlock, block)
              ? blocksAgo(intruder.lastBlock, block)
              : `${blocksAgo(intruder.firstBlock, block)} to ${blocksAgo(intruder.lastBlock, block)}`}
          </dd>
          <dt>Wanted</dt>
          <dd>{intruder.refused > 0 ? `${qor(intruder.wantedWei)} QOR over ${plural(intruder.refused, "refused attempt")}` : "nothing was refused"}</dd>
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
        <h4>How each try failed</h4>
        <ul className="methods">
          {methods.map(([m, n]) => (
            <li key={m} className={m === "Robbed" ? "method method--robbed" : "method"}>
              <span>{methodText(m)}</span>
              <strong>{n}</strong>
            </li>
          ))}
        </ul>
      </details>
    </Reveal>
  );
}

export function Intruders() {
  const { block } = useChain();
  const { status, file, upTo } = useHistory();
  const strangers = file?.intruders.filter((i) => i.label === null).length ?? 0;

  return (
    <section className="sec sec--paper intrsec" id="intruders">
      <div className="wrap">
        <Head
          n="08"
          file="INTRUDERS.DB"
          lines={["Thieves leave", <em key="f">footprints.</em>]}
          lead="Every wallet that came for the money: what it tried, what it got, and where its money went next. Read from the chain, from the day the vaults were built."
        />

        {file === null || block === null ? (
          <Reveal className="panel">
            <p>
              {status === "offline" ? (
                "The attempt history could not be read just now."
              ) : (
                <>
                  <span className="muted">Reading every attempt since the vaults were built, straight from the chain. A first visit takes a little while; after that this browser remembers.</span>
                  <br />
                  <Skeleton width="100%" />
                </>
              )}
            </p>
          </Reveal>
        ) : file.intruders.length === 0 ? (
          <Reveal className="panel">
            <p className="panel-note">Nobody has come for the money yet. Your attempt in the lab above would open the first file.</p>
          </Reveal>
        ) : (
          <>
            <Reveal className="file-summary">
              <p className="file-big">
                <strong>{plural(file.intruders.length, "wallet")}</strong> came for the money.{" "}
                <strong>{strangers}</strong> {strangers === 1 ? "was a stranger" : "were strangers"}.
              </p>
              <ul className="file-legend">
                <li>
                  <span className="intruder-tag intruder-tag--stranger">Stranger</span> a wallet nobody in this project owns: a real outsider.
                </li>
                <li>
                  <span className="intruder-tag">Known</span> one of the project&rsquo;s own accounts, used to test the vault.
                </li>
              </ul>
              <p className="file-upto">
                Not counted: the owner&rsquo;s own {plural(file.ownerWithdrawals, "withdrawal")} (signed with both keys) and{" "}
                {plural(file.ownerCleanouts, "time")} the owner took the bait money back.
                {upTo ? ` Complete to block ${upTo.toLocaleString("en-US")}.` : ""}
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
