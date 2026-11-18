/** Small shared pieces: reveal-on-scroll, live values, copy buttons, explorer links. */
import { explorer } from "@stv/core/chain";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { short } from "../lib/format";
import { ArrowUpIcon, CheckIcon, CopyIcon } from "./icons";

/** Fades its children up the first time they scroll into view. */
export function Reveal({ children, className = "", delay = 0 }: { children: ReactNode; className?: string; delay?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === "undefined" || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setSeen(true);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setSeen(true);
          observer.disconnect();
        }
      },
      { rootMargin: "0px 0px -8% 0px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return (
    <div ref={ref} className={`reveal ${seen ? "is-seen" : ""} ${className}`} style={delay ? { transitionDelay: `${delay}ms` } : undefined}>
      {children}
    </div>
  );
}

export function Skeleton({ width = "4ch" }: { width?: string }) {
  return <span className="skel" style={{ width }} aria-label="Loading" />;
}

/** Counts a number up from zero the first time it is shown. Text that is not a plain number shows as is. */
function useCountUp(value: string | null | undefined): string | null | undefined {
  const [shown, setShown] = useState(value);
  const started = useRef(false);
  useEffect(() => {
    const target = value != null && /^\d+(\.\d+)?$/.test(value) ? Number(value) : null;
    const reduce = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (started.current || target === null || target === 0 || reduce) {
      setShown(value);
      if (value != null) started.current = true;
      return undefined;
    }
    started.current = true;
    const decimals = value!.includes(".") ? value!.split(".")[1]!.length : 0;
    const t0 = performance.now();
    const ms = 1100;
    let frame = 0;
    const tick = (now: number) => {
      const p = Math.min(1, (now - t0) / ms);
      const eased = 1 - Math.pow(1 - p, 3);
      setShown(p < 1 ? (target * eased).toFixed(decimals) : value);
      if (p < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value]);
  return shown;
}

/** A value read from the chain. Shows a skeleton until it is known, counts up when it first appears, and pulses when it changes. */
export function Live({ value, width }: { value: string | null | undefined; width?: string }) {
  const previous = useRef<string | null | undefined>(value);
  const [bump, setBump] = useState(false);
  const shown = useCountUp(value);
  useEffect(() => {
    if (previous.current !== value && previous.current != null && value != null) {
      setBump(true);
      const timer = window.setTimeout(() => setBump(false), 900);
      previous.current = value;
      return () => window.clearTimeout(timer);
    }
    previous.current = value;
    return undefined;
  }, [value]);
  if (value == null || shown == null) return <Skeleton width={width} />;
  return <span className={bump ? "bump" : undefined}>{shown}</span>;
}

export function CopyButton({ text, label = "Copy", className = "" }: { text: string; label?: string; className?: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      // Clipboard access can be blocked; the text stays selectable on the page.
    }
  };
  return (
    <button type="button" className={`copy ${className}`} onClick={() => void copy()} aria-live="polite">
      {copied ? <CheckIcon size={14} /> : <CopyIcon size={14} />}
      <span>{copied ? "Copied" : label}</span>
    </button>
  );
}

/** A link that leaves the site. */
export function Ext({ href, children, className = "" }: { href: string; children: ReactNode; className?: string }) {
  return (
    <a className={`ext ${className}`} href={href} target="_blank" rel="noreferrer">
      {children}
      <ArrowUpIcon size={12} className="ext-arrow" aria-hidden />
    </a>
  );
}

/** A shortened address or transaction hash that opens in the block explorer. */
export function Addr({ value, kind = "address", full = false }: { value: string; kind?: "address" | "tx"; full?: boolean }) {
  const href = kind === "tx" ? explorer.tx(value) : explorer.address(value);
  return (
    <Ext href={href} className="mono">
      {full ? value : short(value)}
    </Ext>
  );
}
