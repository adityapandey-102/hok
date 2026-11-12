import { SERVICE_GROUPS, SERVICE_ITEMS } from "../content";
import { REVEAL } from "./SectionHead";

const BLURBS = new Map(SERVICE_ITEMS.map((s) => [s.title, s.blurb]));

/**
 * The four service groups, all open (no accordion). `grid` = the home and About
 * 2x2 panels with a plain list; `rows` = the Services page: title and text on
 * the left, every service with its one-line description on the right.
 * Hairlines only: no cards, shadows or numbers.
 */
export function ServiceGroups({ layout }: { layout: "grid" | "rows" }) {
  if (layout === "grid") {
    return (
      <div className="hok-groups" {...REVEAL}>
        {SERVICE_GROUPS.map((group) => (
          <section key={group.title} className="hok-group">
            <h3>{group.title}</h3>
            <p className="hok-group__text">{group.text}</p>
            <ul className="hok-list">
              {group.items.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    );
  }
  return (
    <div className="hok-rows">
      {SERVICE_GROUPS.map((group) => (
        <section key={group.title} className="hok-row" {...REVEAL}>
          <div className="hok-row__lead">
            <h2 className="hok-row__title">{group.title}</h2>
            <p className="hok-group__text">{group.text}</p>
          </div>
          <ul className="hok-svcs">
            {group.items.map((item) => (
              <li key={item} className="hok-svc">
                <h3>{item}</h3>
                <p>{BLURBS.get(item)}</p>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
