"use client";

import { Fragment, useState } from "react";
import { TESTIMONIALS, logoSrc } from "../content";
import { MaskText } from "./SectionHead";

/** "Team Kirpa Properties" -> "KP": a monogram for clients without a logo file. */
function initials(name: string) {
  return name
    .replace(/^Team /, "")
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

/**
 * Testimonials: the heading, one large centred quote and a row of the clients'
 * round logo chips as buttons. Clicking a chip (or the 7 s autoplay) switches
 * the quote, which slides in word by word. The active chip has a red ring and a
 * thin red bar showing the time left; hovering the section pauses it. Under
 * reduced motion there is no autoplay (the bar has no animation to end).
 */
export function Testimonials() {
  const [active, setActive] = useState(0);
  const [swapped, setSwapped] = useState(false); // the first quote shows without the word animation
  const t = TESTIMONIALS[active];

  function show(index: number) {
    setSwapped(true);
    setActive(index);
  }

  return (
    <section className="hok-section hok-testi">
      <div className="container">
        <h2 className="hok-title hok-title--center" data-reveal="mask">
          <MaskText text="What Our" em="Clients Say" />
        </h2>
        <figure className="hok-quote" data-reveal="up">
          <blockquote key={active} className={swapped ? "is-swap" : undefined}>
            {t.quote.split(" ").map((word, i) => (
              <Fragment key={i}>
                {i > 0 && " "}
                <span className="hok-m">
                  <span style={{ "--w": i } as React.CSSProperties}>{word}</span>
                </span>
              </Fragment>
            ))}
          </blockquote>
          <figcaption key={`c${active}`} className={swapped ? "is-swap" : undefined}>
            <div className="hok-quote__name">{t.name}</div>
            <div className="hok-quote__brand">{t.role ?? t.brand}</div>
          </figcaption>
        </figure>
        <div className="hok-testi-logos" role="group" aria-label="Choose a client">
          {TESTIMONIALS.map((item, i) => (
            <div key={item.name} className={`hok-testi-item${i === active ? " is-active" : ""}`}>
              <button
                type="button"
                className={`hok-chip${item.logo ? "" : " hok-chip--mono"}`}
                aria-pressed={i === active}
                aria-label={item.brand}
                onClick={() => show(i)}
              >
                {item.logo ? <img src={logoSrc(item.logo)} alt="" loading="lazy" /> : <b aria-hidden="true">{initials(item.name)}</b>}
              </button>
              <span className="hok-testi-bar" aria-hidden="true">
                {i === active && <span key={active} onAnimationEnd={() => show((active + 1) % TESTIMONIALS.length)} />}
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
