import React from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";

/** Text typed out from frame `from`, `cps` characters per second, with a blinking cursor while typing. */
export const Typewriter: React.FC<{
  text: string;
  from: number;
  cps?: number;
  style?: React.CSSProperties;
  cursor?: boolean;
}> = ({ text, from, cps = 22, style, cursor = true }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const n = Math.max(0, Math.min(text.length, Math.floor(((frame - from) * cps) / fps)));
  const typing = frame >= from && n < text.length;
  const blink = Math.floor(frame / 12) % 2 === 0;
  if (frame < from) return <span style={{ ...style, opacity: 0 }}>{text}</span>;
  return (
    <span style={style}>
      {text.slice(0, n)}
      {cursor && (typing || blink) && n < text.length ? <span style={{ opacity: 0.8 }}>▍</span> : null}
    </span>
  );
};
