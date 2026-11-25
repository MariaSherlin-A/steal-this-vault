/** What frames every page: the opening counter, the header, the full-screen menu, the footer. */
import { useEffect, useRef, useState } from "react";
import { REPO_URL, VAULTS } from "../lib/clients";
import { qor, short } from "../lib/format";
import { gsap, holdScroll, reducedMotion, useMagnetic } from "../lib/motion";
import { useChain } from "../lib/useChain";
import { INDEX, nextView, type View } from "../lib/useView";
import { useWallet } from "../lib/useWallet";
import { explorer } from "@stv/core/chain";
import { Logo } from "./Brand";
import { Micro } from "./Poster";
import { Ext } from "./ui";

/**
 * The opening counter. It does not pretend: it climbs as the real work is done
 * (the type loads, then the first answer from the chain) and names each step.
 * If the chain is slow it lets the visitor in anyway, and the page says so.
 */
export function Loader() {
  const { status, block } = useChain();
  const [fonts, setFonts] = useState(false);
  const [late, setLate] = useState(false);
  const [shown, setShown] = useState(0);
  const [gone, setGone] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const value = useRef({ n: 0 });

  useEffect(() => {
    void document.fonts?.ready.then(() => setFonts(true));
    const t = window.setTimeout(() => setLate(true), 4500);
    return () => window.clearTimeout(t);
  }, []);

  const chainDone = status !== "loading" || late;
  const target = 18 + (fonts ? 34 : 0) + (chainDone ? 48 : 0);

  useEffect(() => {
    const tween = gsap.to(value.current, {
      n: target,
      duration: reducedMotion() ? 0.01 : target === 100 ? 0.7 : 1.4,
      ease: "power2.out",
      onUpdate: () => setShown(Math.round(value.current.n)),
    });
    return () => {
      tween.kill();
    };
  }, [target]);

  useEffect(() => {
    if (shown < 100 || !root.current) return;
    holdScroll(false);
    if (reducedMotion()) {
      setGone(true);
      return;
    }
    const tl = gsap.timeline({ delay: 0.25, onComplete: () => setGone(true) });
    tl.to(root.current.querySelectorAll(".loader-row, .loader-count"), { yPercent: -30, autoAlpha: 0, duration: 0.5, ease: "power2.in", stagger: 0.04 });
    tl.to(root.current, { clipPath: "inset(0 0 100% 0)", duration: 0.9, ease: "expo.inOut" }, "-=0.15");
    return () => {
      tl.kill();
    };
  }, [shown]);

  useEffect(() => {
    holdScroll(true);
    return () => holdScroll(false);
  }, []);

  if (gone) return null;
  const pad = String(shown).padStart(3, "0");
  return (
    <div className="loader" ref={root} role="status" aria-label={`Loading, ${shown} percent`}>
      <div className="loader-rows">
        <p className="loader-row">
          <Micro>{"C:\\STEAL_THIS_VAULT\\BOOT"}</Micro>
        </p>
        <p className="loader-row">
          <Micro>TYPE ................ {fonts ? "OK" : "LOADING"}</Micro>
        </p>
        <p className="loader-row">
          <Micro>
            QORECHAIN TESTNET ... {status === "live" ? `BLOCK ${block?.toLocaleString("en-US")}` : status === "offline" || late ? "SLOW, GOING IN ANYWAY" : "CALLING"}
          </Micro>
        </p>
        <p className="loader-row">
          <Micro>OWNER KEY ........... PUBLIC</Micro>
        </p>
      </div>
      <p className="loader-count" aria-hidden>
        {pad.split("").map((d, i) => (
          <span key={i}>{d}</span>
        ))}
        <small>%</small>
      </p>
      <div className="loader-bar" aria-hidden>
        <span style={{ transform: `scaleX(${shown / 100})` }} />
      </div>
    </div>
  );
}

function LivePill() {
  const { status, block } = useChain();
  return (
    <span className={`livepill livepill--${status}`} role="status">
      <span className="livepill-dot" aria-hidden />
      <span>
        {status === "loading" ? "Calling the chain" : status === "offline" ? "Chain unreachable · last reading" : `Live · block ${block?.toLocaleString("en-US") ?? ""}`}
      </span>
    </span>
  );
}

function Menu({ open, onClose }: { open: boolean; onClose: () => void }) {
  const root = useRef<HTMLDivElement>(null);
  const { wallet, connecting, connect, disconnect } = useWallet();
  const { hybrid } = useChain();

  useEffect(() => {
    const el = root.current;
    if (!el) return;
    holdScroll(open);
    el.inert = !open;
    if (open) el.querySelector<HTMLElement>("a")?.focus({ preventScroll: true });
    if (reducedMotion()) {
      gsap.set(el, { autoAlpha: open ? 1 : 0, clipPath: "inset(0 0 0% 0)" });
      return;
    }
    const tl = gsap.timeline();
    if (open) {
      tl.set(el, { autoAlpha: 1 })
        .fromTo(el, { clipPath: "inset(0 0 100% 0)" }, { clipPath: "inset(0 0 0% 0)", duration: 0.75, ease: "expo.inOut" })
        .from(el.querySelectorAll(".menu-item"), { yPercent: 60, autoAlpha: 0, duration: 0.6, ease: "power3.out", stagger: 0.04 }, "-=0.3");
    } else {
      tl.to(el, { clipPath: "inset(100% 0 0% 0)", duration: 0.6, ease: "expo.inOut" }).set(el, { autoAlpha: 0 });
    }
    return () => {
      tl.kill();
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const key = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [open, onClose]);

  return (
    <div className="menu" ref={root} id="menu" role="dialog" aria-modal="true" aria-label="Menu" aria-hidden={!open}>
      <div className="menu-inner">
        <nav aria-label="Sections">
          <ol className="menu-list">
            {INDEX.map((item) => (
              <li key={item.id} className="menu-item">
                <a href={`#${item.id}`} onClick={onClose}>
                  <span className="menu-n">{item.n}</span>
                  <span className="menu-label">{item.label}</span>
                  <span className="menu-note">{item.note}</span>
                </a>
              </li>
            ))}
          </ol>
        </nav>
        <aside className="menu-side">
          <Micro>// STATUS</Micro>
          <LivePill />
          <p className="menu-stat">
            <Micro>In the vault</Micro>
            <strong>{hybrid ? `${qor(hybrid.stats.balance)} QOR` : "reading"}</strong>
          </p>
          <Micro>// YOUR WALLET</Micro>
          {wallet ? (
            <button type="button" className="textbtn" onClick={disconnect}>
              {short(wallet.native, 8, 4)} · disconnect
            </button>
          ) : (
            <button type="button" className="textbtn" onClick={() => void connect()} disabled={connecting}>
              {connecting ? "Waiting for QoreX" : "Connect QoreX"}
            </button>
          )}
          <Micro>// ELSEWHERE</Micro>
          <Ext href={REPO_URL}>Source code</Ext>
          <Ext href={explorer.address(VAULTS.hybrid)}>The vault on the explorer</Ext>
        </aside>
      </div>
    </div>
  );
}

/**
 * The header takes the colour of whatever is under it: it reads the first
 * painted background below its own row and picks dark or light text to match.
 */
function useToneUnder(ref: React.RefObject<HTMLElement>): { tone: "light" | "dark"; bg: string } {
  const [state, setState] = useState<{ tone: "light" | "dark"; bg: string }>({ tone: "light", bg: "rgb(236, 231, 220)" });
  useEffect(() => {
    let frame = 0;
    const read = () => {
      frame = 0;
      const bar = ref.current;
      if (!bar) return;
      const y = bar.offsetHeight + 2;
      for (const el of document.elementsFromPoint(window.innerWidth / 2, y)) {
        if (bar.contains(el)) continue;
        const bg = getComputedStyle(el).backgroundColor;
        const m = bg.match(/rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)(?:,\s*([\d.]+))?/);
        if (!m || (m[4] !== undefined && Number(m[4]) < 0.5)) continue;
        const [r, g, b] = [Number(m[1]), Number(m[2]), Number(m[3])];
        const light = 0.2126 * r + 0.7152 * g + 0.0722 * b > 150;
        setState((prev) => (prev.bg === bg ? prev : { tone: light ? "light" : "dark", bg: `rgb(${r}, ${g}, ${b})` }));
        return;
      }
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(read);
    };
    read();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    const timer = window.setInterval(schedule, 700); // sections that change colour on their own, like the Q-Day switch
    return () => {
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      window.clearInterval(timer);
      cancelAnimationFrame(frame);
    };
  }, [ref]);
  return state;
}

/** Whether the colour under the header is the violet band, where a violet button would vanish. */
function isViolet(rgb: string): boolean {
  const m = rgb.match(/(\d+),\s*(\d+),\s*(\d+)/);
  if (!m) return false;
  const [r, g, b] = [Number(m[1]), Number(m[2]), Number(m[3])];
  return b > 180 && r < 140 && g < 110;
}

export function Header({ view }: { view: View }) {
  const [open, setOpen] = useState(false);
  const here = INDEX.find((i) => i.id === view);
  const bar = useRef<HTMLElement>(null);
  const menuBtn = useRef<HTMLButtonElement>(null);
  useMagnetic(menuBtn, 0.22);
  const under = useToneUnder(bar);

  useEffect(() => {
    const close = () => setOpen(false);
    window.addEventListener("hashchange", close);
    return () => window.removeEventListener("hashchange", close);
  }, []);

  const tone = open ? "dark" : under.tone;
  return (
    <>
      <header
        ref={bar}
        className={`topbar topbar--${tone} ${open ? "topbar--open" : ""} ${!open && isViolet(under.bg) ? "topbar--violet" : ""}`}
        style={{ "--bar-bg": open ? "var(--ink)" : under.bg } as React.CSSProperties}
      >
        <a href="#top" className="wordmark" aria-label="Steal This Vault, back to the start">
          <Logo size={36} />
          <span>Steal This Vault</span>
        </a>
        <div className="topbar-mid">
          <LivePill />
          {view !== "top" && here ? <Micro className="topbar-where">{`/ ${here.n} ${here.label}`}</Micro> : null}
        </div>
        <button
          ref={menuBtn}
          type="button"
          className="menubtn"
          aria-expanded={open}
          aria-controls="menu"
          aria-label={open ? "Close the menu" : "Open the menu"}
          onClick={() => setOpen((o) => !o)}
        >
          <span className="menubtn-word" aria-hidden>
            <span>Menu</span>
            <span>Close</span>
          </span>
          <span className="menubtn-badge" aria-hidden>
            <span className="menubtn-lines">
              <i />
              <i />
            </span>
          </span>
        </button>
      </header>
      <Menu open={open} onClose={() => setOpen(false)} />
    </>
  );
}

/** The large link at the foot of each page to the next one. */
export function NextView({ view }: { view: View }) {
  const next = nextView(view);
  if (!next) return null;
  return (
    <a href={`#${next.id}`} className="nextview">
      <Micro>[{next.n}] // NEXT</Micro>
      <span className="nextview-title">{next.label}</span>
      <svg className="nextview-arrow" viewBox="0 0 24 24" aria-hidden>
        <path d="M4 12h15M13 6l6 6-6 6" />
      </svg>
    </a>
  );
}

export function Footer() {
  return (
    <footer className="foot">
      <div className="foot-cols">
        <div>
          <Micro>// INDEX</Micro>
          <ul>
            {INDEX.map((i) => (
              <li key={i.id}>
                <a href={`#${i.id}`}>
                  <span className="foot-n">{i.n}</span> {i.label}
                </a>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <Micro>// CHECK IT</Micro>
          <ul>
            <li>
              <Ext href={REPO_URL}>Source code, MIT licence</Ext>
            </li>
            <li>
              <Ext href={explorer.address(VAULTS.hybrid)}>Two-lock vault</Ext>
            </li>
            <li>
              <Ext href={explorer.address(VAULTS.classic)}>One-lock twin</Ext>
            </li>
            <li>
              <Ext href="https://dashboard.qorechain.io/faucet">Free testnet coins</Ext>
            </li>
          </ul>
        </div>
        <div>
          <Micro>// SMALL PRINT</Micro>
          <p>
            Built for Build Before Q-Day, the QoreChain Developer Fest. Testnet only: testnet QOR has no money value. Icons by{" "}
            <Ext href="https://www.streamlinehq.com/">Streamline</Ext> (CC BY 4.0).
          </p>
        </div>
      </div>
      <p className="foot-mark" aria-hidden>
        Steal this vault
      </p>
    </footer>
  );
}
