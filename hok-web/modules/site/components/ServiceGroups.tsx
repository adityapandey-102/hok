import { SERVICE_GROUPS } from "../content";
import { ServiceGraphic } from "./ServiceGraphics";

/**
 * "What We Do" on Home and About: the four service groups as compact cards in
 * one row (2x2 on tablets, a swipe row on phones), so the whole section fits one
 * screen. Each card has its line graphic (88 px high, drawn once when the card
 * enters view: SiteMotion), the title, a one-line description and the services as a
 * muted list. On desktop a hovering card lifts, its border turns red and a red
 * line grows along its top. The Services page has its own, larger layout
 * (ServicePanels).
 */
export function ServiceGroups() {
  return (
    <>
      <div className="hok-scards">
        {SERVICE_GROUPS.map((group, i) => (
          <article key={group.title} className="hok-scard" data-reveal="up" style={{ "--i": i } as React.CSSProperties}>
            <div className="hok-scard__gfx">
              <ServiceGraphic group={group.title} />
            </div>
            <h3 className="hok-scard__title">{group.title}</h3>
            <p className="hok-scard__text">{group.short}</p>
            <p className="hok-scard__items">{group.items.join(" · ")}</p>
          </article>
        ))}
      </div>
      <p className="hok-swipe" aria-hidden="true">
        Swipe to see all four
      </p>
    </>
  );
}
