import { COMPANY, CONTACT, MARKETS_SHORT, PHONE_HREF, SERVICE_GROUPS, SOCIALS } from "../content";

const PAGES = [
  { href: "/", label: "Home" },
  { href: "/about", label: "About" },
  { href: "/services", label: "Services" },
  { href: "/contact", label: "Contact" },
];

/**
 * The footer, the same on every page: four plain columns (About with text
 * social links, Pages, Services, Contact) and one thin bottom bar with the
 * copyright and a discreet "Staff login" link. All text comes from
 * modules/site/content.ts. The only back-to-top button is the fixed one
 * (ScrollTop). The `variant` prop is kept so every page can pass what it always passed.
 */
export function SiteFooter({ variant }: { variant: "home" | "inner" }) {
  void variant;
  return (
    <footer className="hok-footer">
      <div className="container">
        <div className="hok-footer__lead">
          <a href={`mailto:${CONTACT.email}`} className="hok-footer__statement hok-link">
            {CONTACT.email}
          </a>
          <ul className="hok-footer__list hok-footer__social">
            <li>
              <a href={SOCIALS.instagram} className="hok-link" target="_blank" rel="noopener noreferrer">
                Instagram
              </a>
            </li>
            <li>
              <a href={SOCIALS.linkedin} className="hok-link" target="_blank" rel="noopener noreferrer">
                LinkedIn
              </a>
            </li>
          </ul>
        </div>
        <div className="hok-footer__cols">
          <div>
            <h2 className="hok-footer__h">About</h2>
            <p className="hok-footer__about">
              {COMPANY.tagline}. {COMPANY.longName} helps brands grow through strategy, storytelling and automation.
            </p>
            <p className="hok-footer__markets">Serving {MARKETS_SHORT}</p>
          </div>
          <div>
            <h2 className="hok-footer__h">Pages</h2>
            <ul className="hok-footer__list">
              {PAGES.map((p) => (
                <li key={p.label}>
                  <a href={p.href} className="hok-link">{p.label}</a>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h2 className="hok-footer__h">Services</h2>
            <ul className="hok-footer__list">
              {SERVICE_GROUPS.map((group) => (
                <li key={group.title}>
                  <a href="/services" className="hok-link">{group.title}</a>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h2 className="hok-footer__h">Contact</h2>
            <ul className="hok-footer__list">
              <li>
                <a href={PHONE_HREF} className="hok-link">{CONTACT.phone}</a>
              </li>
              <li>
                <a href={`mailto:${CONTACT.email}`} className="hok-link">{CONTACT.email}</a>
              </li>
              <li>{CONTACT.address}</li>
              <li>{CONTACT.hours}</li>
            </ul>
          </div>
        </div>
        <div className="hok-footer__bar">
          <p>
            &copy; {new Date().getFullYear()} {COMPANY.name} ({COMPANY.longName}). All rights reserved.
          </p>
          <a href="/login" className="hok-staff-login hok-link">
            Staff login
          </a>
        </div>
      </div>
    </footer>
  );
}
