import { Marquee } from "./Marquee";
import { SignalMotif } from "./SignalMotif";

/**
 * The closing "Let's talk!" band: the whole band is one big button. Hovering
 * slows the text to a crawl; a click opens the
 * contact modal (SiteMotion), and without JavaScript the link goes to /contact.
 */
export function LetsTalk() {
  return (
    <section className="hok-section hok-section--end hok-talk-sec">
      <SignalMotif id="hk-dots-talk" className="hok-motif--talk" />
      <a
        href="/contact"
        className="d-block hok-talk"
        data-contact=""
        aria-label="Let's talk: contact HOK"
      >
        <Marquee text="Let’s talk!" count={5} className="home-onetext" hoverRate={0.3} />
      </a>
    </section>
  );
}
