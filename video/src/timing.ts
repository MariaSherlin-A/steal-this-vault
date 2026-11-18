import { FPS } from "./theme";
import timing from "./timing.json";

export type SceneId = "incident" | "threat" | "title" | "dare" | "locks" | "attacks" | "control" | "product" | "drill" | "close";

export interface Scene {
  id: SceneId;
  /** Base name of the voice file in public/audio, without extension. */
  file: string;
  /** Extension of the voice file when one was measured, else null: no audio is placed. */
  audio: string | null;
  start: number;
  frames: number;
}

const tail = Math.round(timing.tailSeconds * FPS);

export const SCENES: Scene[] = (() => {
  let start = 0;
  return timing.scenes.map((s) => {
    const frames = Math.round(s.seconds * FPS) + (s.audio ? tail : 0);
    const scene: Scene = { id: s.id as SceneId, file: s.file, audio: s.audio, start, frames };
    start += frames;
    return scene;
  });
})();

export const TOTAL_FRAMES = SCENES.reduce((n, s) => n + s.frames, 0);
