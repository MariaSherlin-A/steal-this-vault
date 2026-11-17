import React from "react";
import { AbsoluteFill, Audio, Composition, Sequence, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { C, FPS, H, W } from "./theme";
import { SCENES, TOTAL_FRAMES, type SceneId } from "./timing";
import { Background } from "./components/Background";
import { sceneFade } from "./components/anim";
import { KeyScene } from "./scenes/KeyScene";
import { QDayScene } from "./scenes/QDayScene";
import { VaultsScene } from "./scenes/VaultsScene";
import { AttacksScene } from "./scenes/AttacksScene";
import { RecordScene } from "./scenes/RecordScene";
import { LayersScene } from "./scenes/LayersScene";
import { AliveScene } from "./scenes/AliveScene";
import { CloseScene } from "./scenes/CloseScene";

const SCENE: Record<SceneId, React.FC> = {
  key: KeyScene,
  qday: QDayScene,
  vaults: VaultsScene,
  attacks: AttacksScene,
  record: RecordScene,
  layers: LayersScene,
  alive: AliveScene,
  close: CloseScene,
};

/** Fades a scene in at its start and out at its end; frame and duration are the sequence's own. */
const Fade: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  return <AbsoluteFill style={{ opacity: sceneFade(frame, durationInFrames) }}>{children}</AbsoluteFill>;
};

export const Main: React.FC = () => (
  <AbsoluteFill style={{ background: C.bg, color: C.text }}>
    <Background />
    {SCENES.map((s) => {
      const Scene = SCENE[s.id];
      return (
        <Sequence key={s.id} from={s.start} durationInFrames={s.frames} name={s.id}>
          <Fade>
            <Scene />
          </Fade>
          {s.audio ? <Audio src={staticFile(`audio/${s.file}.${s.audio}`)} /> : null}
        </Sequence>
      );
    })}
  </AbsoluteFill>
);

export const RemotionRoot: React.FC = () => (
  <Composition id="Main" component={Main} durationInFrames={TOTAL_FRAMES} fps={FPS} width={W} height={H} />
);
