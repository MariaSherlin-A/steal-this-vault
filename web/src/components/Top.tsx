/** The header and the opening screen: the claim, the published key, and four live figures. */
import { PUBLISHED_KEY } from "@stv/core/published";
import { qor, short } from "../lib/format";
import { useChain } from "../lib/useChain";
import { useWallet } from "../lib/useWallet";
import { KeyIcon, WalletIcon } from "./icons";
import { CopyButton, Live } from "./ui";

const NAV = [
  ["#experiment", "The experiment"],
  ["#lab", "Try to rob it"],
  ["#record", "The record"],
  ["#how", "How it works"],
  ["#technical", "Technical details"],
] as const;

export function Header() {
  const { status, block } = useChain();
  const { wallet, connecting, connect, disconnect } = useWallet();
  const pill =
    status === "loading"
      ? "Connecting to the chain"
      : status === "offline"
        ? "Chain unreachable. Showing the last reading"
        : `Live · block ${block?.toLocaleString("en-US") ?? ""}`;
  return (
    <header className="header">
      <div className="wrap header-row">
        <a href="#top" className="wordmark" aria-label="Steal This Vault, back to top">
          <span className="wordmark-mark" aria-hidden>
            <KeyIcon size={16} />
          </span>
          Steal This Vault
        </a>
        <nav className="nav" aria-label="Sections">
          {NAV.map(([href, label]) => (
            <a key={href} href={href}>
              {label}
            </a>
          ))}
        </nav>
        <div className="header-side">
          <span className={`pill pill--${status}`} role="status">
            <span className="pill-dot" aria-hidden />
            <span className="pill-text">{pill}</span>
          </span>
          {wallet ? (
            <button type="button" className="btn btn--ghost btn--small" onClick={disconnect} title="Disconnect">
              <WalletIcon size={15} />
              <span className="mono">{short(wallet.native, 7, 4)}</span>
            </button>
          ) : (
            <button type="button" className="btn btn--ghost btn--small" onClick={() => void connect()} disabled={connecting}>
              <WalletIcon size={15} />
              <span>{connecting ? "Connecting" : "Connect QoreX"}</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
}

function KeyCard() {
  const hex = PUBLISHED_KEY.slice(2);
  const groups = hex.match(/.{1,4}/g) ?? [];
  return (
    <figure className="keycard">
      <figcaption className="keycard-head">
        <span className="eyebrow">
          <KeyIcon size={14} /> The owner’s private key
        </span>
        <span className="keycard-tag">Published on purpose</span>
      </figcaption>
      <p className="keycard-key mono" aria-label="The private key, in full">
        <span className="keycard-0x">0x</span>
        {groups.map((group, i) => (
          <span key={i}>{group}</span>
        ))}
      </p>
      <div className="keycard-foot">
        <p>
          This is the real key, in full. On most blockchains, whoever holds it owns everything in the account. Copy it. Import it into
          any wallet.
        </p>
        <CopyButton text={PUBLISHED_KEY} label="Copy the key" className="copy--brass" />
      </div>
    </figure>
  );
}

export function Hero() {
  const { hybrid, classic } = useChain();
  const h = hybrid?.stats;
  const c = classic?.stats;
  return (
    <section className="hero" id="top">
      <div className="wrap hero-grid">
        <div className="hero-copy">
          <p className="eyebrow">A public experiment on the QoreChain testnet</p>
          <h1>
            The key to this vault is public. <em>The money is still in it.</em>
          </h1>
          <p className="lead">
            A leaked private key normally means the money is gone within minutes. This vault’s owner key is printed on this page. Take
            it and try to empty the vault. The account has a second, quantum-safe lock, and the stolen key does not open that one.
          </p>
          <div className="hero-cta">
            <a href="#lab" className="btn btn--primary">
              Try to rob it
            </a>
            <a href="#experiment" className="btn btn--ghost">
              See the experiment
            </a>
          </div>
        </div>
        <KeyCard />
      </div>

      <div className="wrap">
        <dl className="figures">
          <div className="figure">
            <dt>In the vault right now</dt>
            <dd>
              <Live value={h ? qor(h.balance) : null} /> <small>QOR</small>
            </dd>
            <p>Sitting behind a key anyone can copy.</p>
          </div>
          <div className="figure">
            <dt>Theft attempts refused</dt>
            <dd>
              <Live value={h ? h.refusedCount.toString() : null} width="2ch" />
            </dd>
            <p>Counted by the vault itself, on the chain.</p>
          </div>
          <div className="figure">
            <dt>Stopped by the second lock alone</dt>
            <dd>
              <Live value={h ? h.counterfactualThefts.toString() : null} width="2ch" />
            </dd>
            <p>
              The stolen key fitted. With one lock, <Live value={h ? qor(h.counterfactualLoss) : null} /> QOR would be gone.
            </p>
          </div>
          <div className="figure figure--robbed">
            <dt>Taken from the one-lock twin</dt>
            <dd>
              <Live value={c ? qor(c.paidTotal) : null} /> <small>QOR</small>
            </dd>
            <p>The same vault without the second lock, robbed with the same key.</p>
          </div>
        </dl>
      </div>
    </section>
  );
}
