/**
 * 06: alerts and the way out. The alert shown is the one the watcher builds
 * for the latest real attempt in the vault logs; the rescue panel reads the
 * side door and the vault's balance live.
 */
import { alertText, worthAlerting } from "@stv/core/alerts";
import { sortAttempts } from "@stv/core/history";
import { useRef } from "react";
import { blocksAgo, qor, short } from "../lib/format";
import { useRise } from "../lib/motion";
import { useChain } from "../lib/useChain";
import { KNOWN, useHistory } from "../lib/useHistory";
import { Head, Micro } from "./Poster";
import { Live, Skeleton } from "./ui";

const RESCUE = [
  { n: "01", title: "Shut the side door", text: "The owner closes the one path ordinary wallets use, so the leaked key can no longer even knock." },
  { n: "02", title: "Pick a new home", text: "A fresh account that already has its own second lock. The rescue refuses any account without one." },
  { n: "03", title: "Move everything", text: "The whole vault goes across in one payment, signed with both keys. A thief can do none of these steps." },
] as const;

function Alert() {
  const { attempts, status } = useHistory();
  const { block } = useChain();
  const latest = sortAttempts(attempts)
    .reverse()
    .find((a) => worthAlerting(a, KNOWN));
  // The real message, with long addresses shortened and the explorer link dropped (hashes belong in Technical).
  const lines = latest
    ? alertText(latest, KNOWN)
        .split("\n")
        .map((line) => line.replace(/0x[0-9a-fA-F]{40}/g, (m) => short(m)).replace(/: https?:\/\/\S+$/, ".").replace(/Block (\d+)/, (_, n: string) => `Block ${Number(n).toLocaleString("en-US")}`))
    : [];
  return (
    <figure className="alert">
      <div className="alert-phone">
        <div className="alert-notch" aria-hidden />
        <Micro className="alert-app">VAULT WATCHER · {latest && block !== null ? blocksAgo(latest.blockNumber, block) : "now"}</Micro>
        {status !== "live" ? (
          <Skeleton width="100%" />
        ) : !latest ? (
          <p className="alert-line">No attempts yet, so nothing to report.</p>
        ) : (
          lines.map((line, i) => (
            <p key={i} className={i === 0 ? "alert-line alert-line--head" : "alert-line"}>
              {line}
            </p>
          ))
        )}
      </div>
      <figcaption>
        The watcher turns every attempt into a message like this one for the owner&rsquo;s Telegram or Discord. This message is built
        from the latest real attempt in the vault&rsquo;s record.
      </figcaption>
    </figure>
  );
}

export function Watch() {
  const { hybrid, door } = useChain();
  const ref = useRef<HTMLDivElement>(null);
  useRise(ref);
  return (
    <section className="sec sec--paper watch" id="watch">
      <Head
        n="06"
        file="ALERTS_RESCUE.CFG"
        lines={["Every knock", "rings a bell."]}
        lead="On an ordinary wallet, the owner finds out about a stolen key when the money is gone. Here the vault refuses first and tells the owner second, while the money is still there."
      />
      <div className="watch-grid" ref={ref}>
        <div data-rise>
          <Alert />
        </div>
        <div className="rescue" data-rise>
          <Micro>// AND IF IT EVER COMES TO IT</Micro>
          <h3 className="rescue-title">A way out.</h3>
          <ol className="rescue-steps">
            {RESCUE.map((s) => (
              <li key={s.n}>
                <span className="rescue-n">{s.n}</span>
                <div>
                  <h4>{s.title}</h4>
                  <p>{s.text}</p>
                </div>
              </li>
            ))}
          </ol>
          <dl className="rescue-now">
            <div>
              <dt>Side door right now</dt>
              <dd>{door === null ? <Skeleton width="6ch" /> : door.open ? "Open, to the two vaults only" : "Shut"}</dd>
            </div>
            <div>
              <dt>A rescue would move</dt>
              <dd>
                <Live value={hybrid ? qor(hybrid.stats.balance) : null} width="5ch" /> QOR
              </dd>
            </div>
          </dl>
          <p className="muted">Only the owner can run it: every step needs the second key.</p>
        </div>
      </div>
    </section>
  );
}
