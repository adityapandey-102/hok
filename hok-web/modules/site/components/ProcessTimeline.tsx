import { PROCESS } from "../content";

/**
 * "How we work": five numbered steps (a real sequence, so numbers are right).
 * One hairline above them draws left to right, then the outlined numbers fill
 * red from the bottom, one after another (CSS, triggered by SiteMotion's
 * reveal). Five columns on desktop, one on phones.
 */
export function ProcessTimeline() {
  return (
    <ol className="hok-steps" data-reveal="steps">
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
