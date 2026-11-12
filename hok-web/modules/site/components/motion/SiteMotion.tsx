"use client";

import { useEffect, useRef } from "react";

/** The hero cubes' bob: one beat (seconds) for every cube. Tune the speed here. */
const CUBE_PERIOD_S = 2.2;

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

type Magnet = { x: number; y: number; tx: number; ty: number };

/** Cursor size (px) per state: the dot, the ring over links and buttons, the play disc. */
const CURSOR_SIZE = { "": 10, link: 44, play: 64 } as const;
type CursorState = keyof typeof CURSOR_SIZE | "hidden";

/**
 * One text slider or logo strip. `items` all get the same translate; the loop
 * is exactly `dist` px long and one pass takes `seconds` at normal speed.
 */
type Marq = { el: HTMLElement; items: HTMLElement[]; pos: number; dist: number; seconds: number; rate: number };

/**
 * All the site's motion, mounted once in SitePage. Plain DOM, no libraries,
 * one requestAnimationFrame loop. Only `transform`-family properties (and
 * opacity) are animated and the whole kit is off under `prefers-reduced-motion`
 * (the content is then simply visible: the `hk-js` class that hides it before a
 * reveal is never set).
 *
 *  - header:   the header gets `.is-scrolled` once the page moved more than 20 px (always on)
 *  - reveal:   [data-reveal="up|mask|clip|steps"] get `.is-in` once, when 15 % is in view
 *  - parallax: [data-parallax="0.12"] drifts against the scroll (desktop)
 *  - magnetic: [data-magnetic] leans up to 8 px toward the pointer (desktop)
 *  - cursor:   a 10 px red dot; a 44 px red ring over links and buttons; a 64 px red disc with a
 *              play triangle over [data-cursor="play"]; hidden over form fields. No text (desktop)
 *  - marquees: [data-marquee] run from first paint, driven here (not by CSS, whose paused-state
 *              plus playbackRate combination left them frozen); faster while scrolling, slower on hover
 *  - draw:     `.hk-draw` strokes inside a revealed card are measured (--len) and drawn once by CSS
 *  - cubes:    `.hc-cube` (hero graphic) move only up and down, as a left-to-right wave (CUBE_PERIOD_S) on one global clock, paused only while the hero is off screen
 *  - hero:     [data-hero] a red spotlight that follows the pointer (desktop); the background is static
 *  - contact:  [data-contact] opens the contact modal (or scrolls to the form on /contact);
 *              `data-contact-message` pre-fills its message
 */
export function SiteMotion() {
  const cursorRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const root = document.documentElement;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const fine = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
    const cleanups: (() => void)[] = [];
    const on = <T extends EventTarget>(target: T, type: string, fn: (e: never) => void, opts?: AddEventListenerOptions) => {
      target.addEventListener(type, fn as EventListener, opts);
      cleanups.push(() => target.removeEventListener(type, fn as EventListener, opts));
    };

    // --- header: transparent at the top, a dark blurred bar once the page moves (always on, also with reduced motion)
    const header = document.querySelector<HTMLElement>(".header-section");
    const syncHeader = () => header?.classList.toggle("is-scrolled", window.scrollY > 20);
    syncHeader();
    on(window, "scroll", syncHeader, { passive: true });

    // --- contact buttons: open the modal, or on /contact scroll to the form (always on, also with reduced motion)
    on(document, "click", (event: MouseEvent) => {
      const el = (event.target as Element | null)?.closest?.("[data-contact]");
      if (!el || event.defaultPrevented || event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return;
      event.preventDefault();
      const form = document.getElementById("contact-form");
      if (form) {
        form.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "center" });
        window.setTimeout(() => form.querySelector<HTMLElement>("input, textarea")?.focus({ preventScroll: true }), reduced ? 0 : 500);
      } else {
        const message = el.getAttribute("data-contact-message");
        window.dispatchEvent(new CustomEvent("hok:contact", { detail: message ? { message } : undefined }));
      }
    });

    if (reduced) return () => cleanups.forEach((fn) => fn());

    // --- line graphics: measure every stroke to draw (CSS draws it once the card has .is-in)
    document.querySelectorAll<SVGGeometryElement>(".hk-draw").forEach((el) => {
      try {
        el.style.setProperty("--len", String(Math.ceil(el.getTotalLength()) + 1));
      } catch {
        /* not measurable: the stroke simply stays drawn */
      }
    });

    // --- reveal
    // A clipped element (clip-path) counts as empty to the observer, so clip reveals watch the parent box instead.
    const watched = new Map<Element, Element[]>();
    const reveal = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          if (entry.intersectionRatio < 0.15 && entry.intersectionRect.height < window.innerHeight * 0.5) continue; // very tall blocks
          for (const el of watched.get(entry.target) ?? []) el.classList.add("is-in");
          watched.delete(entry.target);
          reveal.unobserve(entry.target);
        }
      },
      { threshold: [0, 0.05, 0.15, 0.3] },
    );
    document.querySelectorAll("[data-reveal]").forEach((el) => {
      const target = el.getAttribute("data-reveal")?.startsWith("clip") && el.parentElement ? el.parentElement : el;
      watched.set(target, [...(watched.get(target) ?? []), el]);
      reveal.observe(target);
    });
    cleanups.push(() => reveal.disconnect());

    // --- which animated things are on screen
    const parallax = new Map<HTMLElement, { f: number; y: number }>();
    type Hero = { el: HTMLElement; spot: HTMLElement | null; visible: boolean };
    const heroRef: { current: Hero | null } = { current: null };
    const desktop = fine && window.matchMedia("(min-width: 992px)").matches;

    const view = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        const el = entry.target as HTMLElement;
        el.dataset.vis = entry.isIntersecting ? "1" : "0";
        if (heroRef.current && heroRef.current.el === el) heroRef.current.visible = entry.isIntersecting;
      }
    });
    cleanups.push(() => view.disconnect());

    if (desktop) {
      document.querySelectorAll<HTMLElement>("[data-parallax]").forEach((el) => {
        const f = parseFloat(el.dataset.parallax ?? "0");
        if (!f) return;
        parallax.set(el, { f, y: 0 });
        view.observe(el);
      });
    }
    const heroEl = document.querySelector<HTMLElement>("[data-hero]");
    if (heroEl && fine) {
      heroRef.current = { el: heroEl, spot: heroEl.querySelector("[data-hero-spot]"), visible: true };
      view.observe(heroEl);
    }

    // --- marquees: start from where the CSS fallback animation is, then take over
    const marquees: Marq[] = [];
    document.querySelectorAll<HTMLElement>("[data-marquee]").forEach((el) => {
      const logos = el.querySelector<HTMLElement>(".hok-logos__track");
      const items = logos ? [logos] : Array.from(el.querySelectorAll<HTMLElement>(".scrolling-wrap > .comm"));
      if (items.length === 0) return;
      let startX = 0;
      try {
        startX = -new DOMMatrixReadOnly(getComputedStyle(items[0]).transform).m41;
      } catch {
        /* no transform yet */
      }
      marquees.push({ el, items, pos: Math.max(0, startX), dist: 0, seconds: logos ? 80 : 60, rate: 1 });
      el.classList.add("hk-marq"); // CSS: the fallback animation stops, this loop moves the items
    });
    const measure = () => {
      for (const m of marquees) {
        const first = m.items[0];
        if (first.classList.contains("hok-logos__track")) m.dist = first.scrollWidth / 2;
        else {
          const wrap = first.parentElement as HTMLElement;
          m.dist = first.offsetWidth + (parseFloat(getComputedStyle(wrap).columnGap) || 0);
        }
        if (m.dist > 0) m.pos %= m.dist;
      }
    };
    measure();
    on(window, "resize", measure);
    void document.fonts?.ready.then(measure);
    const refresh = window.setTimeout(measure, 400);
    cleanups.push(() => window.clearTimeout(refresh));
    cleanups.push(() =>
      marquees.forEach((m) => {
        m.el.classList.remove("hk-marq");
        m.items.forEach((item) => (item.style.transform = ""));
      }),
    );

    // --- pointer and cursor
    const ptr = { x: -200, y: -200, inside: false };
    const magnets = new Map<HTMLElement, Magnet>();
    const cursor = cursorRef.current;
    const body = bodyRef.current;
    const cur = { size: 10, target: 10, state: "" as CursorState, spX: 0, spY: 0, spOn: 0 };
    const setState = (state: CursorState) => {
      if (state === cur.state) return;
      cur.state = state;
      if (state !== "hidden") cur.target = CURSOR_SIZE[state];
      if (cursor) cursor.dataset.state = state;
    };

    if (fine) {
      root.classList.add("hk-cursor-on");
      cleanups.push(() => root.classList.remove("hk-cursor-on"));

      on(document, "pointermove", (e: PointerEvent) => {
        ptr.x = e.clientX;
        ptr.y = e.clientY;
        ptr.inside = true;
        cursor?.classList.add("is-on");
        const m = desktop ? ((e.target as Element).closest?.("[data-magnetic]") as HTMLElement | null) : null; // no magnetic buttons under 992 px
        magnets.forEach((mg, el) => {
          if (el !== m) {
            mg.tx = 0;
            mg.ty = 0;
          }
        });
        if (m) {
          const r = m.getBoundingClientRect();
          const mg = magnets.get(m) ?? { x: 0, y: 0, tx: 0, ty: 0 };
          mg.tx = clamp(((e.clientX - (r.left + r.width / 2)) / (r.width / 2)) * 8, -8, 8);
          mg.ty = clamp(((e.clientY - (r.top + r.height / 2)) / (r.height / 2)) * 8, -8, 8);
          magnets.set(m, mg);
        }
      });
      on(document.documentElement, "mouseleave", () => {
        ptr.inside = false;
        cursor?.classList.remove("is-on");
        magnets.forEach((mg) => {
          mg.tx = 0;
          mg.ty = 0;
        });
      });

      // the cursor's look follows what is under the pointer
      on(document, "pointerover", (e: PointerEvent) => {
        const target = e.target as Element;
        if (target.closest?.("input, textarea, select")) return setState("hidden");
        if (target.closest?.('[data-cursor="play"]')) return setState("play");
        setState(target.closest?.("a, button, [data-cursor]") ? "link" : "");
      });
    }

    // --- hero cubes: a wave that moves ONLY up and down, on one global clock, written here every frame:
    //     y = A sin(2 pi t / CUBE_PERIOD_S - 2 pi x / 560), x the cube's centre in the 560-wide drawing (getBBox, measured
    //     once), so one wavelength spans the composition and the crest travels left to right. A 14 px (12 px for the big
    //     red cube). Nothing else moves a cube (no x, no sway, no parallax, no hover lift, no hop).
    //     It only pauses while the hero is off screen and then picks up from the same clock, so there is never a jump.
    const bobs = Array.from(document.querySelectorAll<SVGGElement>(".hok-cubes .hc-cube")).map((g) => {
      let cx = 280;
      try {
        const box = g.getBBox(); // in the cube's own space: its transform is not part of it
        cx = box.x + box.width / 2;
      } catch {
        /* not rendered: the middle of the drawing */
      }
      return { g, amp: Number(g.dataset.amp) || 14, phase: -2 * Math.PI * (cx / 560) };
    });
    const cubeSvg = document.querySelector<SVGSVGElement>("svg.hok-cubes");
    const cubeShadow = cubeSvg?.querySelector<SVGElement>(".hc-shadow") ?? null;
    let bobOn = bobs.length > 0;
    let bobK = 1; // the graphic is drawn in 560x520 units; on a phone it is scaled down, so the bob is scaled up to stay visible
    if (cubeSvg && bobs.length) {
      const fit = () => {
        const r = cubeSvg.getBoundingClientRect();
        const scale = Math.min(r.width / 560, r.height / 520) || 1;
        bobK = Math.max(1, 10 / (14 * scale));
      };
      fit();
      on(window, "resize", fit);
      const heroEl = cubeSvg.closest("[data-hero]");
      if (heroEl && "IntersectionObserver" in window) {
        const io = new IntersectionObserver((entries) => (bobOn = entries.some((e) => e.isIntersecting)));
        io.observe(heroEl);
        cleanups.push(() => io.disconnect());
      }
      cleanups.push(() =>
        bobs.forEach(({ g }) => {
          g.style.transform = "";
        }),
      );
    }

    // --- one loop
    let raf = 0;
    let lastY = window.scrollY;
    let last = performance.now();
    let speed = 0;
    const tick = (now: number) => {
      raf = requestAnimationFrame(tick);
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      const sy = window.scrollY;
      speed = lerp(speed, Math.abs(sy - lastY), 0.15);
      lastY = sy;
      const vh = window.innerHeight;

      // hero cubes: the global-clock sine (one beat, CUBE_PERIOD_S, for all of them)
      if (bobOn) {
        const w = (2 * Math.PI * (performance.now() / 1000)) / CUBE_PERIOD_S;
        for (const b of bobs) b.g.style.transform = `translateY(${(b.amp * bobK * Math.sin(w + b.phase)).toFixed(2)}px)`;
        // the shadow follows the big cube (the first one): smallest when it is highest (y most negative)
        if (cubeShadow && bobs[0]) cubeShadow.style.transform = `scale(${(1 - 0.08 * ((1 - Math.sin(w + bobs[0].phase)) / 2)).toFixed(4)})`;
      }

      // parallax
      parallax.forEach((p, el) => {
        if (el.dataset.vis === "0") return;
        const r = el.getBoundingClientRect();
        const center = r.top - p.y + r.height / 2; // where it would sit without its own offset
        p.y = clamp((center - vh / 2) * -p.f, -120, 120);
        el.style.translate = `0 ${p.y.toFixed(1)}px`;
      });

      // marquees: always moving; faster while the page scrolls, slower on hover
      const boost = Math.min(1.5, speed / 18);
      for (const m of marquees) {
        if (m.dist <= 0) continue;
        const hoverRate = parseFloat(m.el.dataset.marqueeHover ?? "1");
        const base = m.el.matches(":hover") ? hoverRate : 1;
        m.rate = lerp(m.rate, base * (1 + boost), 0.08);
        m.pos = (m.pos + (m.dist / m.seconds) * m.rate * dt) % m.dist;
        const t = `translate3d(${(-m.pos).toFixed(2)}px, 0, 0)`;
        for (const item of m.items) item.style.transform = t;
      }

      if (fine) {
        // cursor: the dot follows instantly; its size eases (0.2) to the dot, ring or disc size
        cur.size = lerp(cur.size, cur.target, 0.2);
        if (Math.abs(cur.size - cur.target) < 0.05) cur.size = cur.target;
        if (cursor) cursor.style.transform = `translate3d(${ptr.x}px, ${ptr.y}px, 0)`;
        if (body) {
          const s = `${cur.size.toFixed(1)}px`;
          body.style.width = s;
          body.style.height = s;
        }

        // magnetic
        magnets.forEach((mg, el) => {
          mg.x = lerp(mg.x, mg.tx, 0.15);
          mg.y = lerp(mg.y, mg.ty, 0.15);
          if (mg.tx === 0 && mg.ty === 0 && Math.abs(mg.x) < 0.05 && Math.abs(mg.y) < 0.05) {
            el.style.translate = "";
            magnets.delete(el);
          } else el.style.translate = `${mg.x.toFixed(2)}px ${mg.y.toFixed(2)}px`;
        });

        // hero: the spotlight follows the pointer (the background stays still)
        const hero = heroRef.current;
        if (hero && hero.visible) {
          const r = hero.el.getBoundingClientRect();
          const inHero = ptr.inside && ptr.x >= r.left && ptr.x <= r.right && ptr.y >= r.top && ptr.y <= r.bottom;
          if (hero.spot) {
            if (inHero) {
              if (!cur.spOn) {
                cur.spX = ptr.x - r.left;
                cur.spY = ptr.y - r.top;
              }
              cur.spX = lerp(cur.spX, ptr.x - r.left, 0.1);
              cur.spY = lerp(cur.spY, ptr.y - r.top, 0.1);
            }
            cur.spOn = inHero ? 1 : 0;
            hero.spot.style.transform = `translate3d(${(cur.spX - 300).toFixed(1)}px, ${(cur.spY - 300).toFixed(1)}px, 0)`;
            hero.spot.style.opacity = inHero ? "1" : "0";
          }
        }
      }
    };
    const start = () => {
      cancelAnimationFrame(raf);
      last = performance.now();
      if (!document.hidden) raf = requestAnimationFrame(tick);
    };
    on(document, "visibilitychange", () => (document.hidden ? cancelAnimationFrame(raf) : start()));
    start();
    cleanups.push(() => {
      cancelAnimationFrame(raf);
      parallax.forEach((_, el) => (el.style.translate = ""));
      magnets.forEach((_, el) => (el.style.translate = ""));
    });

    return () => cleanups.forEach((fn) => fn());
  }, []);

  return (
    <div className="hk-cursor" ref={cursorRef} aria-hidden="true">
      <span className="hk-cursor__body" ref={bodyRef}>
        <svg viewBox="0 0 24 24" focusable="false">
          <path d="M8 5.5v13l11-6.5z" />
        </svg>
      </span>
    </div>
  );
}
