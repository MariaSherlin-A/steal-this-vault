/** The site's palette and type, so the film and the site read as one thing. */
import { loadFont as loadSerif } from "@remotion/google-fonts/InstrumentSerif";
import { loadFont as loadSans } from "@remotion/google-fonts/Inter";
import { loadFont as loadMono } from "@remotion/google-fonts/JetBrainsMono";

const serif = loadSerif("normal", { weights: ["400"], subsets: ["latin"] });
const sans = loadSans("normal", { weights: ["400", "500", "600"], subsets: ["latin"] });
const mono = loadMono("normal", { weights: ["400", "500"], subsets: ["latin"] });

export const FONT = {
  serif: `${serif.fontFamily}, "Iowan Old Style", Georgia, serif`,
  sans: `${sans.fontFamily}, system-ui, "Segoe UI", sans-serif`,
  mono: `${mono.fontFamily}, Consolas, monospace`,
} as const;

export const C = {
  bg: "#0b0b0e",
  bg2: "#111116",
  panel: "#15151b",
  panel2: "#1b1b23",
  line: "#2a2a34",
  lineSoft: "#1f1f28",
  text: "#ece7dc",
  muted: "#a39d90",
  faint: "#6f6a61",
  brass: "#d8b46a",
  brassDeep: "#8f7235",
  mint: "#7fd6b0",
  mintDeep: "#1d3a30",
  red: "#ef6a4c",
  redDeep: "#40201a",
} as const;

export const W = 1920;
export const H = 1080;
export const FPS = 30;
