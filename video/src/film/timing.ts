/** Scene lengths for the second film, at 60 fps: a breath before the voice, the voice, a hold after. */
import words from "./words.json";
import { SCENES, type FilmScene } from "./script";

export const FPS = 60;
export const W = 1920;
export const H = 1080;

/** Seconds of quiet before the voice starts, and after it ends, per scene. */
const PAD: Record<FilmScene, [number, number]> = {
  problem: [0.6, 0.6],
  qday: [0.4, 0.9],
  dare: [0.5, 0.4],
  locks: [0.4, 0.4],
  replay: [0.3, 0.4],
  score: [0.4, 0.4],
  lab: [0.5, 0.6],
  drill: [0.4, 0.5],
  watch: [0.4, 0.4],
  intruders: [0.3, 0.4],
  close: [0.6, 2.8],
};

export interface Word {
  text: string;
  /** Frames from the start of the scene. */
  from: number;
  to: number;
}

export interface SceneTiming {
  id: FilmScene;
  file: string;
  start: number;
  frames: number;
  /** Frames before the voice starts. */
  lead: number;
  words: Word[];
}

type WordsJson = Record<FilmScene, { file: string; seconds: number; words: [string, number, number][] }>;
const W_ = words as unknown as WordsJson;

export const TIMELINE: SceneTiming[] = (() => {
  let start = 0;
  return SCENES.map((id) => {
    const w = W_[id];
    const lead = Math.round(PAD[id][0] * FPS);
    const frames = lead + Math.round(w.seconds * FPS) + Math.round(PAD[id][1] * FPS);
    const scene: SceneTiming = {
      id,
      file: w.file,
      start,
      frames,
      lead,
      words: w.words.map(([text, a, b]) => ({ text, from: lead + Math.round(a * FPS), to: lead + Math.round(b * FPS) })),
    };
    start += frames;
    return scene;
  });
})();

export const TOTAL = TIMELINE.reduce((n, s) => n + s.frames, 0);

export const sceneOf = (id: FilmScene): SceneTiming => TIMELINE.find((s) => s.id === id)!;

/** The frame (within its scene) at which the first word matching `re` is spoken, after word `after`. */
export function cue(id: FilmScene, re: RegExp, after = 0): number {
  const s = sceneOf(id);
  const w = s.words.slice(after).find((x) => re.test(x.text));
  return w ? w.from : s.lead;
}
