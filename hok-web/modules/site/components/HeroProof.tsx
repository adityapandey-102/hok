"use client";

import { useEffect, useRef } from "react";
import { HERO } from "../content";

/**
 * The proof row at the bottom of the hero's left column: three counters (a value
 * in 24 px bold over a 13 px label) separated by hairlines. The server renders the
 * final values (no JavaScript, or reduced motion, shows them as they are); once
 * hydrated the numbers count up from 0 one time, over about 1.2 s.
 */
export function HeroProof() {
  const root = useRef<HTMLUListElement>(null);

  useEffect(() => {
    const el = root.current;
    if (!el || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const nums = Array.from(el.querySelectorAll<HTMLElement>("[data-count]"));
    const start = performance.now();
    const delay = 400;
    const duration = 1200;
    let raf = 0;
    nums.forEach((n) => (n.textContent = "0"));
    const tick = (now: number) => {
      const t = Math.min(1, Math.max(0, (now - start - delay) / duration));
      const eased = 1 - Math.pow(1 - t, 3);
      nums.forEach((n) => (n.textContent = String(Math.round(Number(n.dataset.count) * eased))));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      nums.forEach((n) => (n.textContent = n.dataset.count ?? ""));
    };
  }, []);

  return (
    <ul className="hok-proof hok-fade" ref={root} style={{ "--d": "1s" } as React.CSSProperties}>
      {HERO.proof.map((item) => (
        <li key={item.label} className="hok-proof__item">
          <span className="hok-proof__v">
            <span data-count={item.value}>{item.value}</span>
            {item.suffix}
          </span>
          <span className="hok-proof__l">
            <span className="hok-proof__l-full">{item.label}</span>
            <span className="hok-proof__l-short">{item.short}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}
