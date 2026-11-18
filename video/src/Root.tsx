import React from "react";
import { AbsoluteFill, Audio, Composition, Sequence, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { C, FPS, H, W } from "./theme";
import { SCENES, TOTAL_FRAMES, type SceneId } from "./timing";
import { NARRATION } from "./script";
import captionsJson from "./captions.json";
import { sceneFade } from "./components/anim";
import { Captions, Grain, type TimedLine } from "./components/kit";
import { IncidentScene, TitleScene } from "./scenes/Opening";
import { QDayScene, QuantumScene, LeakScene, WalletScene } from "./scenes/Problem";
import { AttacksScene, ControlScene, DareScene, LocksScene } from "./scenes/Steps";
import { CloseScene, DrillScene, ProductScene } from "./scenes/Ending";

/** Subtitles of the narration along the bottom, timed to the voice by scripts/timing.mjs. */
const SHOW_CAPTIONS = true;

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

/** Fades a scene in at its start and out at its end; frame and duration are the sequence's own. */
const Fade: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  return <AbsoluteFill style={{ opacity: sceneFade(frame, durationInFrames, 10) }}>{children}</AbsoluteFill>;
};

const CAPTIONS = captionsJson as Partial<Record<SceneId, { speech: [number, number][]; lines: TimedLine[] }>>;

/** Absolute speech spans in frames, so the music can dip under the voice. */
const SPEECH: [number, number][] = SCENES.flatMap((s) =>
  s.audio ? (CAPTIONS[s.id]?.speech ?? []).map(([a, b]) => [s.start + a * FPS, s.start + b * FPS] as [number, number]) : [],
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
    {SCENES.map((s) => {
      const Scene = SCENE[s.id];
      return (
        <Sequence key={s.id} from={s.start} durationInFrames={s.frames} name={s.id}>
          <Fade>
            <Scene />
            {SHOW_CAPTIONS && s.audio ? <Captions text={NARRATION[s.id]} lines={CAPTIONS[s.id]?.lines} /> : null}
          </Fade>
          {s.audio ? <Audio src={staticFile(`audio/${s.file}.${s.audio}`)} /> : null}
        </Sequence>
      );
    })}
    {/* the original score, composed in code to these scene lengths: npm run score */}
    <Audio src={staticFile("music/score.wav")} volume={(f) => musicVolume(f)} />
    <Grain />
  </AbsoluteFill>
);

export const RemotionRoot: React.FC = () => (
  <Composition id="Main" component={Main} durationInFrames={TOTAL_FRAMES} fps={FPS} width={W} height={H} />
);
