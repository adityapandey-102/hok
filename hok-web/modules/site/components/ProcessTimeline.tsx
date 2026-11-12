import { PROCESS } from "../content";
import { REVEAL } from "./SectionHead";

/**
 * "How we work": five numbered steps (a real sequence, so numbers are right).
 * A single hairline runs above them; each column holds a large outlined
 * number, the title and the full sentence. Five columns on desktop, one on
 * phones. The steps stagger in once, after the block's own fade (CSS).
 */
export function ProcessTimeline() {
  return (
    <ol className="hok-steps" {...REVEAL}>
      {PROCESS.map((step, i) => (
        <li key={step.title} className="hok-step" style={{ "--i": i } as React.CSSProperties}>
          <div className="hok-step__n" aria-hidden="true">
            {String(i + 1).padStart(2, "0")}
          </div>
          <h3 className="hok-step__t">{step.title}</h3>
          <p className="hok-step__text">{step.text}</p>
        </li>
      ))}
    </ol>
  );
}
