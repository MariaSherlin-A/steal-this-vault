import { FPS } from "./theme";
import timing from "./timing.json";

export type SceneId = "wallet" | "leak" | "drain" | "quantum" | "qday" | "title" | "dare" | "locks" | "attacks" | "control" | "product" | "drill" | "close";

export interface Scene {
  id: SceneId;
  /** Base name of the voice file in public/audio, without extension. */
  file: string;
  /** Extension of the voice file when one was measured, else null: no audio is placed. */
  audio: string | null;
  start: number;
  frames: number;
  /** Frames of silence before the voice starts inside the scene. */
  lead: number;
}

const tail = Math.round(timing.tailSeconds * FPS);

interface Row {
  id: string;
  file: string;
  audio: string | null;
  seconds: number;
  lead?: number;
  hold?: number;
}

/** Same rounding as scripts/score.mjs, so the music and the picture stay frame-aligned. */
export function sceneFrames(s: Row): { frames: number; lead: number } {
  const lead = s.audio ? Math.round((s.lead ?? 0) * FPS) : 0;
  const hold = s.audio ? Math.round((s.hold ?? 0) * FPS) : 0;
  return { lead, frames: lead + Math.round(s.seconds * FPS) + hold + (s.audio ? tail : 0) };
}

export const SCENES: Scene[] = (() => {
  let start = 0;
  return (timing.scenes as Row[]).map((s) => {
    const { frames, lead } = sceneFrames(s);
    const scene: Scene = { id: s.id as SceneId, file: s.file, audio: s.audio, start, frames, lead };
    start += frames;
    return scene;
  });
})();

export const TOTAL_FRAMES = SCENES.reduce((n, s) => n + s.frames, 0);
