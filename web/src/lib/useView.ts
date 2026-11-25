/**
 * The site is one long story (the home view) plus three working pages: the
 * attack lab, the intruder file and the technical details. The address hash
 * picks one (#lab, #intruders...). A hash that names a section of the story
 * (#locks, #drill...) opens the home view at that section.
 */
import { useEffect, useState } from "react";
import { jumpTo } from "./motion";

export const VIEWS = ["top", "lab", "intruders", "technical"] as const;
export type View = (typeof VIEWS)[number];

/** The numbered index shown in the menu, in reading order. */
export const INDEX = [
  { id: "top", n: "01", label: "The key", note: "Published on purpose" },
  { id: "locks", n: "02", label: "Two locks", note: "Why the key is not enough" },
  { id: "replay", n: "03", label: "Replay", note: "Real attempts, played back" },
  { id: "score", n: "04", label: "Scoreboard", note: "Same key, two endings" },
  { id: "drill", n: "05", label: "Q-Day drill", note: "The day every key leaks" },
  { id: "watch", n: "06", label: "Alerts & rescue", note: "Noticed, and a way out" },
  { id: "lab", n: "07", label: "Attack lab", note: "Your turn" },
  { id: "intruders", n: "08", label: "Intruders", note: "Every thief leaves a trail" },
  { id: "technical", n: "09", label: "Technical", note: "For the sceptics" },
] as const;

/** Section ids that live inside a view, including names the old site used. */
const INSIDE: Record<string, { view: View; anchor: string }> = {
  locks: { view: "top", anchor: "locks" },
  replay: { view: "top", anchor: "replay" },
  score: { view: "top", anchor: "score" },
  drill: { view: "top", anchor: "drill" },
  watch: { view: "top", anchor: "watch" },
  stake: { view: "lab", anchor: "stake" },
  how: { view: "top", anchor: "locks" },
  experiment: { view: "top", anchor: "score" },
  record: { view: "top", anchor: "score" },
};

function read(): { view: View; anchor: string | null } {
  const id = window.location.hash.replace(/^#/, "");
  if ((VIEWS as readonly string[]).includes(id)) return { view: id as View, anchor: null };
  if (id in INSIDE) return INSIDE[id]!;
  return { view: "top", anchor: null };
}

export function useView(): View {
  const [state, setState] = useState(read);

  useEffect(() => {
    const onHash = () => setState(read());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  useEffect(() => {
    if (state.anchor) {
      // wait for the view to render, then go straight to the section
      const id = state.anchor;
      requestAnimationFrame(() => {
        const el = document.getElementById(id);
        if (el) jumpTo(el);
      });
    } else {
      jumpTo(0);
    }
  }, [state]);

  return state.view;
}

/** The page after this one, for the large "next" link at the foot of each page. */
export function nextView(view: View): { id: string; n: string; label: string } | null {
  const order: { id: View; n: string; label: string }[] = [
    { id: "top", n: "01", label: "The key" },
    { id: "lab", n: "07", label: "Attack lab" },
    { id: "intruders", n: "08", label: "Intruders" },
    { id: "technical", n: "09", label: "Technical" },
  ];
  const i = order.findIndex((o) => o.id === view);
  return order[i + 1] ?? null;
}
