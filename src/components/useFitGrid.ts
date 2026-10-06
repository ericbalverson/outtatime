"use client";

import { useEffect, useState, type RefObject } from "react";

export const FIT_GAP = 12;
/** Below this tile height the grid scrolls instead of shrinking further. */
const MIN_ROW = 96;
/** Preferred tile shape (width / height); layouts closest to it make the biggest readable tiles. */
const ASPECT = 1.6;

/**
 * Pick the column count that gives `count` tiles the largest size inside the element,
 * re-measuring whenever the element resizes.
 */
export function useFitGrid(ref: RefObject<HTMLElement | null>, count: number, enabled: boolean) {
  const [layout, setLayout] = useState<{ cols: number; rowH: number } | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!enabled || !el || count === 0) return setLayout(null);

    const calc = () => {
      const W = el.clientWidth;
      const H = el.clientHeight;
      let best = { cols: 1, rowH: H, score: -1 };
      for (let cols = 1; cols <= count; cols++) {
        const rows = Math.ceil(count / cols);
        const w = (W - FIT_GAP * (cols - 1)) / cols;
        const h = (H - FIT_GAP * (rows - 1)) / rows;
        const score = Math.min(w, h * ASPECT);
        if (score > best.score) best = { cols, rowH: h, score };
      }
      setLayout({ cols: best.cols, rowH: Math.max(MIN_ROW, Math.floor(best.rowH)) });
    };

    calc();
    const ro = new ResizeObserver(calc);
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref, count, enabled]);

  return layout;
}
