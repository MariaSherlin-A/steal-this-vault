/** 01: the opening screen. The dare, the key itself, and what is still inside. */
import { PUBLISHED_KEY } from "@stv/core/published";
import { TESTNET } from "@stv/core/chain";
import { useRef } from "react";
import { qor } from "../lib/format";
import { useRise } from "../lib/motion";
import { useChain } from "../lib/useChain";
import { Action, Corners, Micro, Poster } from "./Poster";
import { CopyButton, Live } from "./ui";

function KeySlip() {
  const groups = PUBLISHED_KEY.slice(2).match(/.{1,4}/g) ?? [];
  return (
    <figure className="keyslip" data-rise>
      <figcaption className="keyslip-top">
        <Micro>OWNER_PRIVATE.KEY</Micro>
        <Micro className="keyslip-flag">&lt;PUBLIC ON PURPOSE&gt;</Micro>
      </figcaption>
      <p className="keyslip-key" aria-label="The owner's private key, in full">
        <span className="keyslip-0x">0x</span>
        {groups.map((g, i) => (
          <span key={i}>{g}</span>
        ))}
      </p>
      <div className="keyslip-foot">
        <p>The real key, in full. On almost any other wallet, this alone hands over everything inside.</p>
        <CopyButton text={PUBLISHED_KEY} label="Copy the key" />
      </div>
    </figure>
  );
}

export function Hero() {
  const { hybrid, block, status } = useChain();
  const h = hybrid?.stats;
  const side = useRef<HTMLDivElement>(null);
  useRise(side);
  return (
    <section className="hero" id="top" aria-labelledby="hero-title">
      <Corners />
      <div className="hero-labels" aria-hidden>
        <Micro>{"C:\\VAULT\\OWNER.KEY"}</Micro>
        <Micro>STATUS: PUBLISHED</Micro>
        <Micro>CHAIN {TESTNET.evmChainId} // TESTNET</Micro>
      </div>

      <Poster as="h1" id="hero-title" className="poster--hero" lines={["Here’s", "the key.", <em key="g">Good luck.</em>]} />

      <div className="hero-side" ref={side}>
        <p className="hero-lead" data-rise>
          We published the private key that guards this crypto vault. The money is still inside, because one key was never
          enough here. Take it, and try to get in.
        </p>
        <KeySlip />
        <div className="hero-cta" data-rise>
          <Action href="#lab">Try to steal it</Action>
          <Action href="#locks" tone="line">
            Why it holds
          </Action>
        </div>
      </div>

      <div className="hero-count">
        <Micro>STILL INSIDE</Micro>
        <p className="hero-qor">
          <Live value={h ? qor(h.balance, 3) : null} width="5ch" />
          <small>QOR</small>
        </p>
      </div>

      <div className="hero-foot" aria-hidden>
        <Micro>{status === "live" ? `READ FROM BLOCK ${block?.toLocaleString("en-US")}` : status === "offline" ? "LAST READING, CHAIN SLOW" : "READING THE CHAIN"}</Micro>
        <Micro>SCROLL ↓</Micro>
      </div>
    </section>
  );
}
