"use client";

import { useEffect, useRef } from "react";

type SwiperInstance = { destroy: (deleteInstance?: boolean, cleanStyles?: boolean) => void };
type SwiperCtor = new (el: HTMLElement, options: Record<string, unknown>) => SwiperInstance;

/**
 * One slider on the template's own Swiper (the global `Swiper` that
 * SiteDocument loads before hydration), configured here instead of in main.js
 * because main.js autoplays every slider every 1.5 s, which is too fast to read
 * a testimonial or play a reel. `children` are the `.swiper-slide`s.
 */
export function SiteSwiper({
  className,
  options,
  children,
}: {
  className?: string;
  options: Record<string, unknown>;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const optionsKey = JSON.stringify(options);

  useEffect(() => {
    const Swiper = (window as unknown as { Swiper?: SwiperCtor }).Swiper;
    if (!Swiper || !ref.current) return;
    const swiper = new Swiper(ref.current, JSON.parse(optionsKey) as Record<string, unknown>);
    return () => swiper.destroy(true, true);
  }, [optionsKey]);

  return (
    <div ref={ref} className={`swiper ${className ?? ""}`.trim()}>
      <div className="swiper-wrapper">{children}</div>
    </div>
  );
}
