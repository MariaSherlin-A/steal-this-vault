/**
 * 05: Q-Day. A switch flips the section between today and Q-Day, the day a
 * quantum computer can work out ordinary keys. Below it, the drill: the fest's
 * bot held the published key for a whole day, and the owner's proof payment is
 * read back from the chain live.
 */
import { useEffect, useRef, useState } from "react";
import { DEPLOYMENT, loadLab } from "../lib/clients";
import type { Proof } from "../lib/lab";
import { qor, uqorToQor } from "../lib/format";
import { gsap, reducedMotion } from "../lib/motion";
import { useChain } from "../lib/useChain";
import { explorer } from "@stv/core/chain";
import { Head, Micro } from "./Poster";
import { Ext, Live, Skeleton } from "./ui";

/** The drill-day proof payment, from docs/drill-day.md and the 18 Nov entry of docs/AI_LOG.md. Everything about it is read live. */
const PROOF_TX = "860064E01688CBCD7EF3D4D699BB8741DF4BD8894594EF2A0E6CE0A621A192AC";

type Mode = "today" | "qday";

const SIDE = {
  today: {
    title: "Today",
    one: { state: "Safe, while the key stays secret", text: "One leak, through phishing, malware or a careless backup, and the wallet is emptied." },
    two: { state: "Safe", text: "A leak of the ordinary key opens nothing on its own." },
  },
  qday: {
    title: "Q-Day",
    one: { state: "Open to anyone", text: "A quantum computer works the key out from public data. Every one-lock wallet is, in effect, published." },
    two: { state: "Still shut", text: "The second key is built to survive quantum computers. Nothing changes for this vault." },
  },
} as const;

function ProofCard() {
  const [proof, setProof] = useState<Proof | null | "failed">(null);
  useEffect(() => {
    let gone = false;
    loadLab()
      .then((lab) => lab.readProof(PROOF_TX))
      .then((p) => !gone && setProof(p ?? "failed"))
      .catch(() => !gone && setProof("failed"));
    return () => {
      gone = true;
    };
  }, []);

  const toVault = proof && proof !== "failed" && proof.to === DEPLOYMENT.vaults.hybrid.native;
  return (
    <article className="proof">
      <header>
        <Micro>PROOF_TX // DRILL DAY, 18 NOV 2026</Micro>
        <Micro className="proof-live">{proof === null ? "CHECKING THE CHAIN" : proof === "failed" ? "CHAIN DID NOT ANSWER" : "CHECKED ON THE CHAIN JUST NOW"}</Micro>
      </header>
      <p className="proof-lead">
        While the drill was on, the owner sent one ordinary payment, signed with both keys, to show the account still works for the one
        person who holds both.
      </p>
      {proof === null ? (
        <Skeleton width="100%" />
      ) : proof === "failed" ? (
        <p className="muted">
          The chain did not answer just now. <Ext href={explorer.tx(PROOF_TX)}>Look it up on the explorer</Ext>.
        </p>
      ) : (
        <dl className="proof-rows">
          <div>
            <dt>Accepted by the chain</dt>
            <dd className={proof.accepted ? "ok" : "bad"}>{proof.accepted ? "Yes" : "No"}</dd>
          </div>
          <div>
            <dt>Carries the second signature</dt>
            <dd className={proof.twoSignatures ? "ok" : "bad"}>{proof.twoSignatures ? "Yes" : "No"}</dd>
          </div>
          <div>
            <dt>Paid</dt>
            <dd>
              {uqorToQor(proof.uqor)} QOR {toVault ? "into the vault" : ""}
            </dd>
          </div>
          <div>
            <dt>When</dt>
            <dd>
              {proof.time ? `${proof.time.replace("T", " ").replace("Z", "")} UTC, ` : ""}
              <Ext href={explorer.tx(PROOF_TX)}>block {proof.height.toLocaleString("en-US")}</Ext>
            </dd>
          </div>
        </dl>
      )}
    </article>
  );
}

export function Drill() {
  const [mode, setMode] = useState<Mode>("today");
  const { hybrid } = useChain();
  const root = useRef<HTMLElement>(null);
  const side = SIDE[mode];

  const flip = (next: Mode) => {
    if (next === mode) return;
    const el = root.current;
    if (!el || reducedMotion()) {
      setMode(next);
      return;
    }
    gsap
      .timeline()
      .to(el.querySelectorAll(".qd-swap"), { autoAlpha: 0, y: 14, duration: 0.22, ease: "power2.in", stagger: 0.03 })
      .add(() => setMode(next))
      .to(el.querySelectorAll(".qd-swap"), { autoAlpha: 1, y: 0, duration: 0.45, ease: "power3.out", stagger: 0.05 });
  };

  return (
    <section className={`sec drill drill--${mode}`} id="drill" ref={root} data-mode={mode}>
      <Head
        n="05"
        file="Q_DAY.SIM"
        lines={["Q-Day", <em key="e">came early.</em>]}
        lead="One day a large enough quantum computer will work out ordinary private keys from information that is already public. That day is called Q-Day. For this vault, every day is Q-Day: its key is already public."
      />

      <div className="qd">
        <div className="qd-switch" role="radiogroup" aria-label="Show the world">
          <button type="button" role="radio" aria-checked={mode === "today"} onClick={() => flip("today")}>
            Today
          </button>
          <button type="button" role="radio" aria-checked={mode === "qday"} onClick={() => flip("qday")}>
            Q-Day
          </button>
          <span className="qd-thumb" aria-hidden />
        </div>

        <div className="qd-grid">
          <div className="qd-col qd-col--one">
            <Micro>ONE-LOCK WALLETS</Micro>
            <p className="qd-state qd-swap">{side.one.state}</p>
            <p className="qd-text qd-swap">{side.one.text}</p>
          </div>
          <div className="qd-col qd-col--two">
            <Micro>THIS VAULT</Micro>
            <p className="qd-state qd-swap">{side.two.state}</p>
            <p className="qd-text qd-swap">{side.two.text}</p>
            <p className="qd-hold">
              <Live value={hybrid ? qor(hybrid.stats.balance, 3) : null} width="5ch" /> QOR inside, either way
            </p>
          </div>
        </div>
      </div>

      <div className="drillday">
        <div className="drillday-text">
          <Micro>// THE DRILL</Micro>
          <h3>A whole day with the thief.</h3>
          <p>
            On 18 November the fest ran a Q-Day drill. A bot held the owner&rsquo;s published key from midnight to midnight and tried
            everything that key alone can do. The scoring asked three things: does the owner still get in, how many attacks got
            through, how much money stayed.
          </p>
        </div>
        <ProofCard />
      </div>
    </section>
  );
}
