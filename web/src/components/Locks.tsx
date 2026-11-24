/**
 * 02: the two locks. When the drawing comes into view the stolen key walks
 * through both locks by itself: the first opens, the second refuses. A button
 * plays it again. With reduced motion it shows the end state at once.
 */
import { useLayoutEffect, useRef } from "react";
import { qor } from "../lib/format";
import { gsap, ScrollTrigger } from "../lib/motion";
import { useChain } from "../lib/useChain";
import { Head, Micro } from "./Poster";
import { Live } from "./ui";

const STEPS = [
  {
    n: "A",
    title: "The thief has the key",
    text: "Phishing, malware, a careless backup, or one day a quantum computer. Keys leak. Here we skipped all that and handed it out.",
  },
  {
    n: "B",
    title: "Lock one opens",
    text: "Every wallet has an ordinary key, and the stolen one fits. On a normal wallet that is the end of the story: the money leaves in seconds.",
  },
  {
    n: "C",
    title: "Lock two refuses",
    text: "This vault also asks for a second, quantum-safe signature, from a key that never left the owner. The chain checks it, the vault checks it again, and turns the thief away.",
  },
] as const;

function Padlock({ x, id, label, sub }: { x: number; id: string; label: string; sub: string }) {
  return (
    <g className={`pad pad--${id}`} transform={`translate(${x} 0)`}>
      <path className="pad-shackle" d="M-38 170 V118 a38 38 0 0 1 76 0 V170" />
      <rect className="pad-body" x="-66" y="160" width="132" height="120" />
      <circle className="pad-hole" cx="0" cy="210" r="11" />
      <path className="pad-hole" d="M-6 216 h12 l4 30 h-20z" />
      <text className="pad-label" x="-66" y="312">
        {label}
      </text>
      <text className="pad-sub" x="-66" y="332">
        {sub}
      </text>
      <g className="pad-stamp">
        <rect x="-74" y="190" width="148" height="40" />
        <text x="0" y="217" textAnchor="middle">
          {id === "a" ? "KEY FITS" : "REFUSED"}
        </text>
      </g>
    </g>
  );
}

export function Locks() {
  const stage = useRef<HTMLDivElement>(null);
  const timeline = useRef<gsap.core.Timeline | null>(null);
  const { hybrid } = useChain();

  useLayoutEffect(() => {
    const el = stage.current;
    if (!el) return;
    const mm = gsap.matchMedia();
    mm.add("(prefers-reduced-motion: no-preference)", () => {
      const q = gsap.utils.selector(el);
      const steps = q(".lstep");
      gsap.set(steps, { autoAlpha: 0.18 });
      gsap.set(steps[0]!, { autoAlpha: 1 });
      gsap.set(q(".pad-stamp"), { autoAlpha: 0, scale: 0.6, transformOrigin: "50% 50%" });
      gsap.set(q(".pad--a .pad-shackle"), { y: 0 });
      gsap.set(q(".skey"), { x: -170, y: 0, rotate: 0 });
      gsap.set(q(".locks-full"), { autoAlpha: 0, y: 20 });
      el.classList.add("is-scripted");

      const tl = gsap.timeline({ paused: true, defaults: { ease: "power2.inOut" } });
      timeline.current = tl;
      tl.set(steps, { autoAlpha: 0.18 })
        .set(steps[0]!, { autoAlpha: 1 })
        .set(q(".pad-stamp"), { autoAlpha: 0, scale: 0.6 })
        .set(q(".pad--a .pad-shackle"), { y: 0 })
        .set(q(".pad--a"), { attr: { "data-on": "shut" } })
        .set(q(".skey"), { x: -170, y: 0, rotate: 0, autoAlpha: 1 })
        .set(q(".locks-full"), { autoAlpha: 0, y: 20 })
        .to(q(".skey"), { x: 0, duration: 1.1 }, "+=0.5")
        .to(steps[0]!, { autoAlpha: 0.18, duration: 0.3 }, ">-0.1")
        .to(steps[1]!, { autoAlpha: 1, duration: 0.3 }, "<")
        .to(q(".skey"), { rotate: 90, duration: 0.4 })
        .to(q(".pad--a .pad-shackle"), { y: -26, duration: 0.4 }, "<0.1")
        .to(q(".pad--a"), { attr: { "data-on": "open" }, duration: 0.01 }, "<")
        .to(q(".pad--a .pad-stamp"), { autoAlpha: 1, scale: 1, duration: 0.3, ease: "back.out(2)" })
        .to(q(".skey"), { rotate: 0, x: 260, duration: 1 }, "+=0.2")
        .to(steps[1]!, { autoAlpha: 0.18, duration: 0.3 }, ">-0.1")
        .to(steps[2]!, { autoAlpha: 1, duration: 0.3 }, "<")
        .to(q(".skey"), { rotate: 90, duration: 0.3 })
        .to(q(".pad--b"), { x: "+=8", duration: 0.06, repeat: 5, yoyo: true, ease: "none" })
        .to(q(".skey"), { rotate: 0, x: 200, y: 40, autoAlpha: 0.35, duration: 0.5 })
        .to(q(".pad--b .pad-stamp"), { autoAlpha: 1, scale: 1, duration: 0.35, ease: "back.out(2)" }, "<")
        .to(q(".locks-full"), { autoAlpha: 1, y: 0, duration: 0.5 });
      tl.timeScale(0.8);
      const start = ScrollTrigger.create({ trigger: q(".locks-art")[0], start: "top 75%", once: true, onEnter: () => tl.play(0) });
      return () => {
        start.kill();
        timeline.current = null;
        el.classList.remove("is-scripted");
      };
    });
    return () => mm.revert();
  }, []);

  return (
    <section className="sec sec--paper locks" id="locks">
      <Head
        n="02"
        file="TWO_LOCKS.SYS"
        lines={["One key", "opens nothing."]}
        lead="Why the stolen key gets nowhere. Every crypto wallet has an ordinary key, and that is usually the only lock. This vault adds a second, quantum-safe one that only the owner holds. Watch the key try both."
      />
      <div className="locks-stage" ref={stage}>
        <ol className="locks-steps">
          {STEPS.map((s) => (
            <li key={s.n} className="lstep">
              <Micro className="lstep-n">STEP_{s.n}</Micro>
              <h3>{s.title}</h3>
              <p>{s.text}</p>
            </li>
          ))}
        </ol>
        <div className="locks-art">
          <svg viewBox="0 0 640 360" role="img" aria-label="Two padlocks. The stolen key opens the first; the second refuses it.">
            <line className="locks-rail" x1="20" y1="220" x2="620" y2="220" />
            <Padlock x={210} id="a" label="LOCK 01 · ORDINARY KEY" sub="the published one" />
            <Padlock x={470} id="b" label="LOCK 02 · QUANTUM-SAFE KEY" sub="kept by the owner, never shared" />
            <g className="skey" transform="translate(0 0)">
              <g transform="translate(150 210)">
                <circle className="skey-bow" cx="-34" cy="0" r="16" />
                <circle className="skey-eye" cx="-34" cy="0" r="6" />
                <path className="skey-blade" d="M-18 -4 H34 V4 H28 V12 H22 V4 H14 V10 H8 V4 H-18Z" />
              </g>
            </g>
          </svg>
          <ul className="locks-legend" aria-hidden>
            <li>
              <i className="ll-a" /> Lock 01 · the ordinary key, the published one
            </li>
            <li>
              <i className="ll-b" /> Lock 02 · the quantum-safe key, kept by the owner
            </li>
          </ul>
          <button type="button" className="textbtn locks-again" onClick={() => timeline.current?.restart()}>
            Play again
          </button>
          <p className="locks-full">
            <Micro>RESULT</Micro>
            <strong>
              <Live value={hybrid ? qor(hybrid.stats.balance, 3) : null} width="5ch" /> QOR
            </strong>
            <span>still in the vault, read from the chain just now.</span>
          </p>
        </div>
      </div>
    </section>
  );
}
