import { STOCK, TEAM } from "../content";
import { Btn } from "./Btn";
import { SectionHead } from "./SectionHead";
import { TeamIcon } from "./TeamIcons";

/**
 * The About page's Team section: a wide 21:9 photo with a caption over a bottom
 * gradient (clip reveal), then six role cards (3 columns on desktop, 2 on tablets,
 * 1 on phones) in the same card style as the service cards, and one line with a
 * ghost button that opens the contact modal. Text comes from TEAM in content.ts.
 */
export function TeamSection() {
  return (
    <section className="hok-section" id="team">
      <div className="container">
        <SectionHead title="The People Behind" em="The Work" />
        <figure className="hok-team__photo" data-reveal="clip">
          <img src={STOCK.team} alt="The HOK team planning a campaign at a whiteboard" width={1600} height={900} sizes="(min-width: 1280px) 1200px, 100vw" loading="lazy" decoding="async" />
          <figcaption>{TEAM.caption}</figcaption>
        </figure>
        <ul className="hok-team__grid">
          {TEAM.roles.map((role, i) => (
            <li key={role.title} className="hok-role" data-reveal="up" style={{ "--i": i % 3 } as React.CSSProperties}>
              <span className="hok-role__icon">
                <TeamIcon name={role.icon} />
              </span>
              <h3 className="hok-role__t">{role.title}</h3>
              <p>{role.text}</p>
            </li>
          ))}
        </ul>
        <div className="hok-team__cta" data-reveal="up">
          <p>Want to work with this team?</p>
          <Btn href="/contact" variant="ghost" contact>
            Start a Project
          </Btn>
        </div>
      </div>
    </section>
  );
}
