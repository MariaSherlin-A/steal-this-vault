/**
 * The site is a set of views, one per menu item, chosen by the address hash
 * (#lab, #record...). Switching view starts at the top of the new view instead
 * of scrolling through the whole page.
 */
import { useEffect, useState } from "react";

export const VIEWS = [
  ["top", "Home"],
  ["experiment", "The experiment"],
  ["lab", "Try to rob it"],
  ["record", "The record"],
  ["how", "How it works"],
  ["technical", "Technical details"],
] as const;

export type View = (typeof VIEWS)[number][0];

/** Section ids that live inside another view. */
const INSIDE: Record<string, View> = { intruders: "record", stake: "how" };

function read(): { view: View; anchor: string | null } {
  const id = window.location.hash.replace(/^#/, "");
  if (VIEWS.some(([v]) => v === id)) return { view: id as View, anchor: null };
  if (id in INSIDE) return { view: INSIDE[id]!, anchor: id };
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
      // a section inside the view: wait for it to render, then go straight to it
      const id = state.anchor;
      requestAnimationFrame(() => document.getElementById(id)?.scrollIntoView({ block: "start" }));
    } else {
      window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
    }
  }, [state]);

  return state.view;
}

/** The view after this one, for the "next" link at the bottom of each view. */
export function nextView(view: View): (typeof VIEWS)[number] | null {
  const i = VIEWS.findIndex(([v]) => v === view);
  return VIEWS[i + 1] ?? null;
}
