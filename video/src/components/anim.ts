import { Easing, interpolate } from "remotion";

export const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

export const ease = Easing.out(Easing.cubic);

export function fadeIn(frame: number, at: number, len = 12): number {
  return interpolate(frame, [at, at + len], [0, 1], clamp);
}

export function fadeOut(frame: number, at: number, len = 12): number {
  return interpolate(frame, [at, at + len], [1, 0], clamp);
}

/** Opacity and a small upward drift, for text that arrives. */
export function rise(frame: number, at: number, len = 18, px = 26): React.CSSProperties {
  const y = interpolate(frame, [at, at + len], [px, 0], { ...clamp, easing: ease });
  return { opacity: fadeIn(frame, at, len), transform: `translateY(${y}px)` };
}

/** A number counting up from 0, with a soft landing. */
export function countUp(frame: number, at: number, len: number, to: number): number {
  return interpolate(frame, [at, at + len], [0, to], { ...clamp, easing: ease });
}

/** Fade the whole scene in at its start and out at its end. */
export function sceneFade(frame: number, total: number, len = 14): number {
  return Math.min(fadeIn(frame, 0, len), fadeOut(frame, total - len, len));
}
