/**
 * The overview pieces that tell a first-time visitor what this site is:
 * the chain ticking live, the story in three steps, and where to go next.
 */
import { qor } from "../lib/format";
import { useChain } from "../lib/useChain";
import { BugIcon, CodeIcon, KeyIcon, LockShieldIcon, ShieldIcon, VaultIcon, WarnShieldIcon } from "./icons";
import { Reveal } from "./ui";

const SHOWN = 9;

/** The latest blocks of the testnet, as they arrive. Real block numbers from the chain. */
export function ChainStrip() {
  const { block, hybrid, status } = useChain();
  const blocks = block === null ? [] : Array.from({ length: SHOWN }, (_, i) => block - BigInt(SHOWN - 1 - i));
  return (
    <section className="chain-strip" aria-label="The QoreChain testnet, live">
      <div className="wrap chain-row">
        <div className="chain-label">
          <span className={`chain-dot chain-dot--${status}`} aria-hidden />
          <span>
            <strong>QoreChain testnet</strong>
            <small>{status === "offline" ? "unreachable just now" : "new block every few seconds"}</small>
          </span>
        </div>
        <ol className="chain-blocks">
          {blocks.map((b, i) => (
            <li key={b.toString()} className={i === blocks.length - 1 ? "chain-block chain-block--head" : "chain-block"}>
              <span className="chain-cube" aria-hidden />
              <span className="mono">#{b.toLocaleString("en-US")}</span>
            </li>
          ))}
        </ol>
        <div className="chain-vault">
          <VaultIcon size={18} />
          <span>
            <small>Vault balance</small>
            <strong>{hybrid ? `${qor(hybrid.stats.balance)} QOR` : "reading"}</strong>
          </span>
        </div>
      </div>
    </section>
  );
}

const STEPS = [
  {
    icon: KeyIcon,
    tone: "red",
    title: "A private key leaks",
    text: "On almost every blockchain, one private key controls a wallet. Phishing, malware, or a future quantum computer can expose it. We skipped the wait and published ours.",
  },
  {
    icon: WarnShieldIcon,
    tone: "red",
    title: "An attacker signs with it",
    text: "Anyone holding that key can sign a withdrawal. On an ordinary wallet that signature is enough, and the funds are gone in seconds.",
  },
  {
    icon: LockShieldIcon,
    tone: "safe",
    title: "The second lock refuses",
    text: "This vault also demands a fresh signature from a quantum-safe key that never leaves the owner. The chain itself checks it, and refuses everything else.",
  },
] as const;

export function Steps() {
  return (
    <section className="section steps-section">
      <div className="wrap">
        <Reveal className="section-head">
          <p className="eyebrow">What you are looking at</p>
          <h2>A crypto vault that survives a stolen key.</h2>
          <p className="section-lead">
            Steal This Vault is a live security test on the QoreChain testnet. It shows, with real money on a real chain, what changes
            when a wallet needs a quantum-safe second signature.
          </p>
        </Reveal>
        <ol className="steps">
          {STEPS.map(({ icon: Icon, tone, title, text }, i) => (
            <Reveal key={title} className={`step step--${tone} spot`} delay={i * 120}>
              <div className="step-top">
                <span className="step-num">0{i + 1}</span>
                <span className="step-icon">
                  <Icon size={22} />
                </span>
              </div>
              <h3>{title}</h3>
              <p>{text}</p>
            </Reveal>
          ))}
        </ol>
      </div>
    </section>
  );
}

const EXPLORE = [
  { href: "#how", icon: ShieldIcon, title: "How it works", text: "The two locks, in plain words, and what the chain checks." },
  { href: "#experiment", icon: VaultIcon, title: "Live comparison", text: "The same key against a one-lock vault and a two-lock vault." },
  { href: "#lab", icon: BugIcon, title: "Attack lab", text: "Take the published key and try every attack yourself." },
  { href: "#record", icon: CodeIcon, title: "Threat log", text: "Every attempt the vaults recorded, and who made it." },
] as const;

export function Explore() {
  return (
    <section className="section explore-section">
      <div className="wrap">
        <Reveal className="section-head">
          <p className="eyebrow">Explore</p>
          <h2>Check every claim yourself.</h2>
        </Reveal>
        <div className="explore">
          {EXPLORE.map(({ href, icon: Icon, title, text }, i) => (
            <Reveal key={href} className="explore-cell" delay={i * 80}>
              <a href={href} className="explore-card spot">
                <span className="explore-icon">
                  <Icon size={22} />
                </span>
                <h3>{title}</h3>
                <p>{text}</p>
                <span className="explore-go" aria-hidden>
                  →
                </span>
              </a>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
