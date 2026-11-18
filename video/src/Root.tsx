import React from "react";
import { AbsoluteFill, Audio, Composition, Sequence, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { C, FPS, H, W } from "./theme";
import { SCENES, TOTAL_FRAMES, type SceneId } from "./timing";
import { NARRATION } from "./script";
import { sceneFade } from "./components/anim";
import { Captions, Grain } from "./components/kit";
import { IncidentScene, ThreatScene, TitleScene } from "./scenes/Opening";
import { AttacksScene, ControlScene, DareScene, LocksScene } from "./scenes/Steps";
import { CloseScene, DrillScene, ProductScene } from "./scenes/Ending";

const SCENE: Record<SceneId, React.FC> = {
  incident: IncidentScene,
  threat: ThreatScene,
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

export const Main: React.FC = () => (
  <AbsoluteFill style={{ background: C.bg, color: C.text }}>
    {SCENES.map((s) => {
      const Scene = SCENE[s.id];
      return (
        <Sequence key={s.id} from={s.start} durationInFrames={s.frames} name={s.id}>
          <Fade>
            <Scene />
            <Captions text={NARRATION[s.id]} />
          </Fade>
          {s.audio ? <Audio src={staticFile(`audio/${s.file}.${s.audio}`)} /> : null}
        </Sequence>
      );
    })}
    <Grain />
  </AbsoluteFill>
);

export const RemotionRoot: React.FC = () => (
  <Composition id="Main" component={Main} durationInFrames={TOTAL_FRAMES} fps={FPS} width={W} height={H} />
);
