import { TRUST } from "../content";
import { SectionHead } from "./SectionHead";
import { TrustIcon } from "./TrustIcons";

/**
 * "Why Brands Trust HOK" (Home, after What We Do; About, after the Team): six
 * capability items in a 3x2 hairline grid (one column on phones), each with a
 * 40 px line icon, a bold title and one line. No cards: only hairlines between
 * the items. On desktop a hovering item fills its icon red. The whole section
 * stays within one 800 px screen.
 */
export function TrustSection() {
  return (
    <section className="hok-section hok-section--compact" id="why-hok">
      <div className="container">
        <SectionHead className="hok-head--compact" title="Why Brands" em="Trust HOK" text={TRUST.intro} />
        <ul className="hok-trustgrid">
          {TRUST.items.map((item, i) => (
            <li key={item.title} className="hok-trust-item" data-reveal="up" style={{ "--i": i % 3 } as React.CSSProperties}>
              <span className="hok-trust-item__icon">
                <TrustIcon name={item.icon} />
              </span>
              <h3 className="hok-trust-item__t">{item.title}</h3>
              <p>{item.text}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
