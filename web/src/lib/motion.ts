/**
 * Motion for the whole site: smooth scrolling (Lenis) driving GSAP's scroll
 * triggers, and a few reusable effects. Everything here is skipped when the
 * visitor has asked their system for reduced motion.
 */
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { SplitText } from "gsap/SplitText";
import Lenis from "lenis";
import { useEffect, useLayoutEffect, type RefObject } from "react";

gsap.registerPlugin(ScrollTrigger, SplitText);

export { gsap, ScrollTrigger };

export const reducedMotion = (): boolean =>
  typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

let lenis: Lenis | null = null;

/** Starts smooth scrolling once, for the life of the page. */
export function useSmoothScroll(): void {
  useEffect(() => {
    if (reducedMotion() || lenis) return;
    const instance = new Lenis({ duration: 1.05, easing: (t) => 1 - Math.pow(1 - t, 4) });
    lenis = instance;
    instance.on("scroll", ScrollTrigger.update);
    const tick = (time: number) => instance.raf(time * 1000);
    gsap.ticker.add(tick);
    gsap.ticker.lagSmoothing(0);
    return () => {
      gsap.ticker.remove(tick);
      instance.destroy();
      lenis = null;
    };
  }, []);
}

/** Jump without animation: used when a new page view opens, or when the menu covers the screen. */
export function jumpTo(target: number | HTMLElement): void {
  if (lenis) {
    lenis.scrollTo(target, { immediate: true, force: true, offset: typeof target === "number" ? 0 : -64 });
  } else if (typeof target === "number") {
    window.scrollTo({ top: target, behavior: "instant" as ScrollBehavior });
  } else {
    window.scrollTo({ top: target.getBoundingClientRect().top + window.scrollY - 64, behavior: "instant" as ScrollBehavior });
  }
  requestAnimationFrame(() => ScrollTrigger.refresh());
}

/** Holds the page still, for example while the menu is open. */
export function holdScroll(hold: boolean): void {
  if (lenis) {
    if (hold) lenis.stop();
    else lenis.start();
  }
  document.documentElement.classList.toggle("is-held", hold);
}

const useIso = typeof window === "undefined" ? useEffect : useLayoutEffect;

/**
 * Poster headlines rise line by line out of a mask the first time they reach
 * the view. The text stays real text for screen readers and search.
 */
export function useSplitReveal(ref: RefObject<HTMLElement>, deps: unknown[] = []): void {
  useIso(() => {
    const el = ref.current;
    if (!el || reducedMotion()) return;
    const ctx = gsap.context(() => {
      const split = SplitText.create(el, { type: "lines", mask: "lines", linesClass: "split-line", autoSplit: true,
        onSplit: (self) =>
          gsap.from(self.lines, {
            yPercent: 112,
            rotate: 2.5,
            duration: 1.05,
            ease: "expo.out",
            stagger: 0.09,
            scrollTrigger: { trigger: el, start: "top 88%", once: true },
          }),
      });
      return () => split.revert();
    }, el);
    return () => ctx.revert();
  }, deps);
}

/** Children marked `data-rise` slide up and fade in, one after another, when the block reaches the view. */
export function useRise(ref: RefObject<HTMLElement>, deps: unknown[] = []): void {
  useIso(() => {
    const el = ref.current;
    if (!el || reducedMotion()) return;
    const ctx = gsap.context(() => {
      const items = el.querySelectorAll<HTMLElement>("[data-rise]");
      if (items.length === 0) return;
      gsap.from(items, {
        y: 44,
        autoAlpha: 0,
        duration: 0.9,
        ease: "power3.out",
        stagger: 0.08,
        scrollTrigger: { trigger: el, start: "top 82%", once: true },
      });
    }, el);
    return () => ctx.revert();
  }, deps);
}

/** Buttons that lean towards the pointer a little, and settle back when it leaves. */
export function useMagnetic(ref: RefObject<HTMLElement>, strength = 0.28): void {
  useEffect(() => {
    const el = ref.current;
    if (!el || reducedMotion() || !window.matchMedia("(hover: hover)").matches) return;
    const x = gsap.quickTo(el, "x", { duration: 0.5, ease: "power3.out" });
    const y = gsap.quickTo(el, "y", { duration: 0.5, ease: "power3.out" });
    const move = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      x((e.clientX - (r.left + r.width / 2)) * strength);
      y((e.clientY - (r.top + r.height / 2)) * strength);
    };
    const leave = () => {
      x(0);
      y(0);
    };
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerleave", leave);
    return () => {
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerleave", leave);
    };
  }, [ref, strength]);
}
