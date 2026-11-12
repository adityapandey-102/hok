import { Marquee } from "./Marquee";

/** The closing "Let's talk!" marquee, as one link to the contact page. */
export function LetsTalk() {
  return (
    <section className="hok-section hok-section--end">
      <a href="/contact" className="d-block hok-talk" aria-label="Let's talk: contact HOK">
        <Marquee text="Let’s talk!" count={5} className="home-onetext" />
      </a>
    </section>
  );
}
