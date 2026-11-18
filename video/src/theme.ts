/** The site's palette and type (quantum blue), so the film and the site read as one thing. */
import { loadFont as loadDisplay } from "@remotion/google-fonts/SpaceGrotesk";
import { loadFont as loadSans } from "@remotion/google-fonts/IBMPlexSans";
import { loadFont as loadMono } from "@remotion/google-fonts/JetBrainsMono";

const display = loadDisplay("normal", { weights: ["500", "600", "700"], subsets: ["latin"] });
const sans = loadSans("normal", { weights: ["400", "500", "600"], subsets: ["latin"] });
const mono = loadMono("normal", { weights: ["400", "500", "700"], subsets: ["latin"] });

export const FONT = {
  display: `${display.fontFamily}, system-ui, sans-serif`,
  sans: `${sans.fontFamily}, system-ui, "Segoe UI", sans-serif`,
  mono: `${mono.fontFamily}, Consolas, monospace`,
} as const;

export const C = {
  bg: "#05070f",
  bg2: "#0b1020",
  panel: "#0e1426",
  panel2: "#131b33",
  line: "#22304f",
  lineSoft: "#182241",
  text: "#e8ecf6",
  muted: "#9aa6c2",
  faint: "#5e6a88",
  primary: "#4c7dff",
  primaryDeep: "#2a47a3",
  safe: "#5ce1e6",
  safeDeep: "#123a44",
  red: "#ff4d5e",
  redDeep: "#4a1621",
} as const;

/** rgba() from one of the palette hexes. */
export function alpha(hex: string, a: number): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
}

export const W = 1920;
export const H = 1080;
export const FPS = 30;
