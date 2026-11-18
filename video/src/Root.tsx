import React from "react";
import { AbsoluteFill, Audio, Composition, Sequence, getInputProps, interpolate, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { C, FONT, FPS, H, W, alpha } from "./theme";
import { SCENES, TOTAL_FRAMES, type SceneId } from "./timing";
import { NARRATION } from "./script";
import captionsJson from "./captions.json";
import { clamp, ease } from "./components/anim";
import { Captions, Grain, type TimedLine } from "./components/kit";
import { IncidentScene, TitleScene } from "./scenes/Opening";
import { QDayScene, QuantumScene, LeakScene, WalletScene } from "./scenes/Problem";
import { AttacksScene, ControlScene, DareScene, LocksScene } from "./scenes/Steps";
import { CloseScene, DrillScene, ProductScene } from "./scenes/Ending";

/** Subtitles of the narration along the bottom, timed to the voice by scripts/timing.mjs. */
const SHOW_CAPTIONS = !(getInputProps() as { clean?: boolean }).clean;

const SCENE: Record<SceneId, React.FC> = {
  wallet: WalletScene,
  leak: LeakScene,
  drain: IncidentScene,
  quantum: QuantumScene,
  qday: QDayScene,
  title: TitleScene,
  dare: DareScene,
  locks: LocksScene,
  attacks: AttacksScene,
  control: ControlScene,
  product: ProductScene,
  drill: DrillScene,
  close: CloseScene,
};

/**
 * A cinematic shot: the scene arrives out of a soft blur and a slight zoom, the camera pushes in
 * slowly while it plays, and it leaves with a short blur-out. Frame and duration are the sequence's own.
 */
const Shot: React.FC<{ children: React.ReactNode; first: boolean }> = ({ children, first }) => {
  const frame = useCurrentFrame();
  const { durationInFrames: d } = useVideoConfig();
  const IN = first ? 24 : 14;
  const OUT = 10;
  const enter = interpolate(frame, [0, IN], [0, 1], { ...clamp, easing: ease });
  const leave = interpolate(frame, [d - OUT, d], [0, 1], clamp);
  const push = interpolate(frame, [0, d], [1, 1.035]);
  const scale = push * (1 + 0.05 * (1 - enter)) * (1 + 0.025 * leave);
  const blur = 10 * (1 - enter) + 8 * leave;
  return (
    <AbsoluteFill
      style={{
        opacity: Math.min(enter, 1 - leave),
        transform: `scale(${scale})`,
        filter: blur > 0.05 ? `blur(${blur}px)` : undefined,
      }}
    >
      {children}
    </AbsoluteFill>
  );
};

/** A band of light that sweeps across the frame on each cut. */
const Sweep: React.FC = () => {
  const frame = useCurrentFrame();
  const p = interpolate(frame, [0, 16], [-0.4, 1.4], { ...clamp, easing: ease });
  const o = interpolate(frame, [0, 4, 16], [0, 0.55, 0], clamp);
  return (
    <AbsoluteFill
      style={{
        pointerEvents: "none",
        mixBlendMode: "screen",
        opacity: o,
        background: `linear-gradient(105deg, transparent ${p * 100 - 12}%, ${alpha(C.primary, 0.5)} ${p * 100 - 3}%, ${alpha(C.safe, 0.85)} ${p * 100}%, ${alpha(C.primary, 0.5)} ${p * 100 + 3}%, transparent ${p * 100 + 12}%)`,
      }}
    />
  );
};

/** A quiet heads-up frame over the film: corner brackets, a channel tag and a progress line. */
const Hud: React.FC = () => {
  const frame = useCurrentFrame();
  const bracket = (pos: React.CSSProperties, rot: number) => (
    <div style={{ position: "absolute", width: 34, height: 34, ...pos, transform: `rotate(${rot}deg)` }}>
      <div style={{ position: "absolute", left: 0, top: 0, width: 34, height: 2, background: alpha(C.primary, 0.55) }} />
      <div style={{ position: "absolute", left: 0, top: 0, width: 2, height: 34, background: alpha(C.primary, 0.55) }} />
    </div>
  );
  const scene = SCENES.find((s) => frame >= s.start && frame < s.start + s.frames);
  const hidden = scene?.id === "title" || scene?.id === "close";
  const show = interpolate(frame, [20, 50], [0, 1], clamp) * (hidden ? 0 : 1);
  const live = 0.55 + 0.45 * Math.abs(Math.sin(frame / 18));
  return (
    <AbsoluteFill style={{ pointerEvents: "none", opacity: show }}>
      {bracket({ left: 36, top: 36 }, 0)}
      {bracket({ right: 36, top: 36 }, 90)}
      {bracket({ right: 36, bottom: 36 }, 180)}
      {bracket({ left: 36, bottom: 36 }, 270)}
      <div
        style={{
          position: "absolute",
          right: 96,
          top: 84,
          display: "flex",
          alignItems: "center",
          gap: 12,
          font: `600 17px ${FONT.mono}`,
          letterSpacing: "0.18em",
          color: alpha(C.text, 0.6),
        }}
      >
        <span style={{ width: 9, height: 9, borderRadius: 5, background: C.safe, opacity: live, boxShadow: `0 0 12px ${C.safe}` }} />
        QORECHAIN TESTNET
      </div>
      <div style={{ position: "absolute", left: 0, bottom: 0, height: 3, width: W, background: alpha(C.line, 0.4) }}>
        <div style={{ height: 3, width: (W * frame) / TOTAL_FRAMES, background: `linear-gradient(90deg, ${C.primary}, ${C.safe})`, boxShadow: `0 0 12px ${alpha(C.safe, 0.8)}` }} />
      </div>
    </AbsoluteFill>
  );
};

const CAPTIONS = captionsJson as Partial<Record<SceneId, { speech: [number, number][]; lines: TimedLine[] }>>;

/** Absolute speech spans in frames, so the music can dip under the voice. */
const SPEECH: [number, number][] = SCENES.flatMap((s) =>
  s.audio ? (CAPTIONS[s.id]?.speech ?? []).map(([a, b]) => [s.start + s.lead + a * FPS, s.start + s.lead + b * FPS] as [number, number]) : [],
);

/** Music volume: 1 between lines, 0.32 under the voice, with short fades either side. */
function musicVolume(f: number): number {
  let v = 1;
  for (const [a, b] of SPEECH) {
    const inside = f >= a - 6 && f <= b + 9;
    if (!inside) continue;
    const edge = Math.min(1, (f - (a - 6)) / 6, (b + 9 - f) / 9);
    v = Math.min(v, 1 - 0.68 * Math.max(0, edge));
  }
  return v;
}

export const Main: React.FC = () => (
  <AbsoluteFill style={{ background: C.bg, color: C.text }}>
    {SCENES.map((s, i) => {
      const Scene = SCENE[s.id];
      return (
        <Sequence key={s.id} from={s.start} durationInFrames={s.frames} name={s.id}>
          <Shot first={i === 0}>
            <Scene />
          </Shot>
          {i > 0 ? (
            <Sequence durationInFrames={18} name="sweep">
              <Sweep />
            </Sequence>
          ) : null}
          {s.audio ? (
            <Sequence from={s.lead} name="voice">
              <Audio src={staticFile(`audio/${s.file}.${s.audio}`)} />
              {SHOW_CAPTIONS ? <Captions text={NARRATION[s.id]} lines={CAPTIONS[s.id]?.lines} /> : null}
            </Sequence>
          ) : null}
        </Sequence>
      );
    })}
    <Hud />
    {/* the original score, composed in code to these scene lengths: npm run score */}
    <Audio src={staticFile("music/score.wav")} volume={(f) => musicVolume(f)} />
    <Grain />
  </AbsoluteFill>
);

export const RemotionRoot: React.FC = () => (
  <Composition id="Main" component={Main} durationInFrames={TOTAL_FRAMES} fps={FPS} width={W} height={H} />
);
