"use client";

import { useEffect, useRef, useState } from "react";
import { SERVICE_GROUPS, SERVICE_ITEMS, STOCK } from "../content";
import { Btn } from "./Btn";
import { ServiceGraphic } from "./ServiceGraphics";

const BLURBS = new Map(SERVICE_ITEMS.map((s) => [s.title, s.blurb]));

/**
 * The Services page body: a sticky index of the four groups on the left (a row
 * of chips on phones) and the four content panels on the right. The index
 * follows the scroll: the group in view is marked (`aria-current`), with a red
 * bar on its left and a thin progress bar showing how far through that panel
 * you are; clicking one scrolls to its panel. Each panel has a 16:9 photo, the
 * group's line graphic beside its title, the description, a grid of service cards
 * and a "Discuss This Service" button that opens the contact modal with the message pre-filled.
 */
export function ServicePanels() {
  const [active, setActive] = useState(0);
  const panels = useRef<(HTMLElement | null)[]>([]);
  const bars = useRef<(HTMLElement | null)[]>([]);
  const index = useRef<HTMLElement>(null);

  // on a phone the index is a row of chips: keep the active chip in view (sideways only, the page does not move)
  useEffect(() => {
    const nav = index.current;
    const chip = nav?.querySelectorAll<HTMLElement>(".hok-svc-index__btn")[active];
    if (!nav || !chip || nav.scrollWidth <= nav.clientWidth) return;
    nav.scrollTo({ left: chip.offsetLeft - (nav.clientWidth - chip.offsetWidth) / 2, behavior: "smooth" });
  }, [active]);

  useEffect(() => {
    const els = panels.current.filter((el): el is HTMLElement => !!el);
    // the panel crossing a line 35 % down the screen is the active one
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) setActive(Number((entry.target as HTMLElement).dataset.index));
        }
      },
      { rootMargin: "-35% 0px -64% 0px" },
    );
    els.forEach((el) => io.observe(el));

    let frame = 0;
    const progress = () => {
      frame = 0;
      const line = window.innerHeight * 0.35;
      els.forEach((el, i) => {
        const r = el.getBoundingClientRect();
        const p = Math.min(1, Math.max(0, (line - r.top) / Math.max(1, r.height)));
        bars.current[i]?.style.setProperty("--p", p.toFixed(3));
      });
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(progress);
    };
    progress();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      io.disconnect();
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  function go(i: number) {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    panels.current[i]?.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "start" });
  }

  return (
    <div className="hok-svc-layout">
      <nav className="hok-svc-index" aria-label="Service groups" ref={index}>
        {SERVICE_GROUPS.map((group, i) => (
          <button
            key={group.title}
            type="button"
            className={`hok-svc-index__btn${i === active ? " is-active" : ""}`}
            aria-current={i === active ? "true" : undefined}
            onClick={() => go(i)}
          >
            <span className="hok-svc-index__n">{String(i + 1).padStart(2, "0")}</span>
            <span className="hok-svc-index__t">{group.title}</span>
            <span className="hok-svc-index__bar" aria-hidden="true" ref={(el) => void (bars.current[i] = el)}>
              <i />
            </span>
          </button>
        ))}
      </nav>

      <div className="hok-svc-panels">
        {SERVICE_GROUPS.map((group, i) => (
          <section
            key={group.title}
            id={`svc-${i}`}
            data-index={i}
            ref={(el) => void (panels.current[i] = el)}
            className="hok-panel"
            aria-labelledby={`svc-${i}-title`}
          >
            <div className="hok-panel__media" data-reveal="clip">
              <img src={STOCK.svc[i]} alt="" width={1600} height={900} sizes="(min-width: 992px) 70vw, 100vw" loading="lazy" decoding="async" />
            </div>
            <div className="hok-panel__head">
              <span className="hok-panel__gfx">
                <ServiceGraphic group={group.title} />
              </span>
              <h2 className="hok-panel__title" id={`svc-${i}-title`}>
                {group.title}
              </h2>
            </div>
            <p className="hok-panel__text">{group.text}</p>
            <ul className="hok-panel__items">
              {group.items.map((item) => (
                <li key={item} className="hok-item">
                  <h3 className="hok-item__t">{item}</h3>
                  <p>{BLURBS.get(item)}</p>
                </li>
              ))}
            </ul>
            <Btn href="/contact" contact data-contact-message={`Hi HOK, I'd like to talk about ${group.title}.`}>
              Discuss This Service
            </Btn>
          </section>
        ))}
      </div>
    </div>
  );
}
