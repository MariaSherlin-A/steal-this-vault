/** The design's building blocks: numbered section heads, poster headlines, scrolling strips, framed corners, buttons. */
import { useRef, type ReactNode } from "react";
import { useMagnetic, useRise, useSplitReveal } from "../lib/motion";

/** A headline that rises line by line. Pass lines as an array to set the breaks yourself. */
export function Poster({
  as: Tag = "h2",
  lines,
  className = "",
  id,
}: {
  as?: "h1" | "h2" | "h3";
  lines: ReactNode[];
  className?: string;
  id?: string;
}) {
  const ref = useRef<HTMLHeadingElement>(null);
  useSplitReveal(ref);
  return (
    <Tag ref={ref} className={`poster ${className}`} id={id}>
      {lines.map((line, i) => (
        <span key={i} className="poster-line">
          {line}
        </span>
      ))}
    </Tag>
  );
}

/** A small terminal-style label: `[04] // SCORE.LOG`. */
export function Micro({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <span className={`micro ${className}`}>{children}</span>;
}

/** The head of a numbered section: index, file label, poster headline and a short lead. */
export function Head({
  n,
  file,
  lines,
  lead,
  aside,
  className = "",
}: {
  n: string;
  file: string;
  lines: ReactNode[];
  lead?: ReactNode;
  aside?: ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useRise(ref);
  return (
    <header className={`head ${className}`} ref={ref}>
      <div className="head-meta" data-rise>
        <Micro>[{n}]</Micro>
        <span className="head-rule" aria-hidden />
        <Micro>{file}</Micro>
      </div>
      <Poster lines={lines} />
      {(lead || aside) && (
        <div className="head-foot">
          {lead ? (
            <p className="lead" data-rise>
              {lead}
            </p>
          ) : null}
          {aside ? <div data-rise>{aside}</div> : null}
        </div>
      )}
    </header>
  );
}

/** A band of words that keeps scrolling sideways. Decorative: screen readers get the words once. */
export function Strip({ items, reverse = false, tone = "ink" }: { items: ReactNode[]; reverse?: boolean; tone?: "ink" | "violet" | "paper" }) {
  const run = (hidden: boolean) => (
    <div className="strip-run" aria-hidden={hidden || undefined}>
      {items.map((item, i) => (
        <span key={i} className="strip-item">
          {item}
          <svg className="strip-mark" viewBox="0 0 20 20" aria-hidden>
            <path d="M10 0 L12 8 L20 10 L12 12 L10 20 L8 12 L0 10 L8 8 Z" />
          </svg>
        </span>
      ))}
    </div>
  );
  return (
    <div className={`strip strip--${tone} ${reverse ? "strip--reverse" : ""}`} role="marquee">
      <div className="strip-track">
        {run(false)}
        {run(true)}
        {run(true)}
      </div>
    </div>
  );
}

/** The four corner marks that frame the opening screen, like the edges of a viewfinder. */
export function Corners() {
  const corner = (cls: string) => (
    <svg className={`corner ${cls}`} viewBox="0 0 40 40" aria-hidden>
      <path d="M1 40 V1 H40" />
    </svg>
  );
  return (
    <>
      {corner("corner--tl")}
      {corner("corner--tr")}
      {corner("corner--br")}
      {corner("corner--bl")}
    </>
  );
}

/** A pill link or button with an arrow that slides through on hover, and leans towards the pointer. */
export function Action({
  href,
  onClick,
  children,
  tone = "violet",
  disabled,
  type = "button",
}: {
  href?: string;
  onClick?: () => void;
  children: ReactNode;
  tone?: "violet" | "ink" | "paper" | "line";
  disabled?: boolean;
  type?: "button" | "submit";
}) {
  const ref = useRef<HTMLAnchorElement & HTMLButtonElement>(null);
  useMagnetic(ref);
  const inner = (
    <>
      <span className="action-text">{children}</span>
      <span className="action-arrow" aria-hidden>
        <svg viewBox="0 0 24 24">
          <path d="M4 12h15M13 6l6 6-6 6" />
        </svg>
        <svg viewBox="0 0 24 24">
          <path d="M4 12h15M13 6l6 6-6 6" />
        </svg>
      </span>
    </>
  );
  return href ? (
    <a ref={ref} href={href} className={`action action--${tone}`}>
      {inner}
    </a>
  ) : (
    <button ref={ref} type={type} className={`action action--${tone}`} onClick={onClick} disabled={disabled}>
      {inner}
    </button>
  );
}
