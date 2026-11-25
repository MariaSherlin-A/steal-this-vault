/**
 * A site scene: the site's own poster tagline as a title card, then the live recording in a
 * frame with corner marks, with camera push-ins and callouts placed in the recording's own pixels.
 */
import React from "react";
import { AbsoluteFill, Freeze, OffthreadVideo, Sequence, interpolate, staticFile, useCurrentFrame } from "remotion";
import { C, ChapterTag, Corners, PosterLines, clamp, easeInOut, micro, rise } from "./kit";

/** Where the recording sits in the film: scaled down a little, inside a frame. */
const S = 0.86;
const FW = 1920 * S;
const FH = 1080 * S;
const FX = (1920 - FW) / 2;
const FY = 96;

export interface Zoom {
  /** Scene frames: when the push starts and ends, and when it releases. */
  at: number;
  until: number;
  /** The point to push in on, in recording pixels, and how far. */
  x: number;
  y: number;
  scale: number;
}

/** A cut of the recording: from scene frame `from`, play the clip from `clip` seconds at `rate`. */
export interface Segment {
  from: number;
  clip: number;
  rate?: number;
}

export interface Mark {
  at: number;
  until?: number;
  /** x, y, w, h in recording pixels. */
  box: [number, number, number, number];
  label: string;
  tone?: "violet" | "mint" | "carmine" | "ink";
  tagSide?: "top" | "bottom";
}

/** The camera: how far it is pushed in at this frame, and towards where. */
function camera(frame: number, zooms: Zoom[]): { s: number; x: number; y: number } {
  for (const z of zooms) {
    const into = interpolate(frame, [z.at, z.at + 40], [0, 1], { ...clamp, easing: easeInOut });
    const out = interpolate(frame, [z.until, z.until + 36], [0, 1], { ...clamp, easing: easeInOut });
    const k = into * (1 - out);
    if (k > 0) return { s: 1 + (z.scale - 1) * k, x: z.x, y: z.y };
  }
  return { s: 1, x: 960, y: 540 };
}

export function SiteScene({
  clip,
  n,
  chapter,
  title,
  titleFrames = 66,
  dark = false,
  zooms = [],
  marks = [],
  playbackRate = 1,
  startFrom = 0,
  segments,
  clipSeconds,
  children,
}: {
  clip: string;
  n: string;
  chapter: string;
  title: { text: string; accent?: boolean }[];
  titleFrames?: number;
  dark?: boolean;
  zooms?: Zoom[];
  marks?: Mark[];
  playbackRate?: number;
  /** Seconds into the clip to start from. */
  startFrom?: number;
  /** Cuts of the recording, in order; overrides startFrom and playbackRate. */
  segments?: Segment[];
  /** The recording's length, so its last frame is held rather than going blank. */
  clipSeconds: number;
  children?: React.ReactNode;
}) {
  const frame = useCurrentFrame();
  const bg = dark ? C.ink : C.paper;
  const fg = dark ? C.paper : C.ink;
  const wipe = interpolate(frame, [titleFrames - 22, titleFrames + 6], [0, 1], { ...clamp, easing: easeInOut });
  const cam = camera(frame, zooms);
  const enter = rise(frame, titleFrames - 18, 34);

  return (
    <AbsoluteFill style={{ background: bg }}>
      {/* the recording, framed */}
      <AbsoluteFill>
        <ChapterTag n={n} label={chapter} dark={dark} />
        <div
          style={{
            position: "absolute",
            left: FX,
            top: FY,
            width: FW,
            height: FH,
            overflow: "hidden",
            outline: `2px solid ${fg}`,
            boxShadow: dark ? "0 30px 80px rgba(0,0,0,0.5)" : "0 30px 70px rgba(20,19,17,0.22)",
            transform: `translateY(${(1 - enter) * 40}px) scale(${0.97 + 0.03 * enter})`,
            opacity: enter,
          }}
        >
          <div
            style={{
              width: 1920,
              height: 1080,
              transform: `scale(${S})`,
              transformOrigin: "0 0",
            }}
          >
            <div style={{ width: 1920, height: 1080, transform: `scale(${cam.s})`, transformOrigin: `${cam.x}px ${cam.y}px` }}>
              <Recording clip={clip} segments={segments ?? [{ from: 0, clip: startFrom, rate: playbackRate }]} clipSeconds={clipSeconds} />
              {/* callouts live inside the camera, so they stay on their target as it pushes in */}
              <svg width={1920} height={1080} style={{ position: "absolute", inset: 0, overflow: "visible" }}>
                {marks.map((m, i) => (
                  <MarkBox key={i} m={m} frame={frame} />
                ))}
              </svg>
            </div>
          </div>
        </div>
        <div style={{ position: "absolute", left: FX - 34, top: FY - 34, width: FW + 68, height: FH + 68, pointerEvents: "none", opacity: enter }}>
          <Corners inset={0} size={44} color={dark ? C.paper : C.ink} width={3} />
        </div>
        {/* the tags, outside the camera so their type stays sharp and the same size */}
        {marks.map((m, i) => (
          <MarkTag key={i} m={m} frame={frame} cam={cam} />
        ))}
        {children}
      </AbsoluteFill>

      {/* the title card: the site's own tagline */}
      <AbsoluteFill
        style={{
          background: bg,
          justifyContent: "center",
          paddingLeft: 140,
          clipPath: `inset(0 0 ${wipe * 100}% 0)`,
        }}
      >
        <span style={{ ...micro(dark ? C.mint : C.violet, 24), fontWeight: 700, marginBottom: 30 }}>
          [{n}] {"//"} {chapter}
        </span>
        <PosterLines at={2} size={190} color={fg} accent={dark ? C.violetTint : C.violet} lines={title} />
      </AbsoluteFill>
    </AbsoluteFill>
  );
}

function markOpacity(m: Mark, frame: number): number {
  const p = rise(frame, m.at, 18);
  const out = m.until === undefined ? 1 : interpolate(frame, [m.until - 10, m.until], [1, 0], clamp);
  return Math.min(p, out);
}

const toneColor = (t: Mark["tone"]) => ({ violet: C.violet, mint: C.mint, carmine: C.carmine, ink: C.ink })[t ?? "violet"];

function MarkBox({ m, frame }: { m: Mark; frame: number }) {
  const o = markOpacity(m, frame);
  if (o <= 0) return null;
  const [x, y, w, h] = m.box;
  const per = 2 * (w + h);
  const draw = interpolate(frame, [m.at, m.at + 24], [0, 1], { ...clamp, easing: easeInOut });
  return (
    <g opacity={o}>
      <rect x={x - 10} y={y - 10} width={w + 20} height={h + 20} rx={6} fill="none" stroke={toneColor(m.tone)} strokeWidth={6} strokeDasharray={per + 80} strokeDashoffset={(per + 80) * (1 - draw)} />
    </g>
  );
}

function MarkTag({ m, frame, cam }: { m: Mark; frame: number; cam: { s: number; x: number; y: number } }) {
  const o = markOpacity(m, frame);
  if (o <= 0) return null;
  const [x, y, , h] = m.box;
  // where the box corner lands on screen, through the camera and the frame
  const px = cam.x + (x - 10 - cam.x) * cam.s;
  const py = cam.y + ((m.tagSide === "bottom" ? y + h + 10 : y - 10) - cam.y) * cam.s;
  const sx = FX + px * S;
  const sy = FY + py * S;
  const fg = m.tone === "mint" ? C.ink : C.paper;
  const p = rise(frame, m.at + 4, 16);
  return (
    <div
      style={{
        position: "absolute",
        left: Math.max(20, sx),
        top: m.tagSide === "bottom" ? sy + 10 : sy - 54,
        padding: "9px 16px",
        background: toneColor(m.tone),
        color: fg,
        fontFamily: "'JetBrains Mono', monospace",
        fontWeight: 700,
        fontSize: 23,
        letterSpacing: "0.08em",
        textTransform: "uppercase",
        whiteSpace: "nowrap",
        opacity: o,
        transform: `translateY(${(1 - p) * 10}px)`,
        boxShadow: "0 8px 20px rgba(0,0,0,0.25)",
      }}
    >
      {m.label}
    </div>
  );
}

/** The recording, as a run of cuts; each cut holds its last frame if the scene outlasts it. */
function Recording({ clip, segments, clipSeconds }: { clip: string; segments: Segment[]; clipSeconds: number }) {
  return (
    <>
      {segments.map((seg, i) => {
        const next = segments[i + 1]?.from;
        const rate = seg.rate ?? 1;
        // scene frames this cut can play before the recording runs out
        const room = Math.floor(((clipSeconds - seg.clip) * 60) / rate) - 2;
        return (
          <Sequence key={i} from={seg.from} durationInFrames={next === undefined ? undefined : next - seg.from} layout="none">
            <Held room={room}>
              <OffthreadVideo src={staticFile(`rec/${clip}.mp4`)} muted playbackRate={rate} startFrom={Math.round(seg.clip * 60)} style={{ position: "absolute", width: 1920, height: 1080 }} />
            </Held>
          </Sequence>
        );
      })}
    </>
  );
}

function Held({ room, children }: { room: number; children: React.ReactNode }) {
  const frame = useCurrentFrame();
  return (
    <Freeze frame={room} active={frame > room}>
      {children}
    </Freeze>
  );
}
